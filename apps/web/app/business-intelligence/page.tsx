"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Eye, RefreshCw, Sparkles } from "lucide-react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { DateRangeControl } from "../../components/ui/date-range-control";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { useWorkspace } from "../../hooks/use-workspace";
import {
  downloadCsvFile,
  downloadExcelFile,
  downloadPdfFile,
} from "../../lib/export";
import {
  biViews,
  type AppStatus,
  type KpiMetric,
} from "../../lib/erp";
import {
  defaultDateSelection,
  type ErpDateSelection,
} from "../../lib/date-range";
import {
  getAccountStatementSummary,
  getAccountingJournals,
  getSalesInvoices,
  getTaxDashboard,
  getTrialBalance,
  type AccountStatementSummaryRow,
  type AccountingJournal,
  type SalesInvoiceRecord,
  type TaxDashboardResponse,
  type TrialBalanceResponse,
} from "../../lib/api";

type TrendPoint = {
  label: string;
  value: number;
};

type CustomerInsightRow = {
  id: string;
  customer: string;
  invoices: number;
  total: number;
  average: number;
  latestDate: string;
  status: AppStatus;
};

type UpdateRow = {
  id: string;
  time: string;
  source: string;
  title: string;
  detail: string;
  status: AppStatus;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function toDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthBuckets(selection: ErpDateSelection) {
  const end = new Date(selection.to);
  const start = new Date(selection.from);
  const months: Array<{ key: string; label: string; start: Date; end: Date }> = [];

  const cursor = startOfMonth(start);
  const endCursor = startOfMonth(end);
  while (cursor <= endCursor) {
    const current = new Date(cursor);
    months.push({
      key: monthKey(current),
      label: current.toLocaleString("en-GB", { month: "short" }),
      start: new Date(current),
      end: endOfMonth(current),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  if (months.length >= 6) {
    return months.slice(-6);
  }

  const padded = [...months];
  while (padded.length < 6) {
    const first = padded[0] ?? {
      start,
    };
    const previous = new Date(first.start);
    previous.setMonth(previous.getMonth() - 1);
    padded.unshift({
      key: monthKey(previous),
      label: previous.toLocaleString("en-GB", { month: "short" }),
      start: new Date(previous),
      end: endOfMonth(previous),
    });
  }
  return padded;
}

function normalizeStatus(value: string): AppStatus {
  const lower = value.toLowerCase();
  if (lower.includes("post")) return "Posted";
  if (lower.includes("approve")) return "Approved";
  if (lower.includes("submit")) return "Submitted";
  if (lower.includes("reject")) return "Rejected";
  if (lower.includes("overdue")) return "Overdue";
  return "Draft";
}

function LineChart({
  title,
  subtitle,
  points,
  tone = "reports",
  formatter = formatCurrency,
}: {
  title: string;
  subtitle: string;
  points: TrendPoint[];
  tone?: "reports" | "finance" | "sales";
  formatter?: (value: number) => string;
}) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const plotted = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 90 - (point.value / max) * 70;
    return { ...point, x, y };
  });
  const path = points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 90 - (point.value / max) * 70;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const areaPath = `${path} L ${plotted[plotted.length - 1]?.x ?? 100} 92 L ${plotted[0]?.x ?? 0} 92 Z`;
  const gradientId = `${tone}Area`;

  return (
    <div className={`insight-chart insight-chart--${tone}`}>
      <div className="insight-chart__header">
        <div>
          <span className="section-eyebrow">Live chart</span>
          <h3>{title}</h3>
        </div>
        <strong>{formatter(points[points.length - 1]?.value ?? 0)}</strong>
      </div>
      <p>{subtitle}</p>
      <svg viewBox="0 0 100 100" className="insight-chart__svg" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.42" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d="M 0 90 L 100 90" className="insight-chart__grid" />
        <path d={areaPath} className="insight-chart__area" fill={`url(#${gradientId})`} />
        <path d={path} className="insight-chart__path" />
        {plotted.map((point, index) => {
          return <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="2.3" className="insight-chart__point" />;
        })}
      </svg>
      <div className="insight-chart__legend">
        <span><i style={{ background: "currentColor" }} /> Live ERP data</span>
        <span><i style={{ background: "rgba(255,255,255,0.82)" }} /> 6-period trendline</span>
      </div>
      <div className="insight-chart__footer">
        {points.map((point) => (
          <div key={point.label}>
            <span>{point.label}</span>
            <strong>{formatter(point.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionChart({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="distribution-chart">
      <div className="insight-chart__header">
        <div>
          <span className="section-eyebrow">Analytics</span>
          <h3>{title}</h3>
        </div>
        <BarChart3 size={18} />
      </div>
      <div className="distribution-chart__list">
        {rows.map((row) => (
          <div key={row.label} className="distribution-chart__row">
            <div className="distribution-chart__labels">
              <strong>{row.label}</strong>
              <span>{formatCurrency(row.value)}</span>
            </div>
            <div className="distribution-chart__bar">
              <i style={{ width: `${Math.max((row.value / max) * 100, 8)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutBreakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number; color: string }>;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const segments = rows.length
    ? rows.reduce<string[]>((parts, row, index) => {
        const previous = rows.slice(0, index).reduce((sum, item) => sum + item.value, 0);
        const start = total === 0 ? 0 : (previous / total) * 100;
        const end = total === 0 ? 0 : ((previous + row.value) / total) * 100;
        parts.push(`${row.color} ${start}% ${end}%`);
        return parts;
      }, [])
    : ["#d7dbe3 0% 100%"];

  return (
    <div className="donut-card">
      <div className="donut-card__head">
        <div>
          <span className="section-eyebrow">Composition</span>
          <h3>{title}</h3>
        </div>
        <Sparkles size={18} />
      </div>

      <div className="donut-visual" style={{ background: `conic-gradient(${segments.join(", ")})` }}>
        <div className="donut-visual__center">
          <strong>{rows.length}</strong>
          <span>active slices</span>
        </div>
      </div>

      <div className="donut-legend">
        {rows.map((row) => (
          <div key={row.label} className="donut-legend__row">
            <div className="donut-legend__left">
              <i className="donut-legend__swatch" style={{ background: row.color }} />
              <strong>{row.label}</strong>
            </div>
            <span>{formatCurrency(row.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BusinessIntelligencePage() {
  const { session, activeCompany } = useWorkspace();
  const [selection, setSelection] = useState<ErpDateSelection>(defaultDateSelection());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Live BI analytics are sourced from finance, sales, tax, and reporting data.");
  const [invoices, setInvoices] = useState<SalesInvoiceRecord[]>([]);
  const [journals, setJournals] = useState<AccountingJournal[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResponse | null>(null);
  const [accountSummary, setAccountSummary] = useState<AccountStatementSummaryRow[]>([]);
  const [taxDashboard, setTaxDashboard] = useState<TaxDashboardResponse | null>(null);

  async function loadBiData(token: string, range: ErpDateSelection) {
    setLoading(true);
    const results = await Promise.allSettled([
      getSalesInvoices(token, activeCompany?.id),
      getAccountingJournals(token),
      getTrialBalance(token, { from: range.from, to: range.to, companyId: activeCompany?.id }),
      getAccountStatementSummary(token, { from: range.from, to: range.to, companyId: activeCompany?.id }),
      activeCompany ? getTaxDashboard(token, activeCompany.id, { from: range.from, to: range.to }) : Promise.resolve(null),
    ]);

    const [invoiceResult, journalResult, tbResult, statementResult, taxResult] = results;
    const issues: string[] = [];

    if (invoiceResult.status === "fulfilled") {
      setInvoices(invoiceResult.value);
    } else {
      setInvoices([]);
      issues.push("sales");
    }

    if (journalResult.status === "fulfilled") {
      setJournals(journalResult.value);
    } else {
      setJournals([]);
      issues.push("finance journals");
    }

    if (tbResult.status === "fulfilled") {
      setTrialBalance(tbResult.value);
    } else {
      setTrialBalance(null);
      issues.push("trial balance");
    }

    if (statementResult.status === "fulfilled") {
      setAccountSummary(statementResult.value.rows);
    } else {
      setAccountSummary([]);
      issues.push("account statement summary");
    }

    if (taxResult.status === "fulfilled") {
      setTaxDashboard(taxResult.value);
    } else {
      setTaxDashboard(null);
      if (activeCompany) {
        issues.push("tax");
      }
    }

    setMessage(
      issues.length === 0
        ? "BI analytics are live and current for the selected reporting period."
        : `Some live sources are unavailable right now: ${issues.join(", ")}.`,
    );
    setLoading(false);
  }

  useEffect(() => {
    if (!session?.token) {
      return;
    }
    void loadBiData(session.token, selection);
  }, [activeCompany?.id, selection, session?.token]);

  const monthBuckets = useMemo(() => buildMonthBuckets(selection), [selection]);

  const filteredInvoices = useMemo(() => {
    const from = new Date(selection.from);
    const to = new Date(selection.to);
    return invoices.filter((invoice) => {
      const date = new Date(invoice.date);
      return date >= from && date <= to;
    });
  }, [invoices, selection.from, selection.to]);

  const filteredJournals = useMemo(() => {
    const from = new Date(selection.from);
    const to = new Date(selection.to);
    return journals.filter((journal) => {
      const date = new Date(journal.date);
      return date >= from && date <= to;
    });
  }, [journals, selection.from, selection.to]);

  const revenueTrend = useMemo<TrendPoint[]>(() => {
    return monthBuckets.map((bucket) => ({
      label: bucket.label,
      value: filteredInvoices
        .filter((invoice) => {
          const date = new Date(invoice.date);
          return date >= bucket.start && date <= bucket.end;
        })
        .reduce((sum, invoice) => sum + toNumber(invoice.total), 0),
    }));
  }, [filteredInvoices, monthBuckets]);

  const journalTrend = useMemo<TrendPoint[]>(() => {
    return monthBuckets.map((bucket) => ({
      label: bucket.label,
      value: filteredJournals
        .filter((journal) => {
          const date = new Date(journal.date);
          return date >= bucket.start && date <= bucket.end;
        })
        .reduce(
          (sum, journal) =>
            sum + journal.lines.reduce((lineTotal, line) => lineTotal + toNumber(line.debit), 0),
          0,
        ),
    }));
  }, [filteredJournals, monthBuckets]);

  const typeDistribution = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of trialBalance?.rows ?? []) {
      const amount = row.closingDebit - row.closingCredit;
      totals.set(row.type, Math.abs((totals.get(row.type) ?? 0) + amount));
    }
    return Array.from(totals.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6);
  }, [trialBalance?.rows]);

  const donutRows = useMemo(() => {
    const palette = ["#2C3E73", "#2FA4A9", "#4E5A70", "#5D6F8F", "#38548F", "#6C8A91"];
    return typeDistribution.map((row, index) => ({
      ...row,
      color: palette[index % palette.length],
    }));
  }, [typeDistribution]);

  const customerRows = useMemo<CustomerInsightRow[]>(() => {
    const customerMap = new Map<string, CustomerInsightRow>();
    for (const invoice of filteredInvoices) {
      const key = String(invoice.customerId);
      const current = customerMap.get(key) ?? {
        id: key,
      customer: invoice.customer?.name ?? "Unmapped customer",
        invoices: 0,
        total: 0,
        average: 0,
        latestDate: invoice.date,
        status: "Approved",
      };
      current.invoices += 1;
      current.total += toNumber(invoice.total);
      current.average = current.total / current.invoices;
      current.latestDate = invoice.date > current.latestDate ? invoice.date : current.latestDate;
      customerMap.set(key, current);
    }

    return Array.from(customerMap.values())
      .sort((left, right) => right.total - left.total)
      .slice(0, 8);
  }, [filteredInvoices]);

  const updates = useMemo<UpdateRow[]>(() => {
    const invoiceUpdates = filteredInvoices.slice(0, 4).map((invoice) => ({
      id: `invoice-${invoice.id}`,
      time: toDateLabel(invoice.date),
      source: "Sales",
      title: invoice.number,
      detail: `${invoice.customer?.name ?? "Unmapped customer"} · ${formatCurrency(toNumber(invoice.total))}`,
      status: normalizeStatus(invoice.status),
    }));

    const journalUpdates = filteredJournals.slice(0, 4).map((journal) => ({
      id: `journal-${journal.id}`,
      time: toDateLabel(journal.date),
      source: "Finance",
      title: journal.reference,
      detail: journal.description || `${journal.lines.length} lines posted`,
      status: "Posted" as AppStatus,
    }));

    const taxUpdates = (taxDashboard?.calendar ?? []).slice(0, 3).map((entry) => ({
      id: `tax-${entry.code}`,
      time: toDateLabel(entry.nextDueDate),
      source: "Tax",
      title: `${entry.code} filing`,
      detail: `${entry.name} · ${entry.filingFrequency}`,
      status: normalizeStatus(entry.status),
    }));

    return [...invoiceUpdates, ...journalUpdates, ...taxUpdates]
      .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
      .slice(0, 8);
  }, [filteredInvoices, filteredJournals, taxDashboard?.calendar]);

  const metrics = useMemo<KpiMetric[]>(() => {
    const invoiceValue = filteredInvoices.reduce((sum, invoice) => sum + toNumber(invoice.total), 0);
    const journalValue = filteredJournals.reduce(
      (sum, journal) => sum + journal.lines.reduce((lineTotal, line) => lineTotal + toNumber(line.debit), 0),
      0,
    );
    const liability = taxDashboard?.totals.liabilityBalance ?? 0;
    const openAccounts = (trialBalance?.rows ?? []).filter(
      (row) => row.closingDebit !== 0 || row.closingCredit !== 0,
    ).length;
    const netPosition = (trialBalance?.rows ?? []).reduce(
      (sum, row) => sum + row.closingCredit - row.closingDebit,
      0,
    );

    return [
      {
        label: "Invoiced value",
        value: formatCurrency(invoiceValue),
        delta: `${filteredInvoices.length} invoices`,
        trend: invoiceValue > 0 ? "up" : "neutral",
        detail: "Live from approved and open sales invoices",
      },
      {
        label: "Posting throughput",
        value: formatCurrency(journalValue),
        delta: `${filteredJournals.length} journals`,
        trend: journalValue > 0 ? "up" : "neutral",
        detail: "Journal value generated in the selected period",
      },
      {
        label: "Tax liability",
        value: formatCurrency(liability),
        delta: taxDashboard ? `${taxDashboard.configs.length} tax codes` : "Awaiting access",
        trend: liability > 0 ? "down" : "neutral",
        detail: "Net statutory position from the live tax dashboard",
      },
      {
        label: "Active accounts",
        value: String(openAccounts),
        delta: netPosition === 0 ? "Balanced closing" : formatCurrency(Math.abs(netPosition)),
        trend: openAccounts > 0 ? "up" : "neutral",
        detail: "Accounts carrying a closing balance in the trial balance",
      },
    ];
  }, [filteredInvoices, filteredJournals, taxDashboard, trialBalance?.rows]);

  const watchlist = useMemo(() => {
    const liabilities = accountSummary
      .filter((row) => Math.abs(row.balance) > 0)
      .sort((left, right) => Math.abs(right.balance) - Math.abs(left.balance))
      .slice(0, 5);
    return liabilities.map((row) => ({
      id: row.code,
      account: `${row.code} - ${row.account}`,
      balance: row.balance,
      entries: row.entries,
      rawLastActivity: row.lastActivity,
      lastActivity: row.lastActivity ? toDateLabel(row.lastActivity) : "No activity",
    }));
  }, [accountSummary]);

  function refresh() {
    if (!session?.token) {
      return;
    }
    void loadBiData(session.token, selection);
  }

  function exportSnapshot(format: "csv" | "xlsx" | "pdf") {
    const headers = ["Metric", "Value", "Delta", "Detail"];
    const rows = metrics.map((metric) => [metric.label, metric.value, metric.delta, metric.detail]);
    if (format === "csv") {
      downloadCsvFile("bi-snapshot.csv", headers, rows);
    } else if (format === "xlsx") {
      downloadExcelFile("bi-snapshot.xlsx", headers, rows, "BI Snapshot");
    } else {
      downloadPdfFile("bi-snapshot.pdf", "Business Intelligence Snapshot", headers, rows);
    }
    setMessage(`Exported BI snapshot to ${format === "xlsx" ? "Excel" : format.toUpperCase()}.`);
  }

  return (
    <WorkspaceShell
      title="Business Intelligence"
      description="Live analytics, operational trends, executive updates, and drill-through insight built from current ERP activity."
      requiredRoles={["cfo", "accountant", "procurement", "inventory", "hr", "admin", "ceo"]}
      tabs={biViews}
      activeTab="Dashboard"
      pageActions={
        <ModuleActionBar
          primaryAction={
            <button className="primary-button with-icon" type="button" onClick={refresh}>
              <RefreshCw size={16} /> Refresh
            </button>
          }
          summary="Refreshing stays visible. Snapshot export, print, and drill-through destinations are grouped into cleaner menus above."
          secondaryGroups={[
            {
              label: "Reports",
              items: [
                {
                  label: "Trend analysis",
                  description: "Jump to the live chart section",
                  onSelect: () => document.getElementById("bi-trends")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Top customers",
                  description: "Jump to customer analytics",
                  onSelect: () => document.getElementById("bi-customers")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                { label: "Financial reports", href: "/reports", description: "Open the reporting workspace" },
              ],
            },
            {
              label: "More",
              items: [
                { label: "Export snapshot (CSV)", description: "Download BI snapshot as CSV", onSelect: () => exportSnapshot("csv") },
                { label: "Export snapshot (Excel)", description: "Download BI snapshot as Excel", onSelect: () => exportSnapshot("xlsx") },
                { label: "Export snapshot (PDF)", description: "Download BI snapshot as PDF", onSelect: () => exportSnapshot("pdf") },
                { label: "Print view", description: "Print the current BI workspace", onSelect: () => window.print() },
              ],
            },
          ]}
        />
      }
    >
      <section className="kpi-grid">
        {metrics.map((metric) => (
          <KpiCard key={metric.label} metric={metric} tone="reports" />
        ))}
      </section>

      <DateRangeControl
        title="BI analysis window"
        value={selection}
        onApply={setSelection}
        applyLabel="Refresh analytics"
      />

      <p className="note">{message}</p>

      <section className="bi-summary-grid" id="bi-trends">
        <div className="bi-insight-hero">
          <span className="section-eyebrow">Executive signal</span>
          <h3>Current business movement is flowing live from journals, invoices, tax, and balances.</h3>
          <p>
            Use this workspace to spot revenue momentum, posting throughput, statutory pressure, and concentration risk
            without leaving the ERP.
          </p>
          <div className="bi-insight-hero__stats">
            <div>
              <span>Revenue trend</span>
              <strong>{metrics[0]?.value ?? "-"}</strong>
            </div>
            <div>
              <span>Posting throughput</span>
              <strong>{metrics[1]?.value ?? "-"}</strong>
            </div>
            <div>
              <span>Tax pressure</span>
              <strong>{metrics[2]?.value ?? "-"}</strong>
            </div>
          </div>
        </div>

        <DonutBreakdown title="Balance mix by account type" rows={donutRows} />
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Trend analysis" eyebrow="Live charts and graphs">
          {loading ? (
            <EmptyState tone="reports" title="Loading analytics" body="Pulling live journals, invoices, tax, and balance data." />
          ) : (
            <div className="bi-chart-grid">
              <LineChart
                title="Revenue trend"
                subtitle="Invoice totals across the current analysis window."
                points={revenueTrend}
                tone="sales"
              />
              <LineChart
                title="Posting activity"
                subtitle="Journal volume translated into posting value."
                points={journalTrend}
                tone="finance"
              />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Executive watchlist" eyebrow="Updates and anomalies">
          <div className="watchlist-stack">
            {updates.length > 0 ? (
              updates.map((item) => (
                <article key={item.id} className="watchlist-row">
                  <div>
                    <span className="section-eyebrow">{item.source}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <div className="watchlist-row__meta">
                    <StatusBadge status={item.status} />
                    <span>{item.time}</span>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState tone="reports" title="No updates yet" body="Current live feeds will appear here as transactions come in." />
            )}
          </div>
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Financial mix" eyebrow="Balance composition">
          {typeDistribution.length > 0 ? (
            <DistributionChart title="Closing balance by account type" rows={typeDistribution} />
          ) : (
            <EmptyState tone="reports" title="No balance mix yet" body="Trial balance activity will populate this chart." />
          )}
        </SectionCard>

        <SectionCard title="Insight actions" eyebrow="Controls">
          <div className="module-page-grid">
            <article className="module-card module-card--reports">
              <span className="section-eyebrow">Export</span>
              <h3>Download analytics pack</h3>
              <p>Take the current KPI snapshot to CSV, Excel, or PDF for leadership review.</p>
              <div className="inline-actions">
                <button className="ghost-button small" type="button" onClick={() => exportSnapshot("csv")}>CSV</button>
                <button className="ghost-button small" type="button" onClick={() => exportSnapshot("xlsx")}>Excel</button>
                <button className="ghost-button small" type="button" onClick={() => exportSnapshot("pdf")}>PDF</button>
              </div>
            </article>
            <article className="module-card module-card--finance">
              <span className="section-eyebrow">Drill-through</span>
              <h3>Trace live sources</h3>
              <p>Use the tables below to move from top-line metrics into underlying customers, accounts, and postings.</p>
              <div className="inline-actions">
                <button className="ghost-button small with-icon" type="button" onClick={refresh}>
                  <RefreshCw size={14} /> Refresh data
                </button>
              </div>
            </article>
            <article className="module-card module-card--company">
              <span className="section-eyebrow">Visibility</span>
              <h3>Current workspace</h3>
              <p>{activeCompany?.name ?? "Active company"} · {selection.label}</p>
              <div className="inline-actions">
                <button className="ghost-button small with-icon" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                  <Eye size={14} /> Review filters
                </button>
              </div>
            </article>
          </div>
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Top customers" eyebrow="Customer analytics">
          <div id="bi-customers" />
          <DataTable
            title="Revenue concentration"
            tableId="bi-top-customers"
            exportFileName="bi-top-customers"
            rows={customerRows.map((row) => ({
              ...row,
              id: row.id,
              totalFormatted: formatCurrency(row.total),
              averageFormatted: formatCurrency(row.average),
              latestDateFormatted: toDateLabel(row.latestDate),
            }))}
            searchValue={(row) => `${row.customer} ${row.totalFormatted}`}
            advancedFilters={[
              { key: "customer", label: "Customer", type: "text", getValue: (row) => row.customer },
              { key: "status", label: "Status", type: "select", getValue: (row) => row.status, options: [...new Set(customerRows.map((row) => row.status))].map((value) => ({ value, label: value })) },
              { key: "invoices", label: "Invoices", type: "number-range", getValue: (row) => row.invoices },
              { key: "total", label: "Total value", type: "number-range", getValue: (row) => row.total },
              { key: "latestInvoice", label: "Latest invoice", type: "date-range", getValue: (row) => row.latestDate },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            emptyTitle={loading ? "Loading customers" : "No invoice analytics yet"}
            emptyMessage={loading ? "Reading live customer invoice activity." : "Create invoices to populate customer analytics."}
            columns={[
              { key: "customer", label: "Customer", render: (row) => <strong>{row.customer}</strong>, exportValue: (row) => row.customer },
              { key: "invoices", label: "Invoices", className: "numeric", render: (row) => row.invoices, exportValue: (row) => row.invoices },
              { key: "totalFormatted", label: "Total value", className: "numeric", render: (row) => row.totalFormatted, exportValue: (row) => row.totalFormatted },
              { key: "averageFormatted", label: "Average invoice", className: "numeric", render: (row) => row.averageFormatted, exportValue: (row) => row.averageFormatted },
              { key: "latestDateFormatted", label: "Latest invoice", render: (row) => row.latestDateFormatted, exportValue: (row) => row.latestDateFormatted },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} />, exportValue: (row) => row.status },
            ]}
          />
        </SectionCard>

        <SectionCard title="Balance watchlist" eyebrow="Account analytics">
          <DataTable
            title="Largest balances"
            tableId="bi-balance-watchlist"
            exportFileName="bi-balance-watchlist"
            rows={watchlist.map((row) => ({
              ...row,
              id: row.id,
              balanceFormatted: formatCurrency(row.balance),
            }))}
            searchValue={(row) => `${row.account} ${row.balanceFormatted}`}
            advancedFilters={[
              { key: "account", label: "Account", type: "text", getValue: (row) => row.account },
              { key: "balance", label: "Balance", type: "number-range", getValue: (row) => row.balance },
              { key: "entries", label: "Entries", type: "number-range", getValue: (row) => row.entries },
              { key: "lastActivity", label: "Last activity", type: "date-range", getValue: (row) => row.rawLastActivity },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            emptyTitle={loading ? "Loading balances" : "No balances yet"}
            emptyMessage={loading ? "Reading account statement summary." : "Live balance analytics will appear here when postings exist."}
            columns={[
              { key: "account", label: "Account", render: (row) => <strong>{row.account}</strong>, exportValue: (row) => row.account },
              { key: "balanceFormatted", label: "Balance", className: "numeric", render: (row) => row.balanceFormatted, exportValue: (row) => row.balanceFormatted },
              { key: "entries", label: "Entries", className: "numeric", render: (row) => row.entries, exportValue: (row) => row.entries },
              { key: "lastActivity", label: "Last activity", render: (row) => row.lastActivity, exportValue: (row) => row.lastActivity },
            ]}
          />
        </SectionCard>
      </section>
    </WorkspaceShell>
  );
}
