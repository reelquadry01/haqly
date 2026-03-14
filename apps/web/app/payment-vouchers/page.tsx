"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileDown, Plus, RefreshCw, Save, Send, Wallet } from "lucide-react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { ViewToolbar } from "../../components/ui/view-toolbar";
import { useWorkspace } from "../../hooks/use-workspace";
import {
  addPaymentVoucherComment,
  approvePaymentVoucher,
  cancelPaymentVoucher,
  createPaymentVoucherDraft,
  getPaymentVoucher,
  getPaymentVoucherApprovalQueue,
  getPaymentVoucherMetadata,
  getPaymentVouchers,
  initiateVoucherPayment,
  markPaymentVoucherPaid,
  postPaymentVoucher,
  previewPaymentVoucher,
  rejectPaymentVoucher,
  returnPaymentVoucherForCorrection,
  submitPaymentVoucher,
  updatePaymentVoucherDraft,
  validatePaymentVoucher,
  type PaymentVoucherMetadataResponse,
  type PaymentVoucherPayload,
  type PaymentVoucherRecord,
  type PaymentVoucherStatus,
  type PaymentVoucherType,
} from "../../lib/api";
import { exportPaymentVoucherPdf, previewPaymentVoucherDocument, printPaymentVoucherDocument } from "../../lib/payment-voucher-documents";
import type { AppStatus, KpiMetric } from "../../lib/erp";

type EditorLine = {
  id: string;
  lineType: string;
  accountId: number | "";
  description: string;
  grossAmount: string;
  taxAmount: string;
  withholdingTaxAmount: string;
  netAmount: string;
  taxCodeId: number | "";
  withholdingTaxCodeId: number | "";
  costCenterId: number | "";
  projectId: number | "";
};

type VoucherEditor = {
  id?: number;
  voucherNumber?: string;
  status: PaymentVoucherStatus;
  voucherType: PaymentVoucherType;
  beneficiaryType: string;
  beneficiaryName: string;
  supplierId: number | "";
  paymentMethod: string;
  bankAccountId: number | "";
  cashAccountId: number | "";
  branchId: number | "";
  accountingPeriodId: number | "";
  fiscalYearId: number | "";
  voucherDate: string;
  requestedPaymentDate: string;
  postingDate: string;
  currencyCode: string;
  exchangeRate: string;
  referenceNumber: string;
  narration: string;
  purposeOfPayment: string;
  templateId: number | "";
  requiresAttachment: boolean;
  lines: EditorLine[];
};

