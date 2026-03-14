"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { useWorkspace } from "../../hooks/use-workspace";
import { getAccountingJournals, getTrialBalance, type AccountingJournal, type TrialBalanceResponse } from "../../lib/api";
import { financialManagementViews, type KpiMetric } from "../../lib/erp";

function currency(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}

export default function FinancialManagementPage() {
  const router = useRouter();
  const { session } = useWorkspace();
  const [journals, setJournals] = useState<AccountingJournal[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResponse | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session?.token) return;
    Promise.all([getAccountingJournals(session.token), getTrialBalance(session.token)])
      .then(([journalRows, tb]) => {
        setJournals(journalRows);
        setTrialBalance(tb);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load financial management data."));
  }, [session?.token]);

  const metrics = useMemo<KpiMetric[]>(() => {
    const debitVolume = journals.reduce((sum, journal) => sum + journal.lines.reduce((lineSum, line) => lineSum + Number(line.debit ?? 0), 0), 0);
    const creditVolume = journals.reduce((sum, journal) => sum + journal.lines.reduce((lineSum, line) => lineSum + Number(line.credit ?? 0), 0), 0);
    const workingCapital = (trialBalance?.totals.closingDebit ?? 0) - (trialBalance?.totals.closingCredit ?? 0);
    return [
      { label: "Profit visibility", value: currency((trialBalance?.totals.periodCredit ?? 0) - (trialBalance?.totals.periodDebit ?? 0)), delta: "Period movement", trend: "neutral", detail: "High-level period profit/loss signal" },
      { label: "Cash flow lens", value: currency(debitVolume), delta: currency(creditVolume), trend: debitVolume >= creditVolume ? "up" : "down", detail: "Debit vs credit movement from live journals" },
      { label: "Working capital", value: currency(workingCapital), delta: `${trialBalance?.rows.length ?? 0} accounts`, trend: workingCapital >= 0 ? "up" : "down", detail: "Closing balance spread from Trial Balance" },
      { label: "Financial control", value: String(journals.length), delta: "Posted journals", trend: journals.length ? "up" : "neutral", detail: "Journal volume currently in the ledger" },
    ];
  }, [journals, trialBalance]);

  const journalRows = journals.slice(0, 8).map((journal) => ({
    id: String(journal.id),
    reference: journal.reference,
    description: journal.description || journal.type,
    lines: journal.lines.length,
    rawAmount: journal.lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0),
    amount: currency(journal.lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0)),
  }));

  return (
    <WorkspaceShell
      title="Financial Management"
      description="A finance leadership workspace for profit, loss, cash flow, working capital, and financial control."
      requiredRoles={["cfo", "accountant", "admin", "ceo"]}
      tabs={financialManagementViews}
      activeTab="Overview"
      pageActions={
        <ModuleActionBar
          primaryLabel="Open finance workspace"
          onPrimaryAction={() => router.push("/finance")}
          summary="Keep leadership actions focused here, and move ledger-heavy work into Finance and Reports."
          secondaryGroups={[
            {
              label: "Reports",
              items: [
                { label: "Trial Balance", href: "/reports", description: "Open standard accounting reports" },
                { label: "Account statements", href: "/reports", description: "Review detailed account activity" },
              ],
            },
            {
              label: "Actions",
              items: [
                {
                  label: "Control board",
                  description: "Jump to live period performance",
                  onSelect: () => document.getElementById("financial-control-board")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Recent journals",
                  description: "Jump to the journal review table",
                  onSelect: () => document.getElementById("financial-journal-review")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
            {
              label: "More",
              items: [
                { label: "Journal entries", href: "/journal-entries", description: "Open the controlled journal workspace" },
                { label: "General Ledger", href: "/finance", description: "Open the core GL workbench" },
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

      <section className="content-grid split-65">
        <SectionCard title="Financial control board" eyebrow="Live period performance">
          <div id="financial-control-board" />
          {trialBalance ? (
            <div className="alert-list compact">
              <article className="action-card left-align">
                <strong>Opening balances</strong>
                <span>Debit {currency(trialBalance.totals.openingDebit)} | Credit {currency(trialBalance.totals.openingCredit)}</span>
              </article>
              <article className="action-card left-align">
                <strong>Period movement</strong>
                <span>Debit {currency(trialBalance.totals.periodDebit)} | Credit {currency(trialBalance.totals.periodCredit)}</span>
              </article>
              <article className="action-card left-align">
                <strong>Closing balances</strong>
                <span>Debit {currency(trialBalance.totals.closingDebit)} | Credit {currency(trialBalance.totals.closingCredit)}</span>
              </article>
            </div>
          ) : (
            <EmptyState tone="finance" title="No financial control data yet" body="Post journals and refresh this workspace to see profit, loss, and control summaries." />
          )}
        </SectionCard>

        <SectionCard title="Finance signals" eyebrow="Executive interpretation">
          <div className="alert-list compact">
            <article className="alert-row info"><div><strong>Profit and loss</strong><p>Track credit-heavy vs debit-heavy periods using the same ledgers feeding Trial Balance and account statements.</p></div></article>
            <article className="alert-row info"><div><strong>Cash flow</strong><p>Use journal movement as the live bridge until a dedicated cash flow statement endpoint is exposed.</p></div></article>
            <article className="alert-row info"><div><strong>Controls</strong><p>Drill into the core finance workspace for journals, GL, vouchers, and chart of accounts exports.</p></div></article>
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Recent journal activity" eyebrow="Linked to core finance">
        <div id="financial-journal-review" />
        <DataTable
          title="Financial journals"
          tableId="financial-management-journals"
          exportFileName="financial-management-journals"
          rows={journalRows}
          searchValue={(row) => `${row.reference} ${row.description}`}
          advancedFilters={[
            { key: "reference", label: "Reference", type: "text", getValue: (row) => row.reference },
            { key: "description", label: "Description", type: "text", getValue: (row) => row.description },
            { key: "lines", label: "Line count", type: "number-range", getValue: (row) => row.lines },
            { key: "amount", label: "Amount", type: "number-range", getValue: (row) => row.rawAmount },
          ]}
          bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
          emptyTitle="No journals yet"
          emptyMessage={message || "Once journals exist, they will appear here for financial review."}
          columns={[
            { key: "reference", label: "Reference", render: (row) => <strong>{row.reference}</strong>, exportValue: (row) => row.reference },
            { key: "description", label: "Description", render: (row) => row.description, exportValue: (row) => row.description },
            { key: "lines", label: "Lines", className: "numeric", render: (row) => row.lines, exportValue: (row) => row.lines },
            { key: "amount", label: "Amount", className: "numeric", render: (row) => row.amount, exportValue: (row) => row.amount },
          ]}
        />
      </SectionCard>
    </WorkspaceShell>
  );
}
