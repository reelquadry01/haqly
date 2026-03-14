"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { ActivityTimeline } from "../../components/ui/activity-timeline";
import { DataTable } from "../../components/ui/data-table";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { ProcessArchitecturePanel } from "../../components/ui/process-architecture-panel";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { useWorkspace } from "../../hooks/use-workspace";
import {
  createAccountingJournal,
  getAccountingAccounts,
  getAccountingJournals,
  getAccountingVouchers,
  getJournalMetadata,
  getPurchaseBills,
  getSalesInvoices,
  type AccountingAccount,
  type AccountingJournal,
  type AccountingVoucher,
  type JournalMetadataResponse,
  type PurchaseBillRecord,
  type SalesInvoiceRecord,
} from "../../lib/api";
import { financeViews, type AppStatus, type KpiMetric, type TimelineItem } from "../../lib/erp";
import { buildFinanceWorkflow } from "../../lib/process-flows";

type JournalLineDraft = {
  id: string;
  accountId: number | "";
  memo: string;
  debit: number;
  credit: number;
};

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value;
  }
  return Number(value ?? 0);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function FinancePage() {
  const { session, activeBranch, activeCompany } = useWorkspace();
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [journals, setJournals] = useState<AccountingJournal[]>([]);
  const [vouchers, setVouchers] = useState<AccountingVoucher[]>([]);
  const [metadata, setMetadata] = useState<JournalMetadataResponse | null>(null);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoiceRecord[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [header, setHeader] = useState({
    reference: "PAY-ACCRUAL-MAR",
    description: "Monthly payroll accrual",
    status: "Draft" as AppStatus,
    date: new Date().toISOString().slice(0, 10),
  });
  const [lines, setLines] = useState<JournalLineDraft[]>([
    { id: "1", accountId: "", memo: "Monthly payroll accrual", debit: 84200, credit: 0 },
    { id: "2", accountId: "", memo: "Monthly payroll accrual", debit: 0, credit: 84200 },
  ]);
  const [formMessage, setFormMessage] = useState("");

  async function loadFinanceData(token: string) {
    setLoading(true);
    setLoadError("");
    try {
      const [accountRecords, journalRecords, voucherRecords, metadataRow, salesRows, purchaseRows] = await Promise.all([
        getAccountingAccounts(token),
        getAccountingJournals(token),
        getAccountingVouchers(token),
        activeCompany?.id ? getJournalMetadata(token, activeCompany.id) : Promise.resolve(null),
        getSalesInvoices(token, activeCompany?.id),
        getPurchaseBills(token, activeCompany?.id),
      ]);
      setAccounts(accountRecords);
      setJournals(journalRecords);
      setVouchers(voucherRecords);
      setMetadata(metadataRow);
      setSalesInvoices(salesRows);
      setPurchaseBills(purchaseRows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load finance data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.token) {
      return;
    }
    void loadFinanceData(session.token);
  }, [activeCompany?.id, session?.token]);

  useEffect(() => {
    if (accounts.length === 0) {
      return;
    }

    setLines((current) => {
      const hasAccountSelection = current.some((line) => line.accountId !== "");
      if (hasAccountSelection) {
        return current;
      }
      const payrollExpense = accounts.find((account) => account.code === "6100")?.id ?? accounts[0]?.id ?? "";
      const accruedPayroll = accounts.find((account) => account.code === "2100")?.id ?? accounts[1]?.id ?? accounts[0]?.id ?? "";
      return current.map((line, index) => ({
        ...line,
        accountId: index === 0 ? payrollExpense : accruedPayroll,
      }));
    });
  }, [accounts]);

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    return { debit, credit, balanced: debit === credit && debit > 0 };
  }, [lines]);

  const journalRows = useMemo(() => {
    return journals.map((journal) => {
      const amount = journal.lines.reduce((sum, line) => sum + toNumber(line.debit), 0);
      return {
        id: String(journal.id),
        reference: journal.reference,
        date: formatDate(journal.date),
        rawDate: journal.date,
        description: journal.description || "No description",
        type: journal.type,
        lineCount: journal.lines.length,
        amount: formatCurrency(amount),
        rawAmount: amount,
        status: "Posted" as AppStatus,
      };
    });
  }, [journals]);

  const voucherRows = useMemo(() => {
    return vouchers.map((voucher) => ({
      id: String(voucher.id),
      reference: voucher.reference,
      type: voucher.type,
      payee: voucher.payee || "No payee",
      date: formatDate(voucher.date),
      amount: formatCurrency(toNumber(voucher.amount)),
      rawDate: voucher.date,
      rawAmount: toNumber(voucher.amount),
    }));
  }, [vouchers]);

  const accountRows = useMemo(() => {
    return accounts.map((account) => ({
      id: String(account.id),
      code: account.code,
      name: account.name,
      type: account.type,
      description: account.description || "No description",
      parent: accounts.find((candidate) => candidate.id === account.parentId)?.name || "-",
    }));
  }, [accounts]);

  const ledgerRows = useMemo(() => {
    const accountMap = new Map(accounts.map((account) => [account.id, account]));
    return journals.flatMap((journal) =>
      journal.lines.map((line) => {
        const account = accountMap.get(line.accountId);
      return {
          id: `${journal.id}-${line.id}`,
          date: formatDate(journal.date),
          rawDate: journal.date,
          reference: journal.reference,
          description: journal.description || line.memo || journal.type,
          account: account ? `${account.code} - ${account.name}` : `Account ${line.accountId}`,
          debit: toNumber(line.debit),
          credit: toNumber(line.credit),
          branch: line.branchId ? `Branch ${line.branchId}` : activeBranch?.name || "-",
        };
      }),
    );
  }, [accounts, activeBranch?.name, journals]);

  const financeMetrics = useMemo<KpiMetric[]>(() => {
    const journalValue = journals.reduce((sum, journal) => {
      return sum + journal.lines.reduce((lineTotal, line) => lineTotal + toNumber(line.debit), 0);
    }, 0);
    const latestJournalDate = journals[0]?.date ? formatDate(journals[0].date) : "No postings yet";
    const voucherValue = vouchers.reduce((sum, voucher) => sum + toNumber(voucher.amount), 0);

    return [
      {
        label: "Chart of accounts",
        value: String(accounts.length),
        delta: accounts.length > 0 ? "Live from API" : "No accounts",
        trend: accounts.length > 0 ? "up" : "neutral",
        detail: "Accounts available for posting",
      },
      {
        label: "Posted journals",
        value: String(journals.length),
        delta: latestJournalDate,
        trend: journals.length > 0 ? "up" : "neutral",
        detail: "Journal entries returned by the live ledger",
      },
      {
        label: "Journal value",
        value: formatCurrency(journalValue),
        delta: `${journals.length} entries`,
        trend: journalValue > 0 ? "up" : "neutral",
        detail: "Debit total across live journal entries",
      },
      {
        label: "Vouchers posted",
        value: formatCurrency(voucherValue),
        delta: `${vouchers.length} vouchers`,
        trend: vouchers.length > 0 ? "up" : "neutral",
        detail: "Voucher value returned from the API",
      },
    ];
  }, [accounts.length, journals, vouchers]);

  const processBlueprint = useMemo(
    () =>
      buildFinanceWorkflow({
        accountCount: accounts.length,
        openPeriodCount: metadata?.periods.filter((period) => period.status === "OPEN").length ?? 0,
        journalCount: journals.length,
        salesDocumentCount: salesInvoices.length,
        purchaseDocumentCount: purchaseBills.length,
      }),
    [accounts.length, journals.length, metadata?.periods, purchaseBills.length, salesInvoices.length],
  );

  const timelineItems = useMemo<TimelineItem[]>(() => {
    return journals.slice(0, 4).map((journal) => ({
      id: String(journal.id),
      title: journal.reference,
      subtitle: journal.description || journal.type,
      timestamp: formatDate(journal.updatedAt || journal.date),
      user: journal.type,
      status: "Posted",
    }));
  }, [journals]);

  function updateLine(id: string, patch: Partial<JournalLineDraft>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [...current, { id: String(Date.now()), accountId: "", memo: "", debit: 0, credit: 0 }]);
  }

  function saveDraft() {
    window.localStorage.setItem(
      "haqly.finance.journalDraft",
      JSON.stringify({
        header,
        lines,
      }),
    );
    setFormMessage("Draft stored only in this browser. It has not been posted or saved to the ERP database.");
  }

  async function submitDraft() {
    if (!session?.token) {
      setFormMessage("You need an active session before posting.");
      return;
    }

    if (!totals.balanced) {
      setFormMessage("Journal remains out of balance. Your draft is preserved so you can continue editing.");
      return;
    }

    if (lines.some((line) => line.accountId === "")) {
      setFormMessage("Every journal line needs an account.");
      return;
    }

    setSaving(true);
    setFormMessage("");
    try {
      await createAccountingJournal(session.token, {
        reference: header.reference || undefined,
        description: header.description || undefined,
        date: header.date,
        lines: lines.map((line) => ({
          accountId: Number(line.accountId),
          branchId: activeBranch?.id,
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
          memo: line.memo || undefined,
        })),
      });
      setFormMessage("Journal posted successfully. Live ledger refreshed.");
      await loadFinanceData(session.token);
      setHeader((current) => ({ ...current, reference: "", description: "", status: "Draft" }));
      setLines([
        { id: String(Date.now()), accountId: accounts.find((account) => account.code === "6100")?.id ?? "", memo: "", debit: 0, credit: 0 },
        { id: String(Date.now() + 1), accountId: accounts.find((account) => account.code === "2100")?.id ?? "", memo: "", debit: 0, credit: 0 },
      ]);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Could not post journal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceShell
      title="Finance"
      description="Live general-ledger activity, voucher visibility, and journal posting in one finance workspace."
      requiredRoles={["cfo", "accountant", "admin", "ceo"]}
      tabs={financeViews}
      activeTab="Dashboard"
      pageActions={
        <ModuleActionBar
          primaryAction={
            <button className="primary-button" type="button" onClick={submitDraft} disabled={saving}>
              {saving ? "Posting..." : "Post journal"}
            </button>
          }
          summary="Posting stays visible. Validation, exports, and report access now sit in grouped menus above the workspace."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Refresh ledger",
                  description: "Reload accounts, journals, and vouchers",
                  onSelect: () => session?.token && loadFinanceData(session.token),
                },
                {
                  label: "Store browser draft",
                  description: "Preserve the current journal only on this device",
                  onSelect: saveDraft,
                },
                {
                  label: "Add journal line",
                  description: "Insert another posting row",
                  onSelect: addLine,
                },
              ],
            },
            {
              label: "Reports",
              items: [
                {
                  label: "Trial Balance",
                  description: "Open grouped trial balance",
                  href: "/reports?view=Trial%20Balance",
                },
                {
                  label: "Account Statements",
                  description: "Review account movement and balances",
                  href: "/reports?view=Account%20Statement",
                },
                {
                  label: "Tax workspace",
                  description: "VAT and filing controls",
                  href: "/tax",
                },
              ],
            },
            {
              label: "More",
              items: [
                {
                  label: "Chart of Accounts",
                  description: "Jump to account structure review",
                  href: "/finance?view=Dashboard",
                },
                {
                  label: "Voucher feed",
                  description: "Review posted voucher activity",
                  onSelect: () => document.getElementById("finance-vouchers-section")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
          ]}
        />
      }
    >
      <ProcessArchitecturePanel
        blueprint={processBlueprint}
        checklistActions={{
          "fin-coa": {
            label: accounts.length ? "Review COA" : "Import accounts",
            href: accounts.length ? "/finance#finance-chart-of-accounts" : "/administration?view=Import%20%26%20Export",
          },
          "fin-periods": {
            label: metadata?.periods.some((period) => period.status === "OPEN") ? "Review fiscal year" : "Open period",
            href: "/administration?view=System%20Settings",
          },
          "fin-subledgers": {
            label: salesInvoices.length + purchaseBills.length ? "Review source docs" : "Open operations",
            href: salesInvoices.length + purchaseBills.length ? "/reports" : "/dashboard",
          },
        }}
        nextActions={[
          {
            id: "fin-next-journal",
            label: "Open Journal Entry workspace",
            detail: "Use the finance-controlled journal workspace for approval-aware manual posting.",
            href: "/journal-entries",
          },
          {
            id: "fin-next-trial-balance",
            label: "Review Trial Balance",
            detail: "Move from posted entries into trial balance and financial statement review.",
            href: "/reports?view=Trial%20Balance",
          },
          {
            id: "fin-next-operations",
            label: "Trace source transactions",
            detail: "Review sales and procurement records that should be feeding receivables and payables.",
            href: "/dashboard",
          },
        ]}
      />

      <section className="kpi-grid">
        {financeMetrics.map((metric) => (
          <KpiCard key={metric.label} metric={metric} tone="finance" />
        ))}
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Journal queue" eyebrow="Live accounting records">
          <DataTable
            title="Journal entries"
            tableId="finance-journals"
            exportFileName="finance-journals"
            rows={journalRows}
            searchValue={(row) => `${row.reference} ${row.description} ${row.type}`}
            filters={[
              { key: "general", label: "General", predicate: (row) => row.type === "GENERAL" },
              { key: "recent", label: "Latest 7 days", predicate: (row) => journals.find((journal) => String(journal.id) === row.id && new Date(journal.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) !== undefined },
            ]}
            advancedFilters={[
              { key: "type", label: "Journal type", type: "select", options: [...new Set(journalRows.map((row) => row.type))].map((value) => ({ label: value, value })), getValue: (row) => row.type },
              { key: "reference", label: "Reference", type: "text", placeholder: "Filter by journal reference", getValue: (row) => row.reference },
              { key: "date", label: "Journal date", type: "date-range", getValue: (row) => row.rawDate },
              { key: "amount", label: "Amount", type: "number-range", minPlaceholder: "Min amount", maxPlaceholder: "Max amount", getValue: (row) => row.rawAmount },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF", "Review", "Open detail"]}
            emptyTitle={loading ? "Loading journals" : "No journals yet"}
            emptyMessage={loading ? "Pulling live journal entries from the API." : "Post a journal to populate the ledger queue."}
            columns={[
              { key: "reference", label: "Journal", render: (row) => <div><strong>{row.reference}</strong><p className="cell-subcopy">{row.type}</p></div>, exportValue: (row) => `${row.reference} (${row.type})` },
              { key: "date", label: "Date", render: (row) => row.date, exportValue: (row) => row.date },
              { key: "description", label: "Description", render: (row) => row.description, exportValue: (row) => row.description },
              { key: "lineCount", label: "Lines", className: "numeric", render: (row) => row.lineCount, exportValue: (row) => row.lineCount },
              { key: "amount", label: "Amount", className: "numeric", render: (row) => row.amount, exportValue: (row) => row.amount },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} />, exportValue: (row) => row.status },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Journal entry workbench"
          eyebrow="Live posting to backend"
        >
          {accounts.length === 0 && !loading ? (
            <EmptyState tone="finance" title="No accounts available" body="Create chart-of-account records first, then post journals from this workspace." />
          ) : (
            <>
              <div className="form-grid two-up">
                <label className="field">
                  <span>Reference</span>
                  <input value={header.reference} onChange={(event) => setHeader((current) => ({ ...current, reference: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Posting date</span>
                  <input type="date" value={header.date} onChange={(event) => setHeader((current) => ({ ...current, date: event.target.value }))} />
                </label>
              </div>
              <label className="field">
                <span>Description</span>
                <input value={header.description} onChange={(event) => setHeader((current) => ({ ...current, description: event.target.value }))} />
              </label>

              <div className="line-grid">
                <div className="line-grid__header">
                  <span>Account</span>
                  <span>Memo</span>
                  <span>Debit</span>
                  <span>Credit</span>
                </div>
                {lines.map((line) => (
                  <div key={line.id} className="line-grid__row">
                    <select
                      className="select-input"
                      value={line.accountId}
                      onChange={(event) =>
                        updateLine(line.id, { accountId: event.target.value ? Number(event.target.value) : "" })
                      }
                    >
                      <option value="">Select account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                    <input value={line.memo} onChange={(event) => updateLine(line.id, { memo: event.target.value })} />
                    <input value={line.debit} type="number" onChange={(event) => updateLine(line.id, { debit: Number(event.target.value) })} />
                    <input value={line.credit} type="number" onChange={(event) => updateLine(line.id, { credit: Number(event.target.value) })} />
                  </div>
                ))}
              </div>

              <div className="inline-actions compact-end">
                <button className="ghost-button" type="button" onClick={addLine}>Add line</button>
                <div className="totals-panel slim">
                  <div><span>Debit</span><strong>{formatCurrency(totals.debit)}</strong></div>
                  <div><span>Credit</span><strong>{formatCurrency(totals.credit)}</strong></div>
                  <div><span>Balance</span><strong>{totals.balanced ? "Balanced" : "Out of balance"}</strong></div>
                </div>
              </div>
            </>
          )}

          {formMessage ? <div className="banner warning">{formMessage}</div> : null}
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Voucher feed" eyebrow="Live vouchers">
          <div id="finance-vouchers-section" />
          <DataTable
            title="Voucher activity"
            tableId="finance-vouchers"
            exportFileName="finance-vouchers"
            rows={voucherRows}
            searchValue={(row) => `${row.reference} ${row.type} ${row.payee}`}
            filters={[
              { key: "payment", label: "Payments", predicate: (row) => row.type === "PAYMENT" },
              { key: "receipt", label: "Receipts", predicate: (row) => row.type === "RECEIPT" },
            ]}
            advancedFilters={[
              { key: "type", label: "Voucher type", type: "select", options: [...new Set(voucherRows.map((row) => row.type))].map((value) => ({ label: value, value })), getValue: (row) => row.type },
              { key: "payee", label: "Payee", type: "text", placeholder: "Filter by payee", getValue: (row) => row.payee },
              { key: "date", label: "Voucher date", type: "date-range", getValue: (row) => row.rawDate },
              { key: "amount", label: "Amount", type: "number-range", minPlaceholder: "Min amount", maxPlaceholder: "Max amount", getValue: (row) => row.rawAmount },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF", "Review"]}
            emptyTitle={loading ? "Loading vouchers" : "No vouchers yet"}
            emptyMessage={loading ? "Pulling live vouchers from the API." : "Post a voucher from the API or another module to see activity here."}
            columns={[
              { key: "reference", label: "Reference", render: (row) => <strong>{row.reference}</strong>, exportValue: (row) => row.reference },
              { key: "type", label: "Type", render: (row) => row.type, exportValue: (row) => row.type },
              { key: "payee", label: "Payee", render: (row) => row.payee, exportValue: (row) => row.payee },
              { key: "date", label: "Date", render: (row) => row.date, exportValue: (row) => row.date },
              { key: "amount", label: "Amount", className: "numeric", render: (row) => row.amount, exportValue: (row) => row.amount },
            ]}
          />
        </SectionCard>

        <SectionCard title="Ledger activity" eyebrow="Recent updates">
          {timelineItems.length > 0 ? (
            <ActivityTimeline items={timelineItems} />
          ) : (
            <EmptyState tone="finance" title="No activity yet" body="Recent journal activity will appear here once entries exist in the live ledger." />
          )}
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="General Ledger (GL)" eyebrow="Line-level posting detail">
          <DataTable
            title="General ledger detail"
            tableId="finance-general-ledger"
            exportFileName="finance-general-ledger"
            rows={ledgerRows}
            searchValue={(row) => `${row.reference} ${row.description} ${row.account}`}
            filters={[
              { key: "debits", label: "Debits", predicate: (row) => row.debit > 0 },
              { key: "credits", label: "Credits", predicate: (row) => row.credit > 0 },
            ]}
            advancedFilters={[
              { key: "account", label: "Account", type: "text", placeholder: "Filter by account", getValue: (row) => row.account },
              { key: "branch", label: "Branch", type: "select", options: [...new Set(ledgerRows.map((row) => row.branch))].map((value) => ({ label: value, value })), getValue: (row) => row.branch },
              { key: "date", label: "Posting date", type: "date-range", getValue: (row) => row.rawDate },
              { key: "debit", label: "Debit range", type: "number-range", minPlaceholder: "Min debit", maxPlaceholder: "Max debit", getValue: (row) => row.debit },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF", "Review"]}
            emptyTitle={loading ? "Loading general ledger" : "No ledger lines yet"}
            emptyMessage={loading ? "Pulling line-level journal postings from the live ledger." : "Post journals and vouchers to start building the general ledger detail."}
            columns={[
              { key: "date", label: "Date", render: (row) => row.date, exportValue: (row) => row.date },
              { key: "reference", label: "Reference", render: (row) => <strong>{row.reference}</strong>, exportValue: (row) => row.reference },
              { key: "description", label: "Description", render: (row) => row.description, exportValue: (row) => row.description },
              { key: "account", label: "Account", render: (row) => row.account, exportValue: (row) => row.account },
              { key: "debit", label: "Debit", className: "numeric", render: (row) => formatCurrency(row.debit), exportValue: (row) => row.debit },
              { key: "credit", label: "Credit", className: "numeric", render: (row) => formatCurrency(row.credit), exportValue: (row) => row.credit },
            ]}
          />
        </SectionCard>

        <SectionCard title="Chart of Accounts (COA)" eyebrow="Exportable account directory">
          <div id="finance-chart-of-accounts" />
          <DataTable
            title="Chart of accounts"
            tableId="finance-chart-of-accounts"
            exportFileName="chart-of-accounts"
            rows={accountRows}
            searchValue={(row) => `${row.code} ${row.name} ${row.type} ${row.description}`}
            filters={[
              { key: "assets", label: "Assets", predicate: (row) => row.type === "ASSET" },
              { key: "liabilities", label: "Liabilities", predicate: (row) => row.type === "LIABILITY" },
              { key: "expenses", label: "Expenses", predicate: (row) => row.type === "EXPENSE" },
            ]}
            advancedFilters={[
              { key: "type", label: "Account type", type: "select", options: [...new Set(accountRows.map((row) => row.type))].map((value) => ({ label: value, value })), getValue: (row) => row.type },
              { key: "code", label: "Account code", type: "text", placeholder: "Filter by code", getValue: (row) => row.code },
              { key: "parent", label: "Parent account", type: "text", placeholder: "Filter by parent", getValue: (row) => row.parent },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF", "Review"]}
            emptyTitle={loading ? "Loading chart of accounts" : "No accounts found"}
            emptyMessage={loading ? "Pulling the live chart of accounts from the API." : "Create chart-of-account records to support live journal posting."}
            columns={[
              { key: "code", label: "Code", render: (row) => <strong>{row.code}</strong>, exportValue: (row) => row.code },
              { key: "name", label: "Account", render: (row) => row.name, exportValue: (row) => row.name },
              { key: "type", label: "Type", render: (row) => row.type, exportValue: (row) => row.type },
              { key: "parent", label: "Parent", render: (row) => row.parent, exportValue: (row) => row.parent },
              { key: "description", label: "Description", render: (row) => row.description, exportValue: (row) => row.description },
            ]}
          />
        </SectionCard>
      </section>

      <section className="content-grid thirds">
        <SectionCard title="Posting control" eyebrow="Current branch context">
          <div className="checklist">
            <label><input type="checkbox" checked={Boolean(activeBranch)} readOnly /> Posting branch selected</label>
            <label><input type="checkbox" checked={accounts.length > 1} readOnly /> Minimum chart of accounts available</label>
            <label><input type="checkbox" checked={journals.length > 0} readOnly /> Live ledger has posted entries</label>
            <label><input type="checkbox" checked={vouchers.length > 0} readOnly /> Voucher feed connected</label>
          </div>
        </SectionCard>

        <SectionCard title="Finance data state" eyebrow="Integration status">
          <div className="alert-list compact">
            <article className="alert-row info">
              <div>
                <strong>Accounts endpoint</strong>
                <p>{accounts.length} account records loaded from the API.</p>
              </div>
            </article>
            <article className="alert-row info">
              <div>
                <strong>Journals endpoint</strong>
                <p>{journals.length} live journal entries available.</p>
              </div>
            </article>
            <article className="alert-row info">
              <div>
                <strong>Vouchers endpoint</strong>
                <p>{vouchers.length} live vouchers available.</p>
              </div>
            </article>
          </div>
        </SectionCard>
      </section>

      {loadError ? <div className="banner warning">{loadError}</div> : null}
    </WorkspaceShell>
  );
}