function makeId() { return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`; }
function amount(value: string | number | null | undefined) { return Number(value ?? 0); }
function money(value: string | number | null | undefined, currencyCode = "NGN") { return new Intl.NumberFormat("en-NG", { style: "currency", currency: currencyCode, maximumFractionDigits: 2 }).format(amount(value)); }
function statusTone(status: PaymentVoucherStatus): AppStatus { if (["APPROVED", "POSTED", "PAID"].includes(status)) return "Approved"; if (["REJECTED", "FAILED_PAYMENT"].includes(status)) return "Rejected"; if (["PENDING_APPROVAL", "PARTIALLY_APPROVED"].includes(status)) return "Pending"; if (status === "CANCELLED") return "Archived"; return "Draft"; }
function buildLine(defaults?: Partial<EditorLine>): EditorLine { return { id: makeId(), lineType: defaults?.lineType ?? "EXPENSE", accountId: defaults?.accountId ?? "", description: defaults?.description ?? "", grossAmount: defaults?.grossAmount ?? "", taxAmount: defaults?.taxAmount ?? "", withholdingTaxAmount: defaults?.withholdingTaxAmount ?? "", netAmount: defaults?.netAmount ?? "", taxCodeId: defaults?.taxCodeId ?? "", withholdingTaxCodeId: defaults?.withholdingTaxCodeId ?? "", costCenterId: defaults?.costCenterId ?? "", projectId: defaults?.projectId ?? "" }; }
function buildEditor(metadata: PaymentVoucherMetadataResponse, branchId: number | null): VoucherEditor { const openPeriod = metadata.periods.find((period) => period.status === "OPEN") ?? metadata.periods[0]; return { status: "DRAFT", voucherType: metadata.voucherTypes[0] ?? "VENDOR_PAYMENT", beneficiaryType: metadata.beneficiaryTypes[0] ?? "VENDOR", beneficiaryName: "", supplierId: "", paymentMethod: metadata.paymentMethods[0] ?? "BANK_TRANSFER", bankAccountId: metadata.bankAccounts[0]?.id ?? "", cashAccountId: "", branchId: branchId ?? "", accountingPeriodId: openPeriod?.id ?? "", fiscalYearId: openPeriod?.fiscalYearId ?? metadata.fiscalYears[0]?.id ?? "", voucherDate: new Date().toISOString().slice(0, 10), requestedPaymentDate: new Date().toISOString().slice(0, 10), postingDate: new Date().toISOString().slice(0, 10), currencyCode: metadata.company.currencyCode ?? "NGN", exchangeRate: "1", referenceNumber: "", narration: "", purposeOfPayment: "", templateId: metadata.templates[0]?.id ?? "", requiresAttachment: false, lines: [buildLine(), buildLine()] }; }
function hydrateEditor(voucher: PaymentVoucherRecord): VoucherEditor { return { id: voucher.id, voucherNumber: voucher.voucherNumber, status: voucher.status, voucherType: voucher.voucherType, beneficiaryType: voucher.beneficiaryType, beneficiaryName: voucher.beneficiaryName, supplierId: voucher.supplierId ?? "", paymentMethod: voucher.paymentMethod, bankAccountId: voucher.bankAccountId ?? "", cashAccountId: voucher.cashAccountId ?? "", branchId: voucher.branchId ?? "", accountingPeriodId: voucher.accountingPeriodId ?? "", fiscalYearId: voucher.fiscalYearId ?? "", voucherDate: voucher.voucherDate.slice(0,10), requestedPaymentDate: voucher.requestedPaymentDate.slice(0,10), postingDate: voucher.postingDate.slice(0,10), currencyCode: voucher.currencyCode, exchangeRate: String(voucher.exchangeRate ?? 1), referenceNumber: voucher.referenceNumber ?? "", narration: voucher.narration, purposeOfPayment: voucher.purposeOfPayment, templateId: voucher.template?.id ?? "", requiresAttachment: voucher.requiresAttachment, lines: voucher.lines.map((line) => buildLine({ lineType: line.lineType, accountId: line.accountId, description: line.description, grossAmount: String(line.grossAmount ?? ""), taxAmount: String(line.taxAmount ?? ""), withholdingTaxAmount: String(line.withholdingTaxAmount ?? ""), netAmount: String(line.netAmount ?? ""), taxCodeId: line.taxCodeId ?? "", withholdingTaxCodeId: line.withholdingTaxCodeId ?? "", costCenterId: line.costCenterId ?? "", projectId: line.projectId ?? "" })) }; }

export default function PaymentVouchersPage() {
  const { session, activeCompany, activeBranch } = useWorkspace();
  const [metadata, setMetadata] = useState<PaymentVoucherMetadataResponse | null>(null);
  const [vouchers, setVouchers] = useState<PaymentVoucherRecord[]>([]);
  const [queue, setQueue] = useState<PaymentVoucherRecord[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<PaymentVoucherRecord | null>(null);
  const [editor, setEditor] = useState<VoucherEditor | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentVoucherStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [commentDraft, setCommentDraft] = useState("");

  const filteredVouchers = useMemo(() => vouchers.filter((voucher) => { if (statusFilter !== "ALL" && voucher.status !== statusFilter) return false; if (!search.trim()) return true; const haystack = [voucher.voucherNumber, voucher.beneficiaryName, voucher.narration, voucher.referenceNumber].filter(Boolean).join(" ").toLowerCase(); return haystack.includes(search.trim().toLowerCase()); }), [search, statusFilter, vouchers]);
  const totals = useMemo(() => { const gross = editor?.lines.reduce((sum, line) => sum + amount(line.grossAmount), 0) ?? 0; const tax = editor?.lines.reduce((sum, line) => sum + amount(line.taxAmount), 0) ?? 0; const withholding = editor?.lines.reduce((sum, line) => sum + amount(line.withholdingTaxAmount), 0) ?? 0; return { gross, tax, withholding, total: gross + tax, net: gross + tax - withholding }; }, [editor]);
  const metrics = useMemo<KpiMetric[]>(() => [{ label: "Voucher queue", value: String(vouchers.length), delta: `${queue.length} pending`, trend: queue.length ? "up" : "neutral", detail: "Active payment vouchers in this workspace" }, { label: "Net value", value: money(vouchers.reduce((sum, item) => sum + amount(item.netPaymentAmount), 0)), delta: `${filteredVouchers.length} visible`, trend: "neutral", detail: "Current voucher portfolio" }, { label: "Posted", value: String(vouchers.filter((item) => item.isPostedToGL).length), delta: `${vouchers.filter((item) => item.paymentStatus === "PAID").length} paid`, trend: "up", detail: "General-ledger linked vouchers" }], [filteredVouchers.length, queue.length, vouchers]);

  useEffect(() => { if (!session?.token || !activeCompany?.id) return; void loadWorkspace(); }, [session?.token, activeCompany?.id, activeBranch?.id]);

  async function loadWorkspace(preferredVoucherId?: number | null) {
    if (!session?.token || !activeCompany?.id) return;
    setLoading(true);
    try {
      const [meta, list, approvalQueue] = await Promise.all([getPaymentVoucherMetadata(session.token, activeCompany.id), getPaymentVouchers(session.token, { branchId: activeBranch?.id ?? undefined }), getPaymentVoucherApprovalQueue(session.token)]);
      setMetadata(meta); setVouchers(list); setQueue(approvalQueue);
      const targetId = preferredVoucherId ?? selectedVoucher?.id ?? list[0]?.id ?? null;
      if (targetId) { const detail = await getPaymentVoucher(session.token, targetId); setSelectedVoucher(detail); setEditor(hydrateEditor(detail)); }
      else { setSelectedVoucher(null); setEditor(buildEditor(meta, activeBranch?.id ?? null)); }
    } catch (error) { setMessageTone("error"); setMessage(error instanceof Error ? error.message : "Could not load payment vouchers."); }
    finally { setLoading(false); }
  }

  function updateEditor<K extends keyof VoucherEditor>(field: K, value: VoucherEditor[K]) { setEditor((current) => current ? { ...current, [field]: value } : current); }
  function updateLine(lineId: string, patch: Partial<EditorLine>) { setEditor((current) => current ? { ...current, lines: current.lines.map((line) => line.id === lineId ? { ...line, ...patch } : line) } : current); }

  async function saveDraft() {
    if (!session?.token || !activeCompany?.id || !editor) return;
    const payload: PaymentVoucherPayload = { voucherType: editor.voucherType, legalEntityId: activeCompany.id, branchId: Number(editor.branchId), beneficiaryType: editor.beneficiaryType as PaymentVoucherPayload["beneficiaryType"], beneficiaryName: editor.beneficiaryName, supplierId: editor.supplierId ? Number(editor.supplierId) : undefined, paymentMethod: editor.paymentMethod as PaymentVoucherPayload["paymentMethod"], bankAccountId: editor.bankAccountId ? Number(editor.bankAccountId) : undefined, cashAccountId: editor.cashAccountId ? Number(editor.cashAccountId) : undefined, currencyCode: editor.currencyCode, exchangeRate: amount(editor.exchangeRate), voucherDate: editor.voucherDate, requestedPaymentDate: editor.requestedPaymentDate, postingDate: editor.postingDate, accountingPeriodId: Number(editor.accountingPeriodId), fiscalYearId: editor.fiscalYearId ? Number(editor.fiscalYearId) : undefined, referenceNumber: editor.referenceNumber || undefined, narration: editor.narration, purposeOfPayment: editor.purposeOfPayment, requiresAttachment: editor.requiresAttachment, templateId: editor.templateId ? Number(editor.templateId) : undefined, lines: editor.lines.map((line) => ({ lineType: line.lineType, accountId: Number(line.accountId), description: line.description, grossAmount: amount(line.grossAmount), taxAmount: amount(line.taxAmount), withholdingTaxAmount: amount(line.withholdingTaxAmount), netAmount: amount(line.netAmount), taxCodeId: line.taxCodeId ? Number(line.taxCodeId) : undefined, withholdingTaxCodeId: line.withholdingTaxCodeId ? Number(line.withholdingTaxCodeId) : undefined, costCenterId: line.costCenterId ? Number(line.costCenterId) : undefined, projectId: line.projectId ? Number(line.projectId) : undefined })) };
    setBusy("save");
    try {
      const saved = editor.id ? await updatePaymentVoucherDraft(session.token, editor.id, payload) : await createPaymentVoucherDraft(session.token, payload);
      const detail = await getPaymentVoucher(session.token, saved.id);
      setSelectedVoucher(detail); setEditor(hydrateEditor(detail));
      await loadWorkspace(saved.id);
      setMessageTone("success"); setMessage(`Voucher ${detail.voucherNumber} saved.`);
    } catch (error) { setMessageTone("error"); setMessage(error instanceof Error ? error.message : "Could not save the voucher."); }
    finally { setBusy(""); }
  }

  async function runAction(action: "submit" | "approve" | "post" | "preview" | "print" | "pdf") {
    if (!session?.token || !editor) return;
    try {
      if (action === "preview" || action === "print" || action === "pdf") {
        const voucher = editor.id ? await previewPaymentVoucher(session.token, editor.id) : selectedVoucher;
        if (!voucher) throw new Error("Save the voucher draft first to preview the finance document.");
        const options = { company: activeCompany, branchName: activeBranch?.name };
        if (action === "preview") previewPaymentVoucherDocument(voucher, options);
        if (action === "print") printPaymentVoucherDocument(voucher, options);
        if (action === "pdf") exportPaymentVoucherPdf(voucher, options);
        return;
      }
      if (!editor.id) throw new Error("Save the voucher draft before continuing.");
      setBusy(action);
      const result = action === "submit" ? await submitPaymentVoucher(session.token, editor.id) : action === "approve" ? await approvePaymentVoucher(session.token, editor.id) : await postPaymentVoucher(session.token, editor.id);
      const detail = await getPaymentVoucher(session.token, result.id);
      setSelectedVoucher(detail); setEditor(hydrateEditor(detail)); await loadWorkspace(result.id);
      setMessageTone("success"); setMessage(`Voucher ${detail.voucherNumber} updated.`);
    } catch (error) { setMessageTone("error"); setMessage(error instanceof Error ? error.message : "Could not complete the voucher action."); }
    finally { setBusy(""); }
  }

  async function quickAction(kind: "reject" | "return" | "cancel" | "pay" | "mark-paid" | "validate") {
    if (!session?.token || !editor?.id) return;
    try {
      setBusy(kind);
      if (kind === "validate") { const result = await validatePaymentVoucher(session.token, editor.id); setMessageTone(result.valid ? "success" : "error"); setMessage(result.valid ? "Voucher validation passed." : result.errors.join(" ")); return; }
      const reason = kind === "reject" || kind === "return" || kind === "cancel" ? window.prompt("Enter reason") : "";
      const bankReference = kind === "mark-paid" ? window.prompt("Bank reference (optional)") : "";
      const result = kind === "reject" ? await rejectPaymentVoucher(session.token, editor.id, reason || "Rejected") : kind === "return" ? await returnPaymentVoucherForCorrection(session.token, editor.id, reason || "Returned for correction") : kind === "cancel" ? await cancelPaymentVoucher(session.token, editor.id, reason || "Cancelled") : kind === "pay" ? await initiateVoucherPayment(session.token, editor.id, { providerName: "MANUAL_TRANSFER", paymentChannel: "MANUAL_TRANSFER" }) : await markPaymentVoucherPaid(session.token, editor.id, { bankReference: bankReference || undefined });
      const detail = await getPaymentVoucher(session.token, result.id);
      setSelectedVoucher(detail); setEditor(hydrateEditor(detail)); await loadWorkspace(result.id);
      setMessageTone("success"); setMessage(`Voucher ${detail.voucherNumber} updated.`);
    } catch (error) { setMessageTone("error"); setMessage(error instanceof Error ? error.message : "Could not update the voucher."); }
    finally { setBusy(""); }
  }

  if (!session || !activeCompany || !metadata || !editor) {
    return <WorkspaceShell title="Payment Vouchers" description="Approval-driven payment control for treasury, AP, reimbursements, and tax remittance." requiredRoles={["accountant", "cfo", "admin"]} breadcrumbs={["Home", "Finance", "Treasury", "Payment Vouchers"]}>{loading ? <div className="loading-state">Loading vouchers...</div> : <EmptyState title="No voucher workspace" body="Sign in and select a company to continue." tone="finance" />}</WorkspaceShell>;
  }

  return (
    <WorkspaceShell title="Payment Vouchers" description="Create, approve, post, print, and execute controlled treasury payments with full audit visibility." requiredRoles={["accountant", "cfo", "admin"]} breadcrumbs={["Home", "Finance", "Treasury", "Payment Vouchers"]}>
      <ModuleActionBar primaryLabel="New voucher" onPrimaryAction={() => setEditor(buildEditor(metadata, activeBranch?.id ?? null))} secondaryGroups={[{ label: "Actions", items: [{ label: "Save draft", onSelect: saveDraft }, { label: "Validate", onSelect: () => quickAction("validate") }, { label: "Submit", onSelect: () => runAction("submit") }] }, { label: "Treasury", items: [{ label: "Initiate payment", onSelect: () => quickAction("pay") }, { label: "Mark as paid", onSelect: () => quickAction("mark-paid") }, { label: "Post to GL", onSelect: () => runAction("post") }] }, { label: "Documents", items: [{ label: "Preview", onSelect: () => runAction("preview") }, { label: "Print", onSelect: () => runAction("print") }, { label: "Export PDF", onSelect: () => runAction("pdf") }] }]} summary="Payment initiation stays visible. Reviews, treasury actions, and print/export stay grouped above the work area." />
      <div className="metric-grid">{metrics.map((metric) => <KpiCard key={metric.label} metric={metric} />)}</div>
      <ViewToolbar left={<div className="filter-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search voucher number, beneficiary, narration" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PaymentVoucherStatus | "ALL")}><option value="ALL">All statuses</option>{metadata.statuses.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select></div>} right={<button type="button" className="ghost-button" onClick={() => void loadWorkspace(selectedVoucher?.id)}><RefreshCw size={16} /> Refresh</button>} chips={<><span className="chip">{filteredVouchers.length} vouchers</span><span className="chip">{queue.length} awaiting approval</span><span className="chip">{money(totals.net, editor.currencyCode)} draft net</span></>} />
      {message ? <div className={`inline-banner inline-banner--${messageTone}`}>{messageTone === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}{message}</div> : null}
      <div className="workspace-two-column"><div className="workspace-two-column__aside"><SectionCard title="Voucher Register" eyebrow="Treasury">{filteredVouchers.length ? <div className="stack-list">{filteredVouchers.map((voucher) => <button key={voucher.id} type="button" className={`stack-list__item${selectedVoucher?.id === voucher.id ? " is-active" : ""}`} onClick={() => void getPaymentVoucher(session.token!, voucher.id).then((detail) => { setSelectedVoucher(detail); setEditor(hydrateEditor(detail)); })}><div className="stack-list__title-row"><strong>{voucher.voucherNumber}</strong><span className={`status-pill status-pill--${statusTone(voucher.status).toLowerCase()}`}>{voucher.status.replace(/_/g, " ")}</span></div><div className="stack-list__meta">{voucher.beneficiaryName}</div><div className="stack-list__meta">{money(voucher.netPaymentAmount, voucher.currencyCode)}</div></button>)}</div> : <EmptyState title="No vouchers yet" body="Start with a draft payment voucher to route approvals and treasury execution." tone="finance" />}</SectionCard></div>
        <div className="workspace-two-column__main"><SectionCard title={editor.voucherNumber ? `Voucher ${editor.voucherNumber}` : "Create Payment Voucher"} eyebrow="Voucher Desk" action={<div className="section-card__action-row"><button type="button" className="ghost-button" onClick={() => void runAction("preview")}><FileDown size={16} /> Preview</button><button type="button" className="primary-button" onClick={saveDraft} disabled={busy === "save"}><Save size={16} /> {busy === "save" ? "Saving..." : "Save draft"}</button></div>}><div className="form-grid"><label><span>Voucher type</span><select value={editor.voucherType} onChange={(event) => updateEditor("voucherType", event.target.value as PaymentVoucherType)}>{metadata.voucherTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}</select></label><label><span>Beneficiary type</span><select value={editor.beneficiaryType} onChange={(event) => updateEditor("beneficiaryType", event.target.value)}>{metadata.beneficiaryTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}</select></label><label><span>Beneficiary name</span><input value={editor.beneficiaryName} onChange={(event) => updateEditor("beneficiaryName", event.target.value)} /></label><label><span>Supplier</span><select value={editor.supplierId} onChange={(event) => updateEditor("supplierId", event.target.value ? Number(event.target.value) : "")}><option value="">Select supplier</option>{metadata.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label><span>Payment method</span><select value={editor.paymentMethod} onChange={(event) => updateEditor("paymentMethod", event.target.value)}>{metadata.paymentMethods.map((method) => <option key={method} value={method}>{method.replace(/_/g, " ")}</option>)}</select></label><label><span>Bank account</span><select value={editor.bankAccountId} onChange={(event) => updateEditor("bankAccountId", event.target.value ? Number(event.target.value) : "")}><option value="">Select bank</option>{metadata.bankAccounts.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></label><label><span>Branch</span><select value={editor.branchId} onChange={(event) => updateEditor("branchId", event.target.value ? Number(event.target.value) : "")}>{metadata.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label><span>Period</span><select value={editor.accountingPeriodId} onChange={(event) => updateEditor("accountingPeriodId", event.target.value ? Number(event.target.value) : "")}>{metadata.periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></label><label><span>Voucher date</span><input type="date" value={editor.voucherDate} onChange={(event) => updateEditor("voucherDate", event.target.value)} /></label><label><span>Requested date</span><input type="date" value={editor.requestedPaymentDate} onChange={(event) => updateEditor("requestedPaymentDate", event.target.value)} /></label><label><span>Posting date</span><input type="date" value={editor.postingDate} onChange={(event) => updateEditor("postingDate", event.target.value)} /></label><label><span>Reference</span><input value={editor.referenceNumber} onChange={(event) => updateEditor("referenceNumber", event.target.value)} /></label><label className="form-grid__full"><span>Narration</span><input value={editor.narration} onChange={(event) => updateEditor("narration", event.target.value)} /></label><label className="form-grid__full"><span>Purpose of payment</span><textarea value={editor.purposeOfPayment} onChange={(event) => updateEditor("purposeOfPayment", event.target.value)} rows={3} /></label></div><div className="section-divider" /><div className="line-grid"><div className="line-grid__header"><h4>Voucher Lines</h4><button type="button" className="ghost-button" onClick={() => setEditor((current) => current ? { ...current, lines: [...current.lines, buildLine()] } : current)}><Plus size={16} /> Add line</button></div>{editor.lines.map((line, index) => <div key={line.id} className="line-grid__row"><select value={line.lineType} onChange={(event) => updateLine(line.id, { lineType: event.target.value })}><option value="EXPENSE">Expense</option><option value="INVOICE_SETTLEMENT">Invoice settlement</option><option value="ADVANCE">Advance</option><option value="TAX">Tax</option><option value="WITHHOLDING">Withholding</option><option value="ADJUSTMENT">Adjustment</option></select><select value={line.accountId} onChange={(event) => updateLine(line.id, { accountId: event.target.value ? Number(event.target.value) : "" })}><option value="">Account</option>{metadata.accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select><input value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} placeholder={`Line ${index + 1} description`} /><input value={line.grossAmount} onChange={(event) => updateLine(line.id, { grossAmount: event.target.value })} placeholder="Gross" /><input value={line.taxAmount} onChange={(event) => updateLine(line.id, { taxAmount: event.target.value, netAmount: String(amount(line.grossAmount) + amount(event.target.value) - amount(line.withholdingTaxAmount)) })} placeholder="Tax" /><input value={line.withholdingTaxAmount} onChange={(event) => updateLine(line.id, { withholdingTaxAmount: event.target.value, netAmount: String(amount(line.grossAmount) + amount(line.taxAmount) - amount(event.target.value)) })} placeholder="WHT" /><input value={line.netAmount} onChange={(event) => updateLine(line.id, { netAmount: event.target.value })} placeholder="Net" /></div>)}</div><div className="summary-grid"><div className="summary-grid__item"><span>Total amount</span><strong>{money(totals.total, editor.currencyCode)}</strong></div><div className="summary-grid__item"><span>Deductions</span><strong>{money(totals.withholding, editor.currencyCode)}</strong></div><div className="summary-grid__item"><span>Net payable</span><strong>{money(totals.net, editor.currencyCode)}</strong></div></div><div className="action-strip"><button type="button" className="ghost-button" onClick={() => void quickAction("validate")} disabled={!editor.id || busy === "validate"}><CheckCircle2 size={16} /> Validate</button><button type="button" className="ghost-button" onClick={() => void runAction("submit")} disabled={!editor.id || busy === "submit"}><Send size={16} /> Submit</button><button type="button" className="ghost-button" onClick={() => void runAction("approve")} disabled={!editor.id || busy === "approve"}><CheckCircle2 size={16} /> Approve</button><button type="button" className="ghost-button" onClick={() => void runAction("post")} disabled={!editor.id || busy === "post"}><Wallet size={16} /> Post to GL</button></div></SectionCard><SectionCard title="Approval, Comments, and Execution" eyebrow="Control">{selectedVoucher ? <><div className="approval-summary"><span className={`status-pill status-pill--${statusTone(selectedVoucher.status).toLowerCase()}`}>{selectedVoucher.status.replace(/_/g, " ")}</span><span className="chip">{selectedVoucher.workflowStatus.replace(/_/g, " ")}</span><span className="chip">{selectedVoucher.paymentStatus.replace(/_/g, " ")}</span><span className="chip">{selectedVoucher.isPostedToGL ? "GL linked" : "Not yet posted"}</span></div><div className="comment-composer"><input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add internal comment" /><button type="button" className="ghost-button" onClick={async () => { if (!commentDraft.trim()) return; const updated = await addPaymentVoucherComment(session.token!, selectedVoucher.id, commentDraft); setSelectedVoucher(updated); setEditor(hydrateEditor(updated)); setCommentDraft(""); }}><Plus size={16} /> Comment</button><button type="button" className="ghost-button" onClick={() => void quickAction("reject")}>Reject</button><button type="button" className="ghost-button" onClick={() => void quickAction("return")}>Return</button><button type="button" className="ghost-button" onClick={() => void quickAction("pay")}>Initiate payment</button><button type="button" className="ghost-button" onClick={() => void quickAction("mark-paid")}>Mark paid</button><button type="button" className="ghost-button" onClick={() => void quickAction("cancel")}>Cancel</button></div><div className="thread-list">{(selectedVoucher.comments ?? []).map((comment) => <div key={comment.id} className="thread-list__item"><strong>{comment.authorName ?? "User"}</strong><p>{comment.body}</p></div>)}</div></> : <EmptyState title="No voucher selected" body="Choose a voucher from the register or save a new draft to continue." tone="finance" />}</SectionCard></div></div>
    </WorkspaceShell>
  );
}

