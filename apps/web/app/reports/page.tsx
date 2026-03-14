"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { DateRangeControl } from "../../components/ui/date-range-control";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { defaultDateSelection, type ErpDateSelection } from "../../lib/date-range";
import {
  downloadReportFile,
  getAccountingAccounts,
  getAccountStatement,
  getAccountStatementSummary,
  getFinancialStatement,
  getRatioAnalysis,
  getTrialBalance,
  type AccountingAccount,
  type AccountStatementDetailRow,
  type AccountStatementSummaryRow,
  type FinancialStatementResponse,
  type RatioAnalysisResponse,
  type TrialBalanceRow,
} from "../../lib/api";
import type { KpiMetric } from "../../lib/erp";
import { useWorkspace } from "../../hooks/use-workspace";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function ReportsPage() {
  const { session, activeCompany, activeBranch, setPeriod } = useWorkspace();
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [trialBalanceTotals, setTrialBalanceTotals] = useState({
    openingDebit: 0,
    openingCredit: 0,
    periodDebit: 0,
    periodCredit: 0,
    closingDebit: 0,
    closingCredit: 0,
  });
  const [statementSummary, setStatementSummary] = useState<AccountStatementSummaryRow[]>([]);
  const [statementDetail, setStatementDetail] = useState<AccountStatementDetailRow[]>([]);
  const [profitOrLoss, setProfitOrLoss] = useState<FinancialStatementResponse | null>(null);
  const [financialPosition, setFinancialPosition] = useState<FinancialStatementResponse | null>(null);
  const [cashFlow, setCashFlow] = useState<FinancialStatementResponse | null>(null);
  const [changesInEquity, setChangesInEquity] = useState<FinancialStatementResponse | null>(null);
  const [notes, setNotes] = useState<FinancialStatementResponse | null>(null);
  const [ratioAnalysis, setRatioAnalysis] = useState<RatioAnalysisResponse | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "">("");
  const [dateSelection, setDateSelection] = useState<ErpDateSelection>(() => defaultDateSelection());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [collapsedTypes, setCollapsedTypes] = useState<string[]>([]);

  async function loadReportData(token: string, nextAccountId?: number | "") {
    setLoading(true);
    setMessage("");
    try {
      const reportParams = {
        from: dateSelection.from,
        to: dateSelection.to,
        companyId: activeCompany?.id,
        branchId: activeBranch?.id,
      };
      const [
        accountRows,
        tbResponse,
        statementSummaryResponse,
        profitOrLossResponse,
        financialPositionResponse,
        cashFlowResponse,
        changesInEquityResponse,
        notesResponse,
        ratioAnalysisResponse,
      ] = await Promise.all([
        getAccountingAccounts(token),
        getTrialBalance(token, reportParams),
        getAccountStatementSummary(token, reportParams),
        getFinancialStatement(token, "profit-or-loss", reportParams),
        getFinancialStatement(token, "financial-position", reportParams),
        getFinancialStatement(token, "cash-flow", reportParams),
        getFinancialStatement(token, "changes-in-equity", reportParams),
        getFinancialStatement(token, "notes", reportParams),
        getRatioAnalysis(token, reportParams),
      ]);

      setAccounts(accountRows);
      setTrialBalance(tbResponse.rows);
      setTrialBalanceTotals(tbResponse.totals);
      setStatementSummary(statementSummaryResponse.rows);
      setProfitOrLoss(profitOrLossResponse);
      setFinancialPosition(financialPositionResponse);
      setCashFlow(cashFlowResponse);
      setChangesInEquity(changesInEquityResponse);
      setNotes(notesResponse);
      setRatioAnalysis(ratioAnalysisResponse);

      const accountId = typeof nextAccountId === "number"
        ? nextAccountId
        : selectedAccountId || statementSummaryResponse.rows[0]?.code
          ? accountRows.find((account) => account.code === statementSummaryResponse.rows[0]?.code)?.id ?? accountRows[0]?.id ?? ""
          : accountRows[0]?.id ?? "";

      if (accountId) {
        setSelectedAccountId(accountId);
        const statement = await getAccountStatement(token, {
          accountId: Number(accountId),
          ...reportParams,
        });
        setStatementDetail(statement.rows);
      } else {
        setStatementDetail([]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.token) {
      return;
    }
    void loadReportData(session.token);
  }, [activeBranch?.id, activeCompany?.id, dateSelection.from, dateSelection.to, session?.token]);

  async function refreshAll(nextAccountId?: number | "") {
    if (!session?.token) {
      return;
    }
    await loadReportData(session.token, nextAccountId);
  }

  async function handleAccountChange(accountId: number) {
    setSelectedAccountId(accountId);
    if (!session?.token) {
      return;
    }
    try {
      const statement = await getAccountStatement(session.token, {
        accountId,
        from: dateSelection.from,
        to: dateSelection.to,
        companyId: activeCompany?.id,
        branchId: activeBranch?.id,
      });
      setStatementDetail(statement.rows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load account statement.");
    }
  }

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;
  const groupedTrialBalance = useMemo(() => {
    const groups = new Map<
      string,
      {
        type: string;
        rows: TrialBalanceRow[];
        totals: {
          openingDebit: number;
          openingCredit: number;
          periodDebit: number;
          periodCredit: number;
          closingDebit: number;
          closingCredit: number;
        };
      }
    >();

    for (const row of trialBalance) {
      const current = groups.get(row.type) ?? {
        type: row.type,
        rows: [],
        totals: {
          openingDebit: 0,
          openingCredit: 0,
          periodDebit: 0,
          periodCredit: 0,
          closingDebit: 0,
          closingCredit: 0,
        },
      };
      current.rows.push(row);
      current.totals.openingDebit += row.openingDebit;
      current.totals.openingCredit += row.openingCredit;
      current.totals.periodDebit += row.periodDebit;
      current.totals.periodCredit += row.periodCredit;
      current.totals.closingDebit += row.closingDebit;
      current.totals.closingCredit += row.closingCredit;
      groups.set(row.type, current);
    }

    return [...groups.values()];
  }, [trialBalance]);

  const reportMetrics = useMemo<KpiMetric[]>(() => {
    const tbOpeningDebit = trialBalance.reduce((sum, row) => sum + row.openingDebit, 0);
    const tbOpeningCredit = trialBalance.reduce((sum, row) => sum + row.openingCredit, 0);
    const tbPeriodDebit = trialBalance.reduce((sum, row) => sum + row.periodDebit, 0);
    const tbPeriodCredit = trialBalance.reduce((sum, row) => sum + row.periodCredit, 0);
    const activeAccounts = statementSummary.filter((row) => row.entries > 0).length;
    const currentStatementNet = statementDetail.reduce((sum, row) => sum + row.debit - row.credit, 0);
    const statementCount = [
      profitOrLoss,
      financialPosition,
      cashFlow,
      changesInEquity,
    ].filter(Boolean).length;
    const ratioCount = ratioAnalysis?.ratios.length ?? 0;

    return [
      {
        label: "Trial Balance accounts",
        value: String(trialBalance.length),
        delta: `${activeAccounts} active`,
        trend: trialBalance.length > 0 ? "up" : "neutral",
        detail: "Accounts included in the current TB window",
      },
      {
        label: "Opening balance",
        value: formatCurrency(tbOpeningDebit),
        delta: formatCurrency(tbOpeningCredit),
        trend: tbOpeningDebit === tbOpeningCredit ? "up" : "down",
        detail: tbOpeningDebit === tbOpeningCredit ? "Opening debits and credits balance" : "Opening balances do not balance",
      },
      {
        label: "Period movement",
        value: formatCurrency(tbPeriodDebit),
        delta: formatCurrency(tbPeriodCredit),
        trend: tbPeriodDebit === tbPeriodCredit ? "up" : "down",
        detail: tbPeriodDebit === tbPeriodCredit ? "Period debits and credits balance" : "Period movement does not balance",
      },
      {
        label: "Statement accounts",
        value: String(statementSummary.length),
        delta: `${statementDetail.length} lines open`,
        trend: statementSummary.length > 0 ? "up" : "neutral",
        detail: "Accounts with statement activity in range",
      },
      {
        label: "IFRS statements",
        value: String(statementCount),
        delta: `${ratioCount} ratios`,
        trend: statementCount > 0 ? "up" : "neutral",
        detail: "Profit or loss, financial position, cash flow, and equity reports",
      },
      {
        label: "Selected account net",
        value: formatCurrency(currentStatementNet),
        delta: selectedAccount?.code ?? "No account",
        trend: "neutral",
        detail: "Net movement for the selected account statement",
      },
    ];
  }, [
    cashFlow,
    changesInEquity,
    financialPosition,
    profitOrLoss,
    ratioAnalysis,
    selectedAccount,
    statementDetail,
    statementSummary,
    trialBalance,
  ]);

  const allReportWarnings = useMemo(
    () =>
      [
        ...(profitOrLoss?.warnings ?? []),
        ...(financialPosition?.warnings ?? []),
        ...(cashFlow?.warnings ?? []),
        ...(changesInEquity?.warnings ?? []),
        ...(notes?.warnings ?? []),
        ...(ratioAnalysis?.warnings ?? []),
      ].filter((warning, index, entries) => entries.indexOf(warning) === index),
    [cashFlow, changesInEquity, financialPosition, notes, profitOrLoss, ratioAnalysis],
  );

  const ratioRows = useMemo(
    () =>
      (ratioAnalysis?.ratios ?? []).map((ratio) => ({
        id: `${ratio.category}-${ratio.name}`,
        ...ratio,
      })),
    [ratioAnalysis],
  );

  const exportButtons = (report: "trial-balance" | "account-statement-summary" | "account-statement", params: Record<string, string | number | undefined>) => (
    <div className="inline-actions compact-end">
      <button className="ghost-button with-icon export-button export-button--csv" type="button" onClick={() => session?.token && downloadReportFile(session.token, report, params, "csv")}>
        <span className="export-button__icon">
          <FileText size={16} />
        </span>
        CSV
      </button>
      <button className="ghost-button with-icon export-button export-button--excel" type="button" onClick={() => session?.token && downloadReportFile(session.token, report, params, "xlsx")}>
        <span className="export-button__icon">
          <FileSpreadsheet size={16} />
        </span>
        Excel
      </button>
      <button className="ghost-button with-icon export-button export-button--pdf" type="button" onClick={() => session?.token && downloadReportFile(session.token, report, params, "pdf")}>
        <span className="export-button__icon">
          <FileText size={16} />
        </span>
        PDF
      </button>
    </div>
  );

  function toggleType(type: string) {
    setCollapsedTypes((current) => (current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type]));
  }

  function printTrialBalance() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  function exportStatement(statement: FinancialStatementResponse["statement"], format: "csv" | "xlsx" | "pdf") {
    if (!session?.token) {
      return;
    }
    void downloadReportFile(
      session.token,
      `financial-statements/${statement}`,
      {
        from: dateSelection.from,
        to: dateSelection.to,
        companyId: activeCompany?.id,
        branchId: activeBranch?.id,
      },
      format,
    );
  }

  function exportRatios(format: "csv" | "xlsx" | "pdf") {
    if (!session?.token) {
      return;
    }
    void downloadReportFile(
      session.token,
      "ratio-analysis",
      {
        from: dateSelection.from,
        to: dateSelection.to,
        companyId: activeCompany?.id,
        branchId: activeBranch?.id,
      },
      format,
    );
  }

  return (
    <WorkspaceShell
      title="Reports"
      description="Generate IFRS-aligned financial statements, ratio analysis, trial balance, and detailed account activity directly from posted ledger balances."
      pageActions={
        <ModuleActionBar
          primaryAction={
            <button className="primary-button with-icon" type="button" onClick={() => refreshAll()}>
              <RefreshCw size={16} /> Refresh reports
            </button>
          }
          summary="Refreshing stays visible. Report variants and print utilities are grouped above the content so the workspace is easier to scan."
          secondaryGroups={[
            {
              label: "Reports",
              items: [
                {
                  label: "Trial Balance",
                  description: "Jump to the TB section",
                  onSelect: () => document.getElementById("reports-trial-balance")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Account statement summary",
                  description: "Jump to statement summaries",
                  onSelect: () => document.getElementById("reports-account-summary")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Detailed account statement",
                  description: "Jump to detailed account activity",
                  onSelect: () => document.getElementById("reports-account-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Income Statement",
                  description: "Jump to revenue and expense performance",
                  onSelect: () => document.getElementById("reports-income-statement")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Statement of Financial Position",
                  description: "Jump to assets, liabilities, and equity",
                  onSelect: () => document.getElementById("reports-financial-position")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Cash Flow Statement",
                  description: "Jump to cash movement overview",
                  onSelect: () => document.getElementById("reports-cash-flow")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Changes in Equity",
                  description: "Jump to the equity roll-forward",
                  onSelect: () => document.getElementById("reports-changes-in-equity")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Ratio analysis",
                  description: "Jump to liquidity, leverage, profitability, and efficiency ratios",
                  onSelect: () => document.getElementById("reports-ratio-analysis")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
            {
              label: "More",
              items: [
                {
                  label: "Print Trial Balance",
                  description: "Open the browser print dialog for TB",
                  onSelect: printTrialBalance,
                },
                { label: "Tax workspace", href: "/tax", description: "Tax and compliance reporting" },
              ],
            },
          ]}
        />
      }
    >
      <section className="kpi-grid">
        {reportMetrics.map((metric) => (
          <KpiCard key={metric.label} metric={metric} tone="reports" />
        ))}
      </section>

      <SectionCard title="Report filters" eyebrow="Common reporting window">
        <DateRangeControl
          title="Reporting period"
          value={dateSelection}
          onApply={(selection) => {
            setDateSelection(selection);
            setPeriod(selection.label);
          }}
          applyLabel={loading ? "Loading..." : "Apply filters"}
        />
      </SectionCard>

      <section className="content-grid split-65">
        <SectionCard
          title="Trial Balance (TB)"
          eyebrow="Core finance report"
          action={exportButtons("trial-balance", { from: dateSelection.from, to: dateSelection.to, companyId: activeCompany?.id, branchId: activeBranch?.id })}
        >
          <div id="reports-trial-balance" />
          {trialBalance.length === 0 ? (
            <EmptyState
              tone="reports"
              title={loading ? "Loading TB" : "No trial balance rows"}
              body={loading ? "Pulling live Trial Balance rows from the reports API." : "No journal activity matched this date range."}
            />
          ) : (
            <div className="table-shell">
              <div className="table-toolbar">
                <div className="table-toolbar__title">
                  <h3>Trial Balance</h3>
                  <p>
                    Standard format with opening balances, period movement, and closing balances for {dateSelection.from} to {dateSelection.to}
                  </p>
                </div>
              </div>
              <div className="table-wrap trial-balance-wrap">
                <table className="data-table trial-balance-table">
                  <thead>
                    <tr>
                      <th rowSpan={2}>Code</th>
                      <th rowSpan={2}>Account</th>
                      <th rowSpan={2}>Type</th>
                      <th colSpan={2} className="grouped-head">Opening</th>
                      <th colSpan={2} className="grouped-head">Movement</th>
                      <th colSpan={2} className="grouped-head">Closing</th>
                    </tr>
                    <tr>
                      <th className="numeric">Dr</th>
                      <th className="numeric">Cr</th>
                      <th className="numeric">Dr</th>
                      <th className="numeric">Cr</th>
                      <th className="numeric">Dr</th>
                      <th className="numeric">Cr</th>
                    </tr>
                  </thead>
                  {groupedTrialBalance.map((group) => {
                      const collapsed = collapsedTypes.includes(group.type);
                      return (
                        <tbody key={group.type}>
                          <tr key={`${group.type}-group`} className="trial-balance-group-row">
                            <td colSpan={9}>
                              <button type="button" className="trial-balance-group-toggle" onClick={() => toggleType(group.type)}>
                                {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                <strong>{group.type}</strong>
                                <span>{group.rows.length} accounts</span>
                                <span className="group-total">Closing Dr {formatCurrency(group.totals.closingDebit)}</span>
                                <span className="group-total">Closing Cr {formatCurrency(group.totals.closingCredit)}</span>
                              </button>
                            </td>
                          </tr>
                          {!collapsed
                            ? group.rows.map((row) => (
                                <tr key={row.code}>
                                  <td><strong>{row.code}</strong></td>
                                  <td>{row.account}</td>
                                  <td>{row.type}</td>
                                  <td className="numeric">{formatCurrency(row.openingDebit)}</td>
                                  <td className="numeric">{formatCurrency(row.openingCredit)}</td>
                                  <td className="numeric">{formatCurrency(row.periodDebit)}</td>
                                  <td className="numeric">{formatCurrency(row.periodCredit)}</td>
                                  <td className="numeric">{formatCurrency(row.closingDebit)}</td>
                                  <td className="numeric">{formatCurrency(row.closingCredit)}</td>
                                </tr>
                              ))
                            : null}
                          {!collapsed ? (
                            <tr key={`${group.type}-totals`} className="trial-balance-subtotal-row">
                              <td colSpan={3}><strong>{group.type} total</strong></td>
                              <td className="numeric"><strong>{formatCurrency(group.totals.openingDebit)}</strong></td>
                              <td className="numeric"><strong>{formatCurrency(group.totals.openingCredit)}</strong></td>
                              <td className="numeric"><strong>{formatCurrency(group.totals.periodDebit)}</strong></td>
                              <td className="numeric"><strong>{formatCurrency(group.totals.periodCredit)}</strong></td>
                              <td className="numeric"><strong>{formatCurrency(group.totals.closingDebit)}</strong></td>
                              <td className="numeric"><strong>{formatCurrency(group.totals.closingCredit)}</strong></td>
                            </tr>
                          ) : null}
                        </tbody>
                      );
                    })}
                  <tfoot>
                    <tr>
                      <td colSpan={3}><strong>Totals</strong></td>
                      <td className="numeric"><strong>{formatCurrency(trialBalanceTotals.openingDebit)}</strong></td>
                      <td className="numeric"><strong>{formatCurrency(trialBalanceTotals.openingCredit)}</strong></td>
                      <td className="numeric"><strong>{formatCurrency(trialBalanceTotals.periodDebit)}</strong></td>
                      <td className="numeric"><strong>{formatCurrency(trialBalanceTotals.periodCredit)}</strong></td>
                      <td className="numeric"><strong>{formatCurrency(trialBalanceTotals.closingDebit)}</strong></td>
                      <td className="numeric"><strong>{formatCurrency(trialBalanceTotals.closingCredit)}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Account Statement Summary"
          eyebrow="Account movement overview"
          action={exportButtons("account-statement-summary", { from: dateSelection.from, to: dateSelection.to, companyId: activeCompany?.id, branchId: activeBranch?.id })}
        >
          <div id="reports-account-summary" />
          <DataTable
            title="Statement summary"
            tableId="reports-account-statement-summary"
            exportFileName="account-statement-summary"
            rows={statementSummary.map((row) => ({ ...row, id: row.code }))}
            searchValue={(row) => `${row.code} ${row.account} ${row.type}`}
            filters={[
              { key: "recent", label: "Recent activity", predicate: (row) => row.entries > 0 },
              { key: "debit", label: "Debit heavy", predicate: (row) => row.debit > row.credit },
            ]}
            advancedFilters={[
              { key: "accountCode", label: "Account code", type: "text", getValue: (row) => row.code },
              { key: "accountName", label: "Account name", type: "text", getValue: (row) => row.account },
              {
                key: "type",
                label: "Account type",
                type: "select",
                getValue: (row) => row.type,
                options: [...new Set(statementSummary.map((row) => row.type))].map((value) => ({ value, label: value })),
              },
              { key: "entries", label: "Entries", type: "number-range", getValue: (row) => row.entries },
              { key: "lastActivity", label: "Last activity", type: "date-range", getValue: (row) => row.lastActivity },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            emptyTitle={loading ? "Loading statement summary" : "No statement activity"}
            emptyMessage={loading ? "Pulling live statement summary rows." : "No account statement activity matched this date range."}
            columns={[
              { key: "code", label: "Code", render: (row) => <strong>{row.code}</strong> },
              { key: "account", label: "Account", render: (row) => row.account },
              { key: "entries", label: "Entries", className: "numeric", render: (row) => row.entries },
              { key: "debit", label: "Debit", className: "numeric", render: (row) => formatCurrency(row.debit) },
              { key: "credit", label: "Credit", className: "numeric", render: (row) => formatCurrency(row.credit) },
              { key: "lastActivity", label: "Last activity", render: (row) => formatDate(row.lastActivity) },
            ]}
          />
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard
          title="Statement of Profit or Loss and OCI"
          eyebrow="IFRS final accounts"
          action={
            <div className="inline-actions compact-end">
              <button className="ghost-button small" type="button" onClick={() => exportStatement("profit-or-loss", "csv")}>CSV</button>
              <button className="ghost-button small" type="button" onClick={() => exportStatement("profit-or-loss", "xlsx")}>Excel</button>
              <button className="ghost-button small" type="button" onClick={() => exportStatement("profit-or-loss", "pdf")}>PDF</button>
            </div>
          }
        >
          <div id="reports-income-statement" />
          <DataTable
            title={profitOrLoss?.title ?? "Profit or Loss"}
            tableId="reports-profit-or-loss"
            exportFileName="profit-or-loss"
            rows={(profitOrLoss?.sections ?? []).flatMap((section) =>
              section.lines.map((line, index) => ({
                id: `${section.key}-${index}-${line.label}`,
                section: section.label,
                ...line,
              })),
            )}
            searchValue={(row) => `${row.section} ${row.code ?? ""} ${row.label}`}
            emptyTitle={loading ? "Loading statement" : "No profit or loss rows"}
            emptyMessage={loading ? "Building the IFRS profit or loss statement from posted ledger balances." : "No mapped profit or loss accounts matched the reporting window."}
            columns={[
              { key: "section", label: "Section", render: (row) => row.section },
              { key: "label", label: "Line item", render: (row) => <div><strong>{row.label}</strong>{row.code ? <p className="cell-subcopy">{row.code}</p> : null}</div> },
              { key: "current", label: "Current", className: "numeric", render: (row) => formatCurrency(row.current) },
              { key: "comparative", label: "Comparative", className: "numeric", render: (row) => formatCurrency(row.comparative) },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Statement of Financial Position"
          eyebrow="IFRS final accounts"
          action={
            <div className="inline-actions compact-end">
              <button className="ghost-button small" type="button" onClick={() => exportStatement("financial-position", "csv")}>CSV</button>
              <button className="ghost-button small" type="button" onClick={() => exportStatement("financial-position", "xlsx")}>Excel</button>
              <button className="ghost-button small" type="button" onClick={() => exportStatement("financial-position", "pdf")}>PDF</button>
            </div>
          }
        >
          <div id="reports-financial-position" />
          <DataTable
            title={financialPosition?.title ?? "Financial Position"}
            tableId="reports-financial-position"
            exportFileName="financial-position"
            rows={(financialPosition?.sections ?? []).flatMap((section) =>
              section.lines.map((line, index) => ({
                id: `${section.key}-${index}-${line.label}`,
                section: section.label,
                ...line,
              })),
            )}
            searchValue={(row) => `${row.section} ${row.code ?? ""} ${row.label}`}
            emptyTitle={loading ? "Loading statement" : "No financial position rows"}
            emptyMessage={loading ? "Building the IFRS statement of financial position from mapped ledger balances." : "No mapped balance sheet accounts matched the reporting window."}
            columns={[
              { key: "section", label: "Section", render: (row) => row.section },
              { key: "label", label: "Line item", render: (row) => <div><strong>{row.label}</strong>{row.code ? <p className="cell-subcopy">{row.code}</p> : null}</div> },
              { key: "current", label: "Current", className: "numeric", render: (row) => formatCurrency(row.current) },
              { key: "comparative", label: "Comparative", className: "numeric", render: (row) => formatCurrency(row.comparative) },
            ]}
          />
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard
          title="Statement of Cash Flows"
          eyebrow="Indirect method"
          action={
            <div className="inline-actions compact-end">
              <button className="ghost-button small" type="button" onClick={() => exportStatement("cash-flow", "csv")}>CSV</button>
              <button className="ghost-button small" type="button" onClick={() => exportStatement("cash-flow", "xlsx")}>Excel</button>
              <button className="ghost-button small" type="button" onClick={() => exportStatement("cash-flow", "pdf")}>PDF</button>
            </div>
          }
        >
          <div id="reports-cash-flow" />
          <DataTable
            title={cashFlow?.title ?? "Cash Flow"}
            tableId="reports-cash-flow"
            exportFileName="cash-flow"
            rows={(cashFlow?.sections ?? []).flatMap((section) =>
              section.lines.map((line, index) => ({
                id: `${section.key}-${index}-${line.label}`,
                section: section.label,
                ...line,
              })),
            )}
            searchValue={(row) => `${row.section} ${row.label}`}
            emptyTitle={loading ? "Loading cash flow" : "No cash flow rows"}
            emptyMessage={loading ? "Building the cash flow statement from posted cash, working capital, investing, and financing movements." : "No mapped cash flow data matched this reporting window."}
            columns={[
              { key: "section", label: "Section", render: (row) => row.section },
              { key: "label", label: "Line item", render: (row) => <strong>{row.label}</strong> },
              { key: "current", label: "Current", className: "numeric", render: (row) => formatCurrency(row.current) },
              { key: "comparative", label: "Comparative", className: "numeric", render: (row) => formatCurrency(row.comparative) },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Statement of Changes in Equity"
          eyebrow="Equity movement"
          action={
            <div className="inline-actions compact-end">
              <button className="ghost-button small" type="button" onClick={() => exportStatement("changes-in-equity", "csv")}>CSV</button>
              <button className="ghost-button small" type="button" onClick={() => exportStatement("changes-in-equity", "xlsx")}>Excel</button>
              <button className="ghost-button small" type="button" onClick={() => exportStatement("changes-in-equity", "pdf")}>PDF</button>
            </div>
          }
        >
          <div id="reports-changes-in-equity" />
          <DataTable
            title={changesInEquity?.title ?? "Changes in Equity"}
            tableId="reports-changes-in-equity"
            exportFileName="changes-in-equity"
            rows={(changesInEquity?.sections ?? []).flatMap((section) =>
              section.lines.map((line, index) => ({
                id: `${section.key}-${index}-${line.label}`,
                section: section.label,
                ...line,
              })),
            )}
            searchValue={(row) => `${row.section} ${row.label}`}
            emptyTitle={loading ? "Loading equity statement" : "No equity movement rows"}
            emptyMessage={loading ? "Building the equity roll-forward from posted balances and period result." : "No mapped equity rows matched this reporting window."}
            columns={[
              { key: "section", label: "Section", render: (row) => row.section },
              { key: "label", label: "Line item", render: (row) => <strong>{row.label}</strong> },
              { key: "current", label: "Current", className: "numeric", render: (row) => formatCurrency(row.current) },
              { key: "comparative", label: "Comparative", className: "numeric", render: (row) => formatCurrency(row.comparative) },
            ]}
          />
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard
          title="Ratio Analysis"
          eyebrow="Financial analysis"
          action={
            <div className="inline-actions compact-end">
              <button className="ghost-button small" type="button" onClick={() => exportRatios("csv")}>CSV</button>
              <button className="ghost-button small" type="button" onClick={() => exportRatios("xlsx")}>Excel</button>
              <button className="ghost-button small" type="button" onClick={() => exportRatios("pdf")}>PDF</button>
            </div>
          }
        >
          <div id="reports-ratio-analysis" />
          <DataTable
            title="Ratio Analysis"
            tableId="reports-ratio-analysis"
            exportFileName="ratio-analysis"
            rows={ratioRows}
            searchValue={(row) => `${row.category} ${row.name} ${row.formula}`}
            emptyTitle={loading ? "Loading ratios" : "No ratios available"}
            emptyMessage={loading ? "Calculating financial ratios from the IFRS statements." : "Ratios require mapped statements and non-zero denominators."}
            columns={[
              { key: "category", label: "Category", render: (row) => row.category },
              { key: "name", label: "Ratio", render: (row) => <strong>{row.name}</strong> },
              { key: "formattedValue", label: "Value", className: "numeric", render: (row) => row.formattedValue },
              { key: "formula", label: "Formula", render: (row) => row.formula },
              { key: "interpretation", label: "Interpretation", render: (row) => row.interpretation },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Notes and supporting schedules"
          eyebrow="Mapping control"
          action={
            <div className="inline-actions compact-end">
              <button className="ghost-button small" type="button" onClick={() => exportStatement("notes", "csv")}>CSV</button>
              <button className="ghost-button small" type="button" onClick={() => exportStatement("notes", "xlsx")}>Excel</button>
              <button className="ghost-button small" type="button" onClick={() => exportStatement("notes", "pdf")}>PDF</button>
            </div>
          }
        >
          <DataTable
            title="Supporting schedules"
            tableId="reports-notes"
            exportFileName="financial-notes"
            rows={(notes?.schedules ?? []).flatMap((schedule) =>
              schedule.rows.map((row) => ({
                id: `${schedule.title}-${row.code}`,
                schedule: schedule.title,
                ...row,
              })),
            )}
            searchValue={(row) => `${row.schedule} ${row.code} ${row.account}`}
            emptyTitle={loading ? "Loading notes" : "No notes available"}
            emptyMessage={loading ? "Preparing supporting schedules and unmapped-account warnings." : "No supporting schedules matched the reporting window."}
            columns={[
              { key: "schedule", label: "Schedule", render: (row) => row.schedule },
              { key: "code", label: "Code", render: (row) => <strong>{row.code}</strong> },
              { key: "account", label: "Account", render: (row) => row.account },
              { key: "current", label: "Current", className: "numeric", render: (row) => formatCurrency(row.current) },
              { key: "comparative", label: "Comparative", className: "numeric", render: (row) => formatCurrency(row.comparative) },
            ]}
          />
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard
          title="Account Statement"
          eyebrow="Detailed ledger view"
          action={
            <div className="inline-actions compact-end">
              <label className="field">
                <span>Account</span>
                <select
                  className="select-input"
                  value={selectedAccountId}
                  onChange={(event) => handleAccountChange(Number(event.target.value))}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedAccountId
                ? exportButtons("account-statement", {
                    accountId: selectedAccountId,
                  from: dateSelection.from,
                  to: dateSelection.to,
                  companyId: activeCompany?.id,
                  branchId: activeBranch?.id,
                })
                : null}
            </div>
          }
        >
          <div id="reports-account-detail" />
          <DataTable
            title={selectedAccount ? `${selectedAccount.code} ${selectedAccount.name}` : "Account statement"}
            tableId="reports-account-statement"
            exportFileName="account-statement"
            rows={statementDetail.map((row, index) => ({ ...row, id: `${row.reference}-${index}` }))}
            searchValue={(row) => `${row.reference} ${row.description} ${row.memo}`}
            filters={[
              { key: "debits", label: "Debits", predicate: (row) => row.debit > 0 },
              { key: "credits", label: "Credits", predicate: (row) => row.credit > 0 },
            ]}
            advancedFilters={[
              { key: "reference", label: "Reference", type: "text", getValue: (row) => row.reference },
              { key: "description", label: "Description", type: "text", getValue: (row) => `${row.description} ${row.memo}` },
              { key: "date", label: "Date", type: "date-range", getValue: (row) => row.date },
              { key: "debit", label: "Debit", type: "number-range", getValue: (row) => row.debit },
              { key: "credit", label: "Credit", type: "number-range", getValue: (row) => row.credit },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            emptyTitle={loading ? "Loading statement" : "No statement lines"}
            emptyMessage={loading ? "Pulling live account statement lines." : "Select an account with journal activity to view statement detail."}
            columns={[
              { key: "date", label: "Date", render: (row) => formatDate(row.date) },
              { key: "reference", label: "Reference", render: (row) => <strong>{row.reference}</strong> },
              { key: "description", label: "Description", render: (row) => <div><strong>{row.description}</strong><p className="cell-subcopy">{row.memo || "-"}</p></div> },
              { key: "debit", label: "Debit", className: "numeric", render: (row) => formatCurrency(row.debit) },
              { key: "credit", label: "Credit", className: "numeric", render: (row) => formatCurrency(row.credit) },
              { key: "runningBalance", label: "Running balance", className: "numeric", render: (row) => formatCurrency(row.runningBalance) },
            ]}
          />
        </SectionCard>

        <SectionCard title="Report guidance" eyebrow="What is included">
          {message ? <div className="banner warning">{message}</div> : null}
          {allReportWarnings.length ? (
            <div className="alert-list compact">
              {allReportWarnings.map((warning) => (
                <article key={warning} className="alert-row warning">
                  <div>
                    <strong>Reporting warning</strong>
                    <p>{warning}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {!loading && trialBalance.length === 0 && statementSummary.length === 0 ? (
            <EmptyState tone="reports" title="No finance reports yet" body="Post journals first, then the report workspace will populate with live TB and account statement data." />
          ) : (
            <div className="alert-list compact">
              <article className="alert-row info">
                <div>
                  <strong>Financial statements</strong>
                  <p>Profit or loss, financial position, cash flow, changes in equity, and notes now come from the reporting engine, not from frontend-derived totals.</p>
                </div>
              </article>
              <article className="alert-row info">
                <div>
                  <strong>Mapping control</strong>
                  <p>Accounts without an explicit financial statement category are flagged instead of being guessed into a line item.</p>
                </div>
              </article>
              <article className="alert-row info">
                <div>
                  <strong>Ratio analysis</strong>
                  <p>Liquidity, profitability, leverage, and efficiency ratios complement the statements and warn when denominators are missing.</p>
                </div>
              </article>
            </div>
          )}
        </SectionCard>
      </section>
    </WorkspaceShell>
  );
}
