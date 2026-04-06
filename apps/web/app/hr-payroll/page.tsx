"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { ActivityTimeline } from "../../components/ui/activity-timeline";
import { DataTable } from "../../components/ui/data-table";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { useWorkspace } from "../../hooks/use-workspace";
import { downloadCsvFile } from "../../lib/export";
import {
  approvePayrollRun,
  createPayrollRun,
  getEmployees,
  getPayrollRuns,
  postPayrollRun,
  submitPayrollRun,
  type EmployeeRecord,
  type PayrollRunRecord,
} from "../../lib/api";
import { payrollViews, type KpiMetric, type TimelineItem } from "../../lib/erp";

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

const defaultDraft = {
  period: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date()),
  payDate: new Date().toISOString().slice(0, 10),
  note: "",
};

function fmtCurrency(value: string | number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

export default function HrPayrollPage() {
  const { session, activeCompany } = useWorkspace();
  const [runs, setRuns] = useState<PayrollRunRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [draft, setDraft] = useState(defaultDraft);
  const [message, setMessage] = useState("Run payroll, review exceptions, protect approvals, and keep employee payment activity auditable.");
  const [loading, setLoading] = useState(false);
  const [approvingRunId, setApprovingRunId] = useState<number | null>(null);

  const load = useCallback(async (token: string, companyId?: number) => {
    const [runsData, employeesData] = await Promise.all([
      getPayrollRuns(token, companyId),
      getEmployees(token, companyId),
    ]);
    setRuns(runsData);
    setEmployees(employeesData);
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    load(session.token, activeCompany?.id).catch((err) =>
      setMessage(err instanceof Error ? err.message : "Could not load payroll data."),
    );
  }, [session?.token, activeCompany?.id, load]);

  const metrics = useMemo<KpiMetric[]>(() => {
    const activeEmployees = employees.filter((e) => e.status === "ACTIVE").length;
    const totalNetPay = runs
      .filter((r) => r.status === "POSTED")
      .reduce((sum, r) => sum + (r._count?.lines ?? 0), 0);
    const pendingRuns = runs.filter((r) => r.status === "SUBMITTED").length;

    return [
      { label: "Payroll runs", value: String(runs.length), delta: "Total for this company", trend: runs.length ? "up" : "neutral", detail: "All payroll runs across all periods" },
      { label: "Active employees", value: String(activeEmployees), delta: "Employee master", trend: activeEmployees ? "up" : "neutral", detail: "Employees with ACTIVE status" },
      { label: "Pending approval", value: String(pendingRuns), delta: "Submitted runs", trend: pendingRuns ? "up" : "neutral", detail: "Runs awaiting approval" },
      { label: "Posted payslips", value: String(totalNetPay), delta: "Across posted runs", trend: totalNetPay ? "up" : "neutral", detail: "Total payslip lines in posted runs" },
    ];
  }, [runs, employees]);

  const payrollTimeline = useMemo<TimelineItem[]>(
    () =>
      runs.slice(0, 5).map((run) => ({
        id: String(run.id),
        title: `Payroll ${run.status.toLowerCase()}`,
        subtitle: run.period,
        timestamp: run.payDate,
        user: run.createdBy ? `User #${run.createdBy}` : "System",
        status: run.status as string,
      })),
    [runs],
  );

  function exportRegister() {
    downloadCsvFile(
      "payroll-register.csv",
      ["ID", "Period", "Pay date", "Lines", "Status"],
      runs.map((run) => [run.id, run.period, run.payDate, run._count?.lines ?? 0, run.status]),
    );
  }

  async function processPayroll() {
    if (!session?.token || !activeCompany?.id) {
      setMessage("No active company selected.");
      return;
    }
    setLoading(true);
    try {
      await createPayrollRun(session.token, {
        companyId: activeCompany.id,
        period: draft.period,
        payDate: draft.payDate,
        note: draft.note || undefined,
      });
      setMessage(`Payroll run for ${draft.period} created successfully.`);
      await load(session.token, activeCompany.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not create payroll run.");
    } finally {
      setLoading(false);
    }
  }

  async function submitRun(runId: number) {
    if (!session?.token) return;
    try {
      await submitPayrollRun(session.token, runId);
      setMessage(`Run #${runId} submitted for approval.`);
      await load(session.token, activeCompany?.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not submit run.");
    }
  }

  async function approveRun(runId: number) {
    if (!session?.token) return;
    setApprovingRunId(runId);
    try {
      await approvePayrollRun(session.token, runId);
      setMessage(`Run #${runId} approved.`);
      await load(session.token, activeCompany?.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not approve run.");
    } finally {
      setApprovingRunId(null);
    }
  }

  async function postRun(runId: number) {
    if (!session?.token) return;
    try {
      await postPayrollRun(session.token, runId);
      setMessage(`Run #${runId} posted.`);
      await load(session.token, activeCompany?.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not post run.");
    }
  }

  async function handleRunBulkAction(action: string, rows: PayrollRunRecord[]) {
    if (!session?.token) return;
    const lowered = action.toLowerCase();

    if (lowered.includes("approve")) {
      const submittedRuns = rows.filter((r) => r.status === "SUBMITTED");
      if (!submittedRuns.length) {
        setMessage("No submitted runs selected.");
        return;
      }
      for (const run of submittedRuns) {
        await approveRun(run.id);
      }
      return;
    }

    if (lowered.includes("export")) {
      downloadCsvFile(
        "payroll-register-selection.csv",
        ["ID", "Period", "Pay date", "Lines", "Status"],
        rows.map((run) => [run.id, run.period, run.payDate, run._count?.lines ?? 0, run.status]),
      );
      return;
    }

    if (lowered.includes("lock") || lowered.includes("post")) {
      const approvedRuns = rows.filter((r) => r.status === "APPROVED");
      if (!approvedRuns.length) {
        setMessage("Only approved runs can be posted.");
        return;
      }
      for (const run of approvedRuns) {
        await postRun(run.id);
      }
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
          primaryAction={<button className="primary-button" type="button" onClick={processPayroll} disabled={loading}>Create payroll run</button>}
          summary="Payroll processing stays visible. Draft, approval, register export, and readiness views are grouped above the workspace."
          secondaryGroups={[
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
        <SectionCard title="New payroll run" eyebrow="Transaction workbench">
          <div className="form-grid two-up">
            <label className="field">
              <span>Period</span>
              <select className="select-input" value={draft.period} onChange={(e) => setDraft((d) => ({ ...d, period: e.target.value }))}>
                {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Pay date</span>
              <input type="date" value={draft.payDate} onChange={(e) => setDraft((d) => ({ ...d, payDate: e.target.value }))} />
            </label>
          </div>
          <label className="field">
            <span>Run note</span>
            <input value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          </label>
          <div className="inline-actions compact-end">
            <button className="primary-button" type="button" onClick={processPayroll} disabled={loading}>
              {loading ? "Creating…" : "Create run"}
            </button>
          </div>
          <p className="note">{message}</p>
        </SectionCard>

        <SectionCard title="Payroll run history" eyebrow="Operational control">
          <div id="payroll-run-history" />
          <DataTable
            title="Payroll runs"
            tableId="payroll-runs"
            exportFileName="payroll-runs"
            rows={runs}
            searchValue={(row) => `${row.id} ${row.period}`}
            filters={[
              { key: "attention", label: "Needs attention", predicate: (row) => row.status === "SUBMITTED" || row.status === "DRAFT" },
              { key: "completed", label: "Completed", predicate: (row) => row.status === "APPROVED" || row.status === "POSTED" },
            ]}
            advancedFilters={[
              { key: "status", label: "Run status", type: "select", options: [...new Set(runs.map((r) => r.status))].map((v) => ({ label: v, value: v })), getValue: (row) => row.status },
              { key: "period", label: "Period", type: "text", placeholder: "Filter by period", getValue: (row) => row.period },
              { key: "payDate", label: "Pay date", type: "date-range", getValue: (row) => row.payDate },
            ]}
            bulkActions={["Approve", "Export", "Post"]}
            onBulkAction={handleRunBulkAction}
            columns={[
              { key: "id", label: "Run", render: (row) => <strong>PR-{row.id}</strong> },
              { key: "period", label: "Period", render: (row) => row.period },
              { key: "lines", label: "Lines", className: "numeric", render: (row) => row._count?.lines ?? 0 },
              { key: "payDate", label: "Pay date", render: (row) => row.payDate },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="table-row-actions">
                    {row.status === "DRAFT" && (
                      <button className="ghost-button small" type="button" onClick={() => submitRun(row.id)}>Submit</button>
                    )}
                    {row.status === "SUBMITTED" && (
                      <button
                        className="ghost-button small"
                        type="button"
                        disabled={approvingRunId !== null}
                        onClick={() => approveRun(row.id)}
                      >
                        {approvingRunId === row.id ? "Approving…" : "Approve"}
                      </button>
                    )}
                    {row.status === "APPROVED" && (
                      <button className="ghost-button small" type="button" onClick={() => postRun(row.id)}>Post</button>
                    )}
                    {(row.status === "POSTED" || row.status === "CANCELLED") && (
                      <span className="cell-subcopy">No action</span>
                    )}
                  </div>
                ),
                exportValue: (row) => row.status,
              },
            ]}
          />
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Employee readiness" eyebrow="Workforce records">
          {employees.length === 0 ? (
            <EmptyState
              tone="payroll"
              title="No employees yet"
              body="Add employees via the HR workspace. Readiness checks will appear once employees are created."
            />
          ) : (
            <DataTable
              title="Employees"
              tableId="payroll-employee-readiness"
              exportFileName="employees"
              rows={employees}
              searchValue={(row) => `${row.employeeNo} ${row.firstName} ${row.lastName} ${row.jobTitle ?? ""}`}
              advancedFilters={[
                { key: "status", label: "Status", type: "select", options: ["ACTIVE", "INACTIVE", "TERMINATED"].map((v) => ({ label: v, value: v })), getValue: (row) => row.status },
              ]}
              columns={[
                { key: "employeeNo", label: "No.", render: (row) => <strong>{row.employeeNo}</strong> },
                { key: "name", label: "Name", render: (row) => `${row.firstName} ${row.lastName}` },
                { key: "jobTitle", label: "Title", render: (row) => row.jobTitle ?? "—" },
                { key: "grossSalary", label: "Gross salary", className: "numeric", render: (row) => fmtCurrency(row.grossSalary) },
                { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
              ]}
            />
          )}
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
