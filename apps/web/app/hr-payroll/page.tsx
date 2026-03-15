"use client";

import { useMemo, useState } from "react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { ActivityTimeline } from "../../components/ui/activity-timeline";
import { DataTable } from "../../components/ui/data-table";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { useCompanyPersistentState } from "../../hooks/use-company-persistent-state";
import { useWorkspace } from "../../hooks/use-workspace";
import { downloadCsvFile } from "../../lib/export";
import { payrollViews, type AppStatus, type KpiMetric, type TimelineItem } from "../../lib/erp";


// Generate last 12 months + next 3 months as period options
function generatePeriodOptions(): string[] {
  const fmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
  const options: string[] = [];
  const now = new Date();
  for (let i = -11; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(fmt.format(d));
  }
  return options;
}

const PERIOD_OPTIONS = generatePeriodOptions();
const defaultPayrollState = {
  draft: { period: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date()), payDate: new Date().toISOString().slice(0, 10), note: "", status: "Draft" as AppStatus, employees: 0, netPay: 0 },
  message: "Payroll backend tables are not wired yet, so this page no longer shows hardcoded employee or run data.",
  localRuns: [] as Array<{ id: string; period: string; employees: number; netPay: string; status: AppStatus; owner: string; payDate: string }>,
};

export default function HrPayrollPage() {
  const { activeCompany } = useWorkspace();
  const [state, setState] = useCompanyPersistentState("payroll", activeCompany?.id, defaultPayrollState);
  const { draft, message, localRuns } = state;
  const allRuns = useMemo(() => localRuns, [localRuns]);
  const [approvingRunId, setApprovingRunId] = useState<string | null>(null);

  const totals = useMemo(() => {
    const selectedRun = allRuns.find((run) => run.period === draft.period);
    return {
      headcount: selectedRun?.employees ?? draft.employees,
      netPay: selectedRun?.netPay ?? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(draft.netPay || 0),
    };
  }, [allRuns, draft.employees, draft.netPay, draft.period]);

  const metrics = useMemo<KpiMetric[]>(
    () => [
      { label: "Payroll runs", value: String(allRuns.length), delta: "Stored for this company", trend: allRuns.length ? "up" : "neutral", detail: "Local payroll run history until backend payroll tables are added" },
      { label: "Current headcount", value: String(totals.headcount), delta: "Draft run", trend: totals.headcount ? "up" : "neutral", detail: "Employees entered for the current payroll draft" },
      { label: "Current net pay", value: totals.netPay, delta: "Draft run", trend: draft.netPay > 0 ? "up" : "neutral", detail: "Net pay entered for the current payroll draft" },
      { label: "Mapped employees", value: "0", delta: "Backend not wired", trend: "neutral", detail: "Employee master will appear here after payroll tables are exposed by the API" },
    ],
    [allRuns.length, draft.netPay, totals.headcount, totals.netPay],
  );

  const payrollTimeline = useMemo<TimelineItem[]>(
    () =>
      allRuns.slice(0, 5).map((run) => ({
        id: run.id,
        title: `Payroll ${run.status.toLowerCase()}`,
        subtitle: run.period,
        timestamp: run.payDate,
        user: run.owner,
        status: run.status,
      })),
    [allRuns],
  );

  function exportRegister() {
    downloadCsvFile(
      "payroll-register.csv",
      ["Run", "Period", "Employees", "Net pay", "Status", "Pay date"],
      allRuns.map((run) => [run.id, run.period, run.employees, run.netPay, run.status, run.payDate]),
    );
    setState((current) => ({ ...current, message: "Payroll register exported to CSV." }));
  }

  function upsertRun(nextStatus: AppStatus, nextMessage: string) {
    const runId = `PR-${draft.period.replace(/\s+/g, "-").toUpperCase()}`;
    setState((current) => {
      const nextRun = {
        id: runId,
        period: current.draft.period,
        employees: totals.headcount,
        netPay: totals.netPay,
        status: nextStatus,
        payDate: current.draft.payDate,
        owner: "Current user",
      };
      const withoutCurrent = current.localRuns.filter((run) => run.id !== runId);
      return {
        ...current,
        draft: { ...current.draft, status: nextStatus },
        message: nextMessage,
        localRuns: [nextRun, ...withoutCurrent],
      };
    });
  }

  function processPayroll() {
    upsertRun("Pending", "Payroll run prepared, added to history, and saved for this company.");
  }

  function saveDraft() {
    setState((current) => ({
      ...current,
      message: "Payroll draft saved for this company and will still be here after you sign back in.",
    }));
  }

  function submitForApproval() {
    upsertRun("Submitted", "Payroll draft submitted for approval and retained in payroll history.");
  }

  function approveRun(runId: string) {
    setApprovingRunId(runId);
    setState((current) => ({
      ...current,
      message: `Payroll run ${runId} approved and ready for release.`,
      localRuns: current.localRuns.map((run) =>
        run.id === runId
          ? {
              ...run,
              status: "Approved",
            }
          : run,
      ),
    }));
    window.setTimeout(() => setApprovingRunId(null), 250);
  }

  function handleRunBulkAction(action: string, rows: typeof allRuns) {
    const lowered = action.toLowerCase();

    // ── Approve ────────────────────────────────────────────────────────────────
    if (lowered.includes("approve")) {
      const runIds = rows
        .filter((row) => row.status === "Pending" || row.status === "Submitted")
        .map((row) => row.id);

      if (!runIds.length) {
        setState((current) => ({ ...current, message: "Selected payroll runs are already approved or completed." }));
        return;
      }

      setState((current) => ({
        ...current,
        message: `${runIds.length} payroll run(s) approved and retained in payroll history.`,
        localRuns: current.localRuns.map((run) => (runIds.includes(run.id) ? { ...run, status: "Approved" } : run)),
      }));
      return;
    }

    // ── Export ─────────────────────────────────────────────────────────────────
    if (lowered.includes("export")) {
      downloadCsvFile(
        "payroll-register-selection.csv",
        ["Run", "Period", "Employees", "Net pay", "Status", "Pay date"],
        rows.map((run) => [run.id, run.period, run.employees, run.netPay, run.status, run.payDate]),
      );
      setState((current) => ({ ...current, message: `${rows.length} payroll run(s) exported to CSV.` }));
      return;
    }

    // ── Lock Period ────────────────────────────────────────────────────────────
    if (lowered.includes("lock")) {
      const lockableIds = rows
        .filter((row) => row.status === "Approved")
        .map((row) => row.id);

      if (!lockableIds.length) {
        setState((current) => ({ ...current, message: "Only approved runs can be locked. Select approved runs first." }));
        return;
      }

      setState((current) => ({
        ...current,
        message: `${lockableIds.length} payroll run(s) locked. Locked runs cannot be edited or re-submitted.`,
        localRuns: current.localRuns.map((run) => (lockableIds.includes(run.id) ? { ...run, status: "Posted" } : run)),
      }));
      return;
    }
  }

  return (
    <WorkspaceShell
      title="Payroll"
      description="Run payroll, review exceptions, protect approvals, and keep employee payment activity auditable."
      requiredRoles={["hr", "cfo", "admin", "ceo"]}
      tabs={payrollViews}
      activeTab="Payroll Runs"
      pageActions={
        <ModuleActionBar
          primaryAction={<button className="primary-button" type="button" onClick={processPayroll}>Process payroll</button>}
          summary="Payroll processing stays visible. Draft, approval, register export, and readiness views are grouped above the workspace."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                { label: "Save draft", description: "Keep this payroll run in draft", onSelect: saveDraft },
                { label: "Submit for approval", description: "Move the run into approval workflow", onSelect: submitForApproval },
              ],
            },
            {
              label: "Reports",
              items: [
                { label: "Export register", description: "Download the payroll register to CSV", onSelect: exportRegister },
                {
                  label: "Payroll history",
                  description: "Jump to run history below",
                  onSelect: () => document.getElementById("payroll-run-history")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
          ]}
        />
      }
    >
      <section className="kpi-grid">
        {metrics.map((metric) => (
          <KpiCard key={metric.label} metric={metric} tone="payroll" />
        ))}
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Payroll run control" eyebrow="Transaction workbench">
            <div className="form-grid two-up">
              <label className="field">
                <span>Employees</span>
                <input type="number" min="0" value={draft.employees} onChange={(event) => setState((current) => ({ ...current, draft: { ...current.draft, employees: Number(event.target.value) } }))} />
              </label>
              <label className="field">
                <span>Net pay</span>
                <input type="number" min="0" value={draft.netPay} onChange={(event) => setState((current) => ({ ...current, draft: { ...current.draft, netPay: Number(event.target.value) } }))} />
              </label>
            </div>
            <div className="form-grid two-up">
              <label className="field">
                <span>Period</span>
                <select className="select-input" value={draft.period} onChange={(event) => setState((current) => ({ ...current, draft: { ...current.draft, period: event.target.value } }))}>
                  {PERIOD_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            <label className="field">
              <span>Pay date</span>
              <input type="date" value={draft.payDate} onChange={(event) => setState((current) => ({ ...current, draft: { ...current.draft, payDate: event.target.value } }))} />
            </label>
          </div>
          <label className="field">
            <span>Run note</span>
            <input value={draft.note} onChange={(event) => setState((current) => ({ ...current, draft: { ...current.draft, note: event.target.value } }))} />
          </label>
          <div className="totals-panel slim">
            <div>
              <span>Employees</span>
              <strong>{totals.headcount}</strong>
            </div>
            <div>
              <span>Net pay</span>
              <strong>{totals.netPay}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{draft.status}</strong>
            </div>
          </div>
          <div className="inline-actions compact-end">
            <button className="ghost-button" type="button" onClick={saveDraft}>Save draft</button>
            <button className="primary-button" type="button" onClick={submitForApproval}>Submit for approval</button>
          </div>
          <p className="note">{message}</p>
        </SectionCard>

        <SectionCard title="Payroll run history" eyebrow="Operational control">
          <div id="payroll-run-history" />
          <DataTable
            title="Recent payroll runs"
            tableId="payroll-runs"
            exportFileName="payroll-runs"
            rows={allRuns}
            searchValue={(row) => `${row.id} ${row.period} ${row.owner}`}
            filters={[
              { key: "attention", label: "Needs attention", predicate: (row) => row.status === "Pending" || row.status === "Draft" },
              { key: "completed", label: "Completed", predicate: (row) => row.status === "Approved" || row.status === "Posted" },
            ]}
            advancedFilters={[
              { key: "status", label: "Run status", type: "select", options: [...new Set(allRuns.map((row) => row.status))].map((value) => ({ label: value, value })), getValue: (row) => row.status },
              { key: "period", label: "Period", type: "text", placeholder: "Filter by period", getValue: (row) => row.period },
              { key: "payDate", label: "Pay date", type: "date-range", getValue: (row) => row.payDate },
              { key: "employees", label: "Employee count", type: "number-range", minPlaceholder: "Min employees", maxPlaceholder: "Max employees", getValue: (row) => row.employees },
            ]}
            bulkActions={["Approve", "Export", "Lock period"]}
            onBulkAction={handleRunBulkAction}
            columns={[
              { key: "id", label: "Run", render: (row) => <strong>{row.id}</strong> },
              { key: "period", label: "Period", render: (row) => row.period },
              { key: "employees", label: "Employees", className: "numeric", render: (row) => row.employees },
              { key: "netPay", label: "Net pay", className: "numeric", render: (row) => row.netPay },
              { key: "payDate", label: "Pay date", render: (row) => row.payDate },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
              {
                key: "actions",
                label: "Actions",
                render: (row) =>
                  row.status === "Pending" || row.status === "Submitted" ? (
                    <div className="table-row-actions">
                      <button
                        className="ghost-button small"
                        type="button"
                        disabled={approvingRunId !== null}
                        onClick={() => approveRun(row.id)}
                      >
                        {approvingRunId === row.id ? "Approving..." : "Approve"}
                      </button>
                    </div>
                  ) : (
                    <span className="cell-subcopy">No action</span>
                  ),
                exportValue: (row) => ((row.status === "Pending" || row.status === "Submitted") ? "Approve available" : "No action"),
              },
            ]}
          />
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Employee payroll readiness" eyebrow="Validation list">
          <EmptyState
            tone="payroll"
            title="No employee readiness data mapped yet"
            body="This section no longer shows hardcoded employee rows. It will populate when payroll and employee tables are exposed by the backend."
          />
        </SectionCard>

        <SectionCard title="Payroll audit trail" eyebrow="Visible traceability">
          {payrollTimeline.length ? (
            <ActivityTimeline items={payrollTimeline} />
          ) : (
            <EmptyState tone="payroll" title="No payroll activity yet" body="Create and submit a payroll run to start building an audit trail." />
          )}
        </SectionCard>
      </section>
    </WorkspaceShell>
  );
}
