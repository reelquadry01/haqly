"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { DateRangeControl } from "../../components/ui/date-range-control";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { useWorkspace } from "../../hooks/use-workspace";
import { defaultDateSelection, type ErpDateSelection } from "../../lib/date-range";
import {
  createTaxConfig,
  getAccountingAccounts,
  getTaxActivity,
  getTaxConfigs,
  getTaxDashboard,
  updateTaxConfig,
  type AccountingAccount,
  type TaxActivityRow,
  type TaxConfigRecord,
  type TaxDashboardResponse,
} from "../../lib/api";
import type { AppStatus, KpiMetric } from "../../lib/erp";

function formatPercent(value: string | number) {
  return `${Number(value).toFixed(2)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(value);
}

function todayRange() {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
  return { start, end };
}

const defaultRange = todayRange();

export default function TaxPage() {
  const { session, activeCompany, setPeriod } = useWorkspace();
  const [configs, setConfigs] = useState<TaxConfigRecord[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [dashboard, setDashboard] = useState<TaxDashboardResponse | null>(null);
  const [activity, setActivity] = useState<TaxActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Configure tax codes, account mapping, liability snapshots, and filing readiness from one tax control workspace.");
  const [dateSelection, setDateSelection] = useState<ErpDateSelection>(() => ({
    ...defaultDateSelection(),
    from: defaultRange.start,
    to: defaultRange.end,
    label: "Month to Date",
  }));
  const [draft, setDraft] = useState({
    code: "VAT",
    name: "Value Added Tax",
    taxType: "VAT",
    rate: 7.5,
    isInclusive: false,
    recoverable: true,
    filingFrequency: "MONTHLY",
    outputAccountId: 0,
    inputAccountId: 0,
    liabilityAccountId: 0,
  });
  const [selectedConfigId, setSelectedConfigId] = useState<number | "">("");
  const [editDraft, setEditDraft] = useState({
    code: "",
    name: "",
    taxType: "VAT",
    rate: 0,
    isInclusive: false,
    recoverable: false,
    filingFrequency: "MONTHLY",
    outputAccountId: 0,
    inputAccountId: 0,
    liabilityAccountId: 0,
  });

  async function loadTaxWorkspace(token: string, companyId: number) {
    setLoading(true);
    try {
      const [configRows, accountRows, dashboardRows, activityRows] = await Promise.all([
        getTaxConfigs(token, companyId),
        getAccountingAccounts(token),
        getTaxDashboard(token, companyId, { from: dateSelection.from, to: dateSelection.to }),
        getTaxActivity(token, companyId, { from: dateSelection.from, to: dateSelection.to }),
      ]);

      setConfigs(configRows);
      setAccounts(accountRows);
      setDashboard(dashboardRows);
      setActivity(activityRows);

      const first = configRows[0];
      setSelectedConfigId(first?.id ?? "");
      setEditDraft({
        code: first?.code ?? "",
        name: first?.name ?? "",
        taxType: first?.taxType ?? "VAT",
        rate: Number(first?.rate ?? 0),
        isInclusive: first?.isInclusive ?? false,
        recoverable: first?.recoverable ?? false,
        filingFrequency: first?.filingFrequency ?? "MONTHLY",
        outputAccountId: first?.outputAccountId ?? 0,
        inputAccountId: first?.inputAccountId ?? 0,
        liabilityAccountId: first?.liabilityAccountId ?? 0,
      });

      if (!draft.outputAccountId) {
        const outputVat = accountRows.find((account) => account.code === "2300");
        const inputVat = accountRows.find((account) => account.code === "1400");
        setDraft((current) => ({
          ...current,
          outputAccountId: outputVat?.id ?? current.outputAccountId,
          inputAccountId: inputVat?.id ?? current.inputAccountId,
          liabilityAccountId: outputVat?.id ?? current.liabilityAccountId,
        }));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load tax workspace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.token || !activeCompany?.id) {
      return;
    }
    void loadTaxWorkspace(session.token, activeCompany.id);
  }, [activeCompany?.id, dateSelection.from, dateSelection.to, session?.token]);

  const selectedConfig = configs.find((config) => config.id === selectedConfigId) ?? null;

  useEffect(() => {
    if (!selectedConfig) {
      return;
    }
    setEditDraft({
      code: selectedConfig.code,
      name: selectedConfig.name,
      taxType: selectedConfig.taxType ?? "VAT",
      rate: Number(selectedConfig.rate),
      isInclusive: selectedConfig.isInclusive,
      recoverable: selectedConfig.recoverable ?? false,
      filingFrequency: selectedConfig.filingFrequency ?? "MONTHLY",
      outputAccountId: selectedConfig.outputAccountId ?? 0,
      inputAccountId: selectedConfig.inputAccountId ?? 0,
      liabilityAccountId: selectedConfig.liabilityAccountId ?? 0,
    });
  }, [selectedConfig]);

  const metrics = useMemo<KpiMetric[]>(() => {
    const totals = dashboard?.totals ?? { outputTax: 0, inputTax: 0, netTax: 0, liabilityBalance: 0 };
    return [
      {
        label: "Output tax",
        value: formatCurrency(totals.outputTax),
        delta: `${dashboard?.configs.length ?? 0} codes`,
        trend: totals.outputTax > 0 ? "up" : "neutral",
        detail: "Tax collected on sales postings in the selected period",
      },
      {
        label: "Input tax",
        value: formatCurrency(totals.inputTax),
        delta: configs.some((config) => config.recoverable) ? "Recoverable tracked" : "No recoverable tax",
        trend: totals.inputTax > 0 ? "up" : "neutral",
        detail: "Tax recoverable on purchases and expenses",
      },
      {
        label: "Net liability",
        value: formatCurrency(totals.netTax),
        delta: totals.netTax > 0 ? "Payable position" : "Credit / offset position",
        trend: totals.netTax > 0 ? "down" : "up",
        detail: "Output tax less input tax for the selected period",
        status: (totals.netTax > 0 ? "Pending" : "Approved") as AppStatus,
      },
      {
        label: "Filing calendar",
        value: String(dashboard?.calendar.length ?? 0),
        delta: dashboard?.calendar[0]?.nextDueDate ? `Next due ${dashboard.calendar[0].nextDueDate.slice(0, 10)}` : "No schedules",
        trend: "neutral",
        detail: "Configured tax schedules ready for compliance tracking",
      },
    ];
  }, [configs, dashboard]);

  async function handleCreateTaxRule() {
    if (!session?.token || !activeCompany?.id) {
      setMessage("Choose an active company first.");
      return;
    }
    setSaving(true);
    try {
      await createTaxConfig(session.token, {
        companyId: activeCompany.id,
        code: draft.code.trim().toUpperCase(),
        name: draft.name.trim(),
        taxType: draft.taxType,
        rate: Number(draft.rate),
        isInclusive: draft.isInclusive,
        recoverable: draft.recoverable,
        filingFrequency: draft.filingFrequency,
        outputAccountId: draft.outputAccountId || undefined,
        inputAccountId: draft.inputAccountId || undefined,
        liabilityAccountId: draft.liabilityAccountId || undefined,
      });
      setMessage("Tax rule created and stored.");
      await loadTaxWorkspace(session.token, activeCompany.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create tax rule.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateTaxRule() {
    if (!session?.token || !activeCompany?.id || !selectedConfigId) {
      setMessage("Select a tax rule first.");
      return;
    }
    setSaving(true);
    try {
      await updateTaxConfig(session.token, Number(selectedConfigId), {
        code: editDraft.code.trim().toUpperCase(),
        name: editDraft.name.trim(),
        taxType: editDraft.taxType,
        rate: Number(editDraft.rate),
        isInclusive: editDraft.isInclusive,
        recoverable: editDraft.recoverable,
        filingFrequency: editDraft.filingFrequency,
        outputAccountId: editDraft.outputAccountId || undefined,
        inputAccountId: editDraft.inputAccountId || undefined,
        liabilityAccountId: editDraft.liabilityAccountId || undefined,
      });
      setMessage("Tax rule updated.");
      await loadTaxWorkspace(session.token, activeCompany.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update tax rule.");
    } finally {
      setSaving(false);
    }
  }

  const accountOptions = accounts.map((account) => (
    <option key={account.id} value={account.id}>
      {account.code} - {account.name}
    </option>
  ));

  return (
    <WorkspaceShell
      title="Tax"
      description="Manage tax codes, tax account mappings, liabilities, and compliance calendars for the active company."
      requiredRoles={["cfo", "accountant", "admin", "ceo"]}
      pageActions={
        <ModuleActionBar
          primaryAction={
            <button className="primary-button" type="button" onClick={() => document.getElementById("tax-new-rule")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              New tax rule
            </button>
          }
          summary="New tax rule setup stays visible. Refresh, filing review, and activity lookups are grouped above the workspace."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Refresh tax workspace",
                  description: "Reload tax codes, liabilities, and activity",
                  onSelect: () => session?.token && activeCompany?.id && loadTaxWorkspace(session.token, activeCompany.id),
                },
                {
                  label: "Tax code register",
                  description: "Jump to configured tax rules",
                  onSelect: () => document.getElementById("tax-code-register")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
            {
              label: "Reports",
              items: [
                {
                  label: "Filing calendar",
                  description: "Jump to filing readiness",
                  onSelect: () => document.getElementById("tax-filing-calendar")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Tax activity",
                  description: "Jump to tax postings and liability movement",
                  onSelect: () => document.getElementById("tax-activity")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
          ]}
        />
      }
    >
      <section className="kpi-grid">
        {metrics.map((metric) => (
          <KpiCard key={metric.label} metric={metric} tone="finance" />
        ))}
      </section>

      <SectionCard title="Tax reporting window" eyebrow="Compliance period">
        <DateRangeControl
          title="Tax period"
          value={dateSelection}
          onApply={(selection) => {
            setDateSelection(selection);
            setPeriod(selection.label);
          }}
          applyLabel={loading ? "Loading..." : "Apply period"}
        />
      </SectionCard>

      <section className="content-grid split-65">
        <SectionCard title="Tax code register" eyebrow="Master controls">
          <div id="tax-code-register" />
          {configs.length === 0 && !loading ? (
            <EmptyState
              tone="finance"
              title="No tax codes configured"
              body="Create VAT, withholding, or levy rules with account mapping so tax postings and reports stay deterministic."
            />
          ) : (
            <DataTable
              title="Tax codes"
              tableId="tax-codes"
              exportFileName="tax-codes"
              rows={configs.map((config) => ({
                id: String(config.id),
                code: config.code,
                name: config.name,
                type: config.taxType ?? "VAT",
                rate: Number(config.rate),
                basis: config.isInclusive ? "Inclusive" : "Exclusive",
                recoverable: config.recoverable ? "Yes" : "No",
                outputAccount: config.outputAccount ? `${config.outputAccount.code} - ${config.outputAccount.name}` : "Unmapped",
                inputAccount: config.inputAccount ? `${config.inputAccount.code} - ${config.inputAccount.name}` : "Unmapped",
                liabilityAccount: config.liabilityAccount ? `${config.liabilityAccount.code} - ${config.liabilityAccount.name}` : "Unmapped",
              }))}
              searchValue={(row) => `${row.code} ${row.name} ${row.type} ${row.outputAccount} ${row.inputAccount} ${row.liabilityAccount}`}
              filters={[
                { key: "inclusive", label: "Inclusive", predicate: (row) => row.basis === "Inclusive" },
                { key: "exclusive", label: "Exclusive", predicate: (row) => row.basis === "Exclusive" },
                { key: "recoverable", label: "Recoverable", predicate: (row) => row.recoverable === "Yes" },
              ]}
              advancedFilters={[
                { key: "taxCode", label: "Tax code", type: "text", getValue: (row) => row.code },
                {
                  key: "taxType",
                  label: "Tax type",
                  type: "select",
                  getValue: (row) => row.type,
                  options: [...new Set(configs.map((config) => config.taxType ?? "VAT"))].map((value) => ({ value, label: value })),
                },
                { key: "rate", label: "Rate (%)", type: "number-range", getValue: (row) => row.rate },
                { key: "outputAccount", label: "Output account", type: "text", getValue: (row) => row.outputAccount },
              ]}
              bulkActions={["Export", "Review"]}
              columns={[
                { key: "code", label: "Code", render: (row) => <strong>{row.code}</strong> },
                { key: "name", label: "Rule", render: (row) => row.name },
                { key: "type", label: "Type", render: (row) => row.type },
                { key: "rate", label: "Rate", className: "numeric", render: (row) => formatPercent(row.rate) },
                { key: "basis", label: "Basis", render: (row) => <StatusBadge status={(row.basis === "Inclusive" ? "Approved" : "Draft") as AppStatus} /> },
                { key: "outputAccount", label: "Output account", render: (row) => row.outputAccount },
                { key: "inputAccount", label: "Input account", render: (row) => row.inputAccount },
                { key: "liabilityAccount", label: "Liability account", render: (row) => row.liabilityAccount },
              ]}
            />
          )}
        </SectionCard>

        <SectionCard title="Create tax code" eyebrow="Setup action">
          <div className="action-form-stack" id="tax-new-rule">
            <label className="field">
              <span>Tax code</span>
              <input value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} />
            </label>
            <label className="field">
              <span>Tax name</span>
              <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="field">
              <span>Tax type</span>
              <select className="select-input" value={draft.taxType} onChange={(event) => setDraft((current) => ({ ...current, taxType: event.target.value }))}>
                <option value="VAT">VAT</option>
                <option value="WITHHOLDING">Withholding</option>
                <option value="LEVY">Levy</option>
              </select>
            </label>
            <label className="field">
              <span>Rate (%)</span>
              <input type="number" value={draft.rate} onChange={(event) => setDraft((current) => ({ ...current, rate: Number(event.target.value) }))} />
            </label>
            <label className="field">
              <span>Filing frequency</span>
              <select className="select-input" value={draft.filingFrequency} onChange={(event) => setDraft((current) => ({ ...current, filingFrequency: event.target.value }))}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </label>
            <label className="field">
              <span>Output tax account</span>
              <select className="select-input" value={draft.outputAccountId} onChange={(event) => setDraft((current) => ({ ...current, outputAccountId: Number(event.target.value) }))}>
                <option value={0}>Select account</option>
                {accountOptions}
              </select>
            </label>
            <label className="field">
              <span>Input tax account</span>
              <select className="select-input" value={draft.inputAccountId} onChange={(event) => setDraft((current) => ({ ...current, inputAccountId: Number(event.target.value) }))}>
                <option value={0}>Select account</option>
                {accountOptions}
              </select>
            </label>
            <label className="field">
              <span>Liability account</span>
              <select className="select-input" value={draft.liabilityAccountId} onChange={(event) => setDraft((current) => ({ ...current, liabilityAccountId: Number(event.target.value) }))}>
                <option value={0}>Select account</option>
                {accountOptions}
              </select>
            </label>
            <label className="checkbox-field">
              <input type="checkbox" checked={draft.isInclusive} onChange={(event) => setDraft((current) => ({ ...current, isInclusive: event.target.checked }))} />
              <span>Tax is inclusive in price</span>
            </label>
            <label className="checkbox-field">
              <input type="checkbox" checked={draft.recoverable} onChange={(event) => setDraft((current) => ({ ...current, recoverable: event.target.checked }))} />
              <span>Recoverable tax</span>
            </label>
            <div className="inline-actions compact-end">
              <button className="primary-button" type="button" onClick={handleCreateTaxRule} disabled={saving}>
                {saving ? "Saving..." : "Create tax code"}
              </button>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Tax liability summary" eyebrow="Period analytics">
          {dashboard?.configs.length ? (
            <DataTable
              title="Tax summary"
              tableId="tax-summary"
              exportFileName="tax-summary"
              rows={dashboard.configs.map((row) => ({
                id: String(row.id),
                code: row.code,
                name: row.name,
                outputTax: row.outputTax,
                inputTax: row.inputTax,
                netTax: row.netTax,
                liabilityBalance: row.liabilityBalance,
              }))}
              searchValue={(row) => `${row.code} ${row.name}`}
              advancedFilters={[
                { key: "taxCode", label: "Tax code", type: "text", getValue: (row) => row.code },
                { key: "outputTax", label: "Output tax", type: "number-range", getValue: (row) => row.outputTax },
                { key: "inputTax", label: "Input tax", type: "number-range", getValue: (row) => row.inputTax },
                { key: "liability", label: "Liability", type: "number-range", getValue: (row) => row.liabilityBalance },
              ]}
              bulkActions={["Export", "Review"]}
              columns={[
                { key: "code", label: "Code", render: (row) => <strong>{row.code}</strong> },
                { key: "name", label: "Tax", render: (row) => row.name },
                { key: "outputTax", label: "Output", className: "numeric", render: (row) => formatCurrency(row.outputTax) },
                { key: "inputTax", label: "Input", className: "numeric", render: (row) => formatCurrency(row.inputTax) },
                { key: "netTax", label: "Net", className: "numeric", render: (row) => formatCurrency(row.netTax) },
                { key: "liabilityBalance", label: "Liability", className: "numeric", render: (row) => formatCurrency(row.liabilityBalance) },
              ]}
            />
          ) : (
            <EmptyState tone="finance" title="No tax movement yet" body="Once tax-mapped transactions post, liability and recovery figures will show here." />
          )}
        </SectionCard>

        <SectionCard title="Update selected tax code" eyebrow="Maintenance">
          {selectedConfig ? (
            <div className="action-form-stack">
              <label className="field">
                <span>Select code</span>
                <select className="select-input" value={selectedConfigId} onChange={(event) => setSelectedConfigId(event.target.value ? Number(event.target.value) : "")}>
                  {configs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.code} - {config.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tax code</span>
                <input value={editDraft.code} onChange={(event) => setEditDraft((current) => ({ ...current, code: event.target.value }))} />
              </label>
              <label className="field">
                <span>Tax name</span>
                <input value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="field">
                <span>Rate (%)</span>
                <input type="number" value={editDraft.rate} onChange={(event) => setEditDraft((current) => ({ ...current, rate: Number(event.target.value) }))} />
              </label>
              <label className="field">
                <span>Output tax account</span>
                <select className="select-input" value={editDraft.outputAccountId} onChange={(event) => setEditDraft((current) => ({ ...current, outputAccountId: Number(event.target.value) }))}>
                  <option value={0}>Select account</option>
                  {accountOptions}
                </select>
              </label>
              <label className="field">
                <span>Input tax account</span>
                <select className="select-input" value={editDraft.inputAccountId} onChange={(event) => setEditDraft((current) => ({ ...current, inputAccountId: Number(event.target.value) }))}>
                  <option value={0}>Select account</option>
                  {accountOptions}
                </select>
              </label>
              <label className="field">
                <span>Liability account</span>
                <select className="select-input" value={editDraft.liabilityAccountId} onChange={(event) => setEditDraft((current) => ({ ...current, liabilityAccountId: Number(event.target.value) }))}>
                  <option value={0}>Select account</option>
                  {accountOptions}
                </select>
              </label>
              <label className="checkbox-field">
                <input type="checkbox" checked={editDraft.isInclusive} onChange={(event) => setEditDraft((current) => ({ ...current, isInclusive: event.target.checked }))} />
                <span>Tax is inclusive in price</span>
              </label>
              <label className="checkbox-field">
                <input type="checkbox" checked={editDraft.recoverable} onChange={(event) => setEditDraft((current) => ({ ...current, recoverable: event.target.checked }))} />
                <span>Recoverable tax</span>
              </label>
              <div className="inline-actions compact-end">
                <button className="ghost-button" type="button" onClick={handleUpdateTaxRule} disabled={saving}>
                  Update tax code
                </button>
              </div>
            </div>
          ) : (
            <EmptyState tone="finance" title="No tax code selected" body="Create a tax code first, then edit it here." />
          )}
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Filing calendar" eyebrow="Compliance schedule">
          <div id="tax-filing-calendar" />
          {dashboard?.calendar.length ? (
            <DataTable
              title="Tax filing calendar"
              tableId="tax-calendar"
              exportFileName="tax-calendar"
              rows={dashboard.calendar.map((item, index) => ({
                id: `${item.code}-${index}`,
                code: item.code,
                name: item.name,
                filingFrequency: item.filingFrequency,
                nextDueDate: item.nextDueDate.slice(0, 10),
                rawNextDueDate: item.nextDueDate,
                status: item.status,
              }))}
              searchValue={(row) => `${row.code} ${row.name} ${row.filingFrequency}`}
              advancedFilters={[
                { key: "taxCode", label: "Tax code", type: "text", getValue: (row) => row.code },
                {
                  key: "frequency",
                  label: "Frequency",
                  type: "select",
                  getValue: (row) => row.filingFrequency,
                  options: [...new Set(dashboard.calendar.map((item) => item.filingFrequency))].map((value) => ({ value, label: value })),
                },
                {
                  key: "status",
                  label: "Status",
                  type: "select",
                  getValue: (row) => row.status,
                  options: [...new Set(dashboard.calendar.map((item) => item.status))].map((value) => ({ value, label: value })),
                },
                { key: "nextDueDate", label: "Next due date", type: "date-range", getValue: (row) => row.rawNextDueDate },
              ]}
              bulkActions={["Export", "Review"]}
              columns={[
                { key: "code", label: "Code", render: (row) => <strong>{row.code}</strong> },
                { key: "name", label: "Tax", render: (row) => row.name },
                { key: "filingFrequency", label: "Frequency", render: (row) => row.filingFrequency },
                { key: "nextDueDate", label: "Next due", render: (row) => row.nextDueDate },
                { key: "status", label: "Status", render: (row) => <StatusBadge status={(row.status === "DUE" ? "Pending" : "Draft") as AppStatus} /> },
              ]}
            />
          ) : (
            <EmptyState tone="finance" title="No filing schedules yet" body="Create tax codes with filing frequencies to build the filing calendar." />
          )}
        </SectionCard>

        <SectionCard title="Tax activity" eyebrow="Recent postings">
          <div id="tax-activity" />
          {activity.length ? (
            <DataTable
              title="Tax activity"
              tableId="tax-activity"
              exportFileName="tax-activity"
              rows={activity.map((row) => ({
                id: String(row.id),
                date: row.date.slice(0, 10),
                rawDate: row.date,
                reference: row.reference,
                taxCode: row.taxCode,
                bucket: row.bucket,
                account: row.account,
                debit: row.debit,
                credit: row.credit,
                net: row.net,
              }))}
              searchValue={(row) => `${row.reference} ${row.taxCode} ${row.bucket} ${row.account}`}
              advancedFilters={[
                { key: "reference", label: "Reference", type: "text", getValue: (row) => row.reference },
                { key: "taxCode", label: "Tax code", type: "text", getValue: (row) => row.taxCode },
                {
                  key: "bucket",
                  label: "Bucket",
                  type: "select",
                  getValue: (row) => row.bucket,
                  options: [...new Set(activity.map((item) => item.bucket))].map((value) => ({ value, label: value })),
                },
                { key: "date", label: "Posting date", type: "date-range", getValue: (row) => row.rawDate },
                { key: "net", label: "Net amount", type: "number-range", getValue: (row) => row.net },
              ]}
              bulkActions={["Export", "Review"]}
              columns={[
                { key: "date", label: "Date", render: (row) => row.date },
                { key: "reference", label: "Reference", render: (row) => <strong>{row.reference}</strong> },
                { key: "taxCode", label: "Tax code", render: (row) => row.taxCode },
                { key: "bucket", label: "Bucket", render: (row) => row.bucket },
                { key: "account", label: "Account", render: (row) => row.account },
                { key: "debit", label: "Debit", className: "numeric", render: (row) => formatCurrency(row.debit) },
                { key: "credit", label: "Credit", className: "numeric", render: (row) => formatCurrency(row.credit) },
                { key: "net", label: "Net", className: "numeric", render: (row) => formatCurrency(row.net) },
              ]}
            />
          ) : (
            <EmptyState tone="finance" title="No tax activity yet" body="Tax-linked journal lines will appear here after sales, purchases, or manual tax entries post." />
          )}
          <p className="note">{message}</p>
        </SectionCard>
      </section>
    </WorkspaceShell>
  );
}
