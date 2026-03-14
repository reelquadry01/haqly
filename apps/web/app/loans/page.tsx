"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { useWorkspace } from "../../hooks/use-workspace";
import { createLoan, createLoanPayment, getLoans, type LoanRecord } from "../../lib/api";
import type { KpiMetric } from "../../lib/erp";

function currency(amount: string | number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(amount ?? 0));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export default function LoansPage() {
  const { session } = useWorkspace();
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<number | "">("");
  const [message, setMessage] = useState("Manage facilities, repayments, and amortization schedules from the same treasury workspace.");
  const [loanDraft, setLoanDraft] = useState({
    code: "",
    lender: "",
    type: "TERM" as "TERM" | "REVOLVING",
    principal: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: addMonths(new Date(), 12).toISOString().slice(0, 10),
    baseRate: "18.5",
    spread: "0",
    scheduleType: "ANNUITY" as "ANNUITY" | "INTEREST_ONLY" | "BALLOON" | "CUSTOM",
  });
  const [paymentDraft, setPaymentDraft] = useState({
    principalPaid: "",
    interestPaid: "",
    feesPaid: "0",
    paymentDate: new Date().toISOString().slice(0, 10),
  });

  async function loadLoans(token: string) {
    const rows = await getLoans(token);
    setLoans(rows);
    setSelectedLoanId((current) => current || rows[0]?.id || "");
  }

  useEffect(() => {
    if (!session?.token) return;
    loadLoans(session.token).catch((error) => setMessage(error instanceof Error ? error.message : "Could not load loans."));
  }, [session?.token]);

  const selectedLoan = loans.find((loan) => loan.id === selectedLoanId) ?? null;

  const generatedSchedule = useMemo(() => {
    if (!selectedLoan) return [];
    if (selectedLoan.schedules && selectedLoan.schedules.length > 0) {
      return selectedLoan.schedules.map((line) => ({
        id: String(line.id),
        installment: line.installment,
        dueDate: shortDate(line.dueDate),
        rawDueDate: line.dueDate,
        principalDue: Number(line.principalDue),
        interestDue: Number(line.interestDue),
        feesDue: Number(line.feesDue),
        balanceAfter: null as number | null,
        status: line.status,
        source: "Stored schedule",
      }));
    }

    const principal = Number(selectedLoan.principal ?? 0);
    const annualRate = Number(selectedLoan.baseRate ?? 0) + Number(selectedLoan.spread ?? 0);
    const start = new Date(selectedLoan.startDate);
    const end = selectedLoan.endDate ? new Date(selectedLoan.endDate) : addMonths(start, 12);
    const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1);
    const monthlyRate = annualRate / 100 / 12;
    const payment =
      selectedLoan.scheduleType === "ANNUITY" && monthlyRate > 0
        ? (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
        : principal / months;
    let balance = principal;

    return Array.from({ length: months }).map((_, index) => {
      const interestDue = selectedLoan.scheduleType === "INTEREST_ONLY" ? balance * monthlyRate : balance * monthlyRate;
      const principalDue =
        selectedLoan.scheduleType === "INTEREST_ONLY"
          ? index === months - 1
            ? balance
            : 0
          : Math.min(balance, payment - interestDue);
      balance = Math.max(0, balance - principalDue);
      return {
        id: `derived-${index + 1}`,
        installment: index + 1,
        dueDate: shortDate(addMonths(start, index + 1).toISOString()),
        rawDueDate: addMonths(start, index + 1).toISOString(),
        principalDue,
        interestDue,
        feesDue: 0,
        balanceAfter: balance,
        status: balance === 0 ? "CLOSING" : "PROJECTED",
        source: "Derived from loan terms",
      };
    });
  }, [selectedLoan]);

  const metrics = useMemo<KpiMetric[]>(() => {
    const totalPrincipal = loans.reduce((sum, loan) => sum + Number(loan.principal ?? 0), 0);
    const totalPaid = loans.reduce((sum, loan) => sum + (loan.payments ?? []).reduce((loanSum, payment) => loanSum + Number(payment.principalPaid ?? 0), 0), 0);
    return [
      { label: "Loan facilities", value: String(loans.length), delta: currency(totalPrincipal), trend: loans.length ? "up" : "neutral", detail: "Facilities available in treasury" },
      { label: "Amortization lines", value: String(generatedSchedule.length), delta: selectedLoan ? selectedLoan.code : "No loan selected", trend: generatedSchedule.length ? "up" : "neutral", detail: "Schedule sub-module for the selected facility" },
      { label: "Principal paid", value: currency(totalPaid), delta: "Across recorded payments", trend: totalPaid > 0 ? "up" : "neutral", detail: "Principal reduction recorded so far" },
      { label: "Repayments logged", value: String(loans.reduce((sum, loan) => sum + (loan.payments?.length ?? 0), 0)), delta: "Payment history", trend: "neutral", detail: "Treasury payment records across facilities" },
    ];
  }, [generatedSchedule.length, loans, selectedLoan]);

  const loanRows = loans.map((loan) => ({
    id: String(loan.id),
    code: loan.code,
    lender: loan.lender,
    type: loan.type,
    principal: Number(loan.principal),
    startDate: shortDate(loan.startDate),
    rawStartDate: loan.startDate,
    scheduleType: loan.scheduleType,
  }));

  const paymentRows = (selectedLoan?.payments ?? []).map((payment) => ({
    id: String(payment.id),
    paymentDate: shortDate(payment.paymentDate),
    rawPaymentDate: payment.paymentDate,
    principalPaid: Number(payment.principalPaid),
    interestPaid: Number(payment.interestPaid),
    feesPaid: Number(payment.feesPaid),
  }));

  async function saveLoan() {
    if (!session?.token || !loanDraft.code.trim() || !loanDraft.lender.trim() || !loanDraft.principal.trim()) {
      setMessage("Enter facility code, lender, and principal before creating the loan.");
      return;
    }
    try {
      await createLoan(session.token, {
        code: loanDraft.code.trim(),
        lender: loanDraft.lender.trim(),
        type: loanDraft.type,
        principal: Number(loanDraft.principal),
        startDate: loanDraft.startDate,
        endDate: loanDraft.endDate || undefined,
        baseRate: Number(loanDraft.baseRate || 0),
        spread: Number(loanDraft.spread || 0),
        scheduleType: loanDraft.scheduleType,
      });
      await loadLoans(session.token);
      setLoanDraft({
        code: "",
        lender: "",
        type: "TERM",
        principal: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: addMonths(new Date(), 12).toISOString().slice(0, 10),
        baseRate: "18.5",
        spread: "0",
        scheduleType: "ANNUITY",
      });
      setMessage("Loan facility created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create loan.");
    }
  }

  async function recordPayment() {
    if (!session?.token || !selectedLoanId || !paymentDraft.principalPaid.trim() || !paymentDraft.interestPaid.trim()) {
      setMessage("Select a loan and enter principal and interest paid.");
      return;
    }
    try {
      await createLoanPayment(session.token, {
        loanId: Number(selectedLoanId),
        paymentDate: paymentDraft.paymentDate,
        principalPaid: Number(paymentDraft.principalPaid),
        interestPaid: Number(paymentDraft.interestPaid),
        feesPaid: Number(paymentDraft.feesPaid || 0),
      });
      await loadLoans(session.token);
      setPaymentDraft({
        principalPaid: "",
        interestPaid: "",
        feesPaid: "0",
        paymentDate: new Date().toISOString().slice(0, 10),
      });
      setMessage("Loan payment recorded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not record payment.");
    }
  }

  return (
    <WorkspaceShell
      title="Loans"
      description="Monitor facilities, repayments, and amortization schedule sub-modules with treasury visibility."
      requiredRoles={["cfo", "accountant", "admin", "ceo"]}
      tabs={["Dashboard", "Facilities", "Amortization Schedule", "Repayments", "Controls"]}
      activeTab="Facilities"
      pageActions={
        <ModuleActionBar
          primaryAction={<button className="primary-button" type="button" onClick={saveLoan}>Add facility</button>}
          summary="Facility creation stays visible. Payment capture, amortization review, and repayment analysis now sit in grouped menus above."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Record payment",
                  description: "Apply a repayment to the selected facility",
                  onSelect: () => void recordPayment(),
                },
                {
                  label: "Loan action desk",
                  description: "Jump to facility setup and payment capture",
                  onSelect: () => document.getElementById("loans-action-desk")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
            {
              label: "Reports",
              items: [
                {
                  label: "Amortization schedule",
                  description: "Open the facility schedule section below",
                  onSelect: () => document.getElementById("loans-amortization-schedule")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Repayment history",
                  description: "Jump to recorded loan payments",
                  onSelect: () => document.getElementById("loans-repayments")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
          ]}
        />
      }
    >
      <section className="kpi-grid">
        {metrics.map((metric) => <KpiCard key={metric.label} metric={metric} tone="loans" />)}
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Loan action desk" eyebrow="Facility setup and treasury capture">
          <div className="action-form-stack" id="loans-action-desk">
            <div className="form-grid two-up">
              <label className="field">
                <span>Facility code</span>
                <input value={loanDraft.code} onChange={(event) => setLoanDraft((current) => ({ ...current, code: event.target.value }))} placeholder="LN-002" />
              </label>
              <label className="field">
                <span>Lender</span>
                <input value={loanDraft.lender} onChange={(event) => setLoanDraft((current) => ({ ...current, lender: event.target.value }))} placeholder="Sterling Bank" />
              </label>
            </div>
            <div className="form-grid two-up">
              <label className="field">
                <span>Principal</span>
                <input value={loanDraft.principal} onChange={(event) => setLoanDraft((current) => ({ ...current, principal: event.target.value }))} placeholder="1200000" />
              </label>
              <label className="field">
                <span>Schedule type</span>
                <select className="select-input" value={loanDraft.scheduleType} onChange={(event) => setLoanDraft((current) => ({ ...current, scheduleType: event.target.value as typeof loanDraft.scheduleType }))}>
                  <option value="ANNUITY">Annuity</option>
                  <option value="INTEREST_ONLY">Interest only</option>
                  <option value="BALLOON">Balloon</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </label>
            </div>
            <div className="form-grid two-up">
              <label className="field">
                <span>Base rate</span>
                <input value={loanDraft.baseRate} onChange={(event) => setLoanDraft((current) => ({ ...current, baseRate: event.target.value }))} />
              </label>
              <label className="field">
                <span>Spread</span>
                <input value={loanDraft.spread} onChange={(event) => setLoanDraft((current) => ({ ...current, spread: event.target.value }))} />
              </label>
            </div>
            <div className="form-grid two-up">
              <label className="field">
                <span>Start date</span>
                <input type="date" value={loanDraft.startDate} onChange={(event) => setLoanDraft((current) => ({ ...current, startDate: event.target.value }))} />
              </label>
              <label className="field">
                <span>End date</span>
                <input type="date" value={loanDraft.endDate} onChange={(event) => setLoanDraft((current) => ({ ...current, endDate: event.target.value }))} />
              </label>
            </div>
            <label className="field">
              <span>Selected facility for payment</span>
              <select className="select-input" value={selectedLoanId} onChange={(event) => setSelectedLoanId(Number(event.target.value))}>
                <option value="">Select facility</option>
                {loans.map((loan) => (
                  <option key={loan.id} value={loan.id}>
                    {loan.code} - {loan.lender}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid three-up">
              <label className="field">
                <span>Principal paid</span>
                <input value={paymentDraft.principalPaid} onChange={(event) => setPaymentDraft((current) => ({ ...current, principalPaid: event.target.value }))} />
              </label>
              <label className="field">
                <span>Interest paid</span>
                <input value={paymentDraft.interestPaid} onChange={(event) => setPaymentDraft((current) => ({ ...current, interestPaid: event.target.value }))} />
              </label>
              <label className="field">
                <span>Fees paid</span>
                <input value={paymentDraft.feesPaid} onChange={(event) => setPaymentDraft((current) => ({ ...current, feesPaid: event.target.value }))} />
              </label>
            </div>
            <label className="field">
              <span>Payment date</span>
              <input type="date" value={paymentDraft.paymentDate} onChange={(event) => setPaymentDraft((current) => ({ ...current, paymentDate: event.target.value }))} />
            </label>
            <p className="note">{message}</p>
          </div>
        </SectionCard>

        <SectionCard title="Amortization schedule sub-module" eyebrow="Facility-by-facility schedule visibility">
          <div id="loans-amortization-schedule" />
          {!selectedLoan ? (
            <EmptyState tone="finance" title="No facility selected" body="Select a loan to view the amortization schedule. If no stored schedule exists yet, the system derives one from the live loan terms." />
          ) : (
            <DataTable
              title={`Amortization schedule - ${selectedLoan.code}`}
              tableId="loan-amortization-schedule"
              exportFileName="loan-amortization-schedule"
              rows={generatedSchedule}
              searchValue={(row) => `${row.installment} ${row.status} ${row.source}`}
              advancedFilters={[
                {
                  key: "status",
                  label: "Status",
                  type: "select",
                  getValue: (row) => row.status,
                  options: [
                    { value: "Scheduled", label: "Scheduled" },
                    { value: "Recorded", label: "Recorded" },
                    { value: "Projected", label: "Projected" },
                  ],
                },
                { key: "source", label: "Source", type: "text", getValue: (row) => row.source },
                { key: "dueDate", label: "Due date", type: "date-range", getValue: (row) => row.rawDueDate },
                { key: "principalDue", label: "Principal due", type: "number-range", getValue: (row) => row.principalDue },
              ]}
              bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
              columns={[
                { key: "installment", label: "Installment", className: "numeric", render: (row) => row.installment, exportValue: (row) => row.installment },
                { key: "dueDate", label: "Due date", render: (row) => row.dueDate, exportValue: (row) => row.dueDate },
                { key: "principalDue", label: "Principal", className: "numeric", render: (row) => currency(row.principalDue), exportValue: (row) => row.principalDue },
                { key: "interestDue", label: "Interest", className: "numeric", render: (row) => currency(row.interestDue), exportValue: (row) => row.interestDue },
                { key: "feesDue", label: "Fees", className: "numeric", render: (row) => currency(row.feesDue), exportValue: (row) => row.feesDue },
                { key: "balanceAfter", label: "Balance after", className: "numeric", render: (row) => (row.balanceAfter === null ? "-" : currency(row.balanceAfter)), exportValue: (row) => row.balanceAfter ?? "" },
                { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status === "PENDING" || row.status === "PROJECTED" ? "Pending" : "Approved"} />, exportValue: (row) => row.status },
              ]}
            />
          )}
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Facility register" eyebrow="Loan master">
          <DataTable
            title="Loans"
            tableId="loan-facilities"
            exportFileName="loan-facilities"
            rows={loanRows}
            searchValue={(row) => `${row.code} ${row.lender} ${row.type}`}
            advancedFilters={[
              { key: "facilityCode", label: "Facility code", type: "text", getValue: (row) => row.code },
              { key: "lender", label: "Lender", type: "text", getValue: (row) => row.lender },
              { key: "type", label: "Type", type: "select", getValue: (row) => row.type, options: [...new Set(loanRows.map((row) => row.type))].map((value) => ({ value, label: value })) },
              { key: "startDate", label: "Start date", type: "date-range", getValue: (row) => row.rawStartDate },
              { key: "principal", label: "Principal", type: "number-range", getValue: (row) => row.principal },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            emptyTitle="No facilities yet"
            emptyMessage="Create a loan facility from the action desk to populate this register."
            columns={[
              { key: "code", label: "Facility", render: (row) => <strong>{row.code}</strong>, exportValue: (row) => row.code },
              { key: "lender", label: "Lender", render: (row) => row.lender, exportValue: (row) => row.lender },
              { key: "type", label: "Type", render: (row) => row.type, exportValue: (row) => row.type },
              { key: "principal", label: "Principal", className: "numeric", render: (row) => currency(row.principal), exportValue: (row) => row.principal },
              { key: "startDate", label: "Start date", render: (row) => row.startDate, exportValue: (row) => row.startDate },
              { key: "scheduleType", label: "Schedule type", render: (row) => row.scheduleType, exportValue: (row) => row.scheduleType },
            ]}
          />
        </SectionCard>

        <SectionCard title="Repayment log" eyebrow="Posted treasury activity">
          <div id="loans-repayments" />
          <DataTable
            title="Loan payments"
            tableId="loan-payments"
            exportFileName="loan-payments"
            rows={paymentRows}
            searchValue={(row) => `${row.paymentDate} ${row.principalPaid} ${row.interestPaid}`}
            advancedFilters={[
              { key: "paymentDate", label: "Payment date", type: "date-range", getValue: (row) => row.rawPaymentDate },
              { key: "principalPaid", label: "Principal paid", type: "number-range", getValue: (row) => row.principalPaid },
              { key: "interestPaid", label: "Interest paid", type: "number-range", getValue: (row) => row.interestPaid },
              { key: "feesPaid", label: "Fees paid", type: "number-range", getValue: (row) => row.feesPaid },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            emptyTitle="No loan payments yet"
            emptyMessage="Record a payment against a selected facility to populate the repayment log."
            columns={[
              { key: "paymentDate", label: "Date", render: (row) => row.paymentDate, exportValue: (row) => row.paymentDate },
              { key: "principalPaid", label: "Principal paid", className: "numeric", render: (row) => currency(row.principalPaid), exportValue: (row) => row.principalPaid },
              { key: "interestPaid", label: "Interest paid", className: "numeric", render: (row) => currency(row.interestPaid), exportValue: (row) => row.interestPaid },
              { key: "feesPaid", label: "Fees paid", className: "numeric", render: (row) => currency(row.feesPaid), exportValue: (row) => row.feesPaid },
            ]}
          />
        </SectionCard>
      </section>
    </WorkspaceShell>
  );
}
