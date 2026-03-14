"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanyRecord, PaymentTemplateRecord, PaymentVoucherRecord } from "./api";

type TemplateKind = "STANDARD_CORPORATE" | "FINANCE_TREASURY" | "CLEAN_A4";

type VoucherDocOptions = {
  company?: CompanyRecord | null;
  branchName?: string | null;
  templateKind?: TemplateKind;
};

function money(value: string | number | null | undefined, currencyCode = "NGN", mode: "html" | "pdf" = "html") {
  const amount = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return mode === "pdf" ? `${currencyCode} ${formatted}` : `₦${formatted}`;
}

function shortDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function voucherTemplateLabel(kind: TemplateKind) {
  if (kind === "FINANCE_TREASURY") return "Finance / Treasury Template";
  if (kind === "CLEAN_A4") return "Clean A4 Template";
  return "Standard Corporate Template";
}

function approvalTrail(voucher: PaymentVoucherRecord) {
  return (voucher.approvalHistory ?? [])
    .map(
      (step) => `
      <div class="approval-item">
        <strong>${escapeHtml(step.action.replace(/_/g, " "))}</strong>
        <span>${escapeHtml(step.actorName ?? "System")}</span>
        <span>${escapeHtml(shortDate(step.actedAt))}</span>
        ${step.comments ? `<p>${escapeHtml(step.comments)}</p>` : ""}
        ${step.rejectionReason ? `<p class="reject">${escapeHtml(step.rejectionReason)}</p>` : ""}
      </div>
    `,
    )
    .join("");
}

function lineRows(voucher: PaymentVoucherRecord) {
  return voucher.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.lineNumber)}</td>
        <td>${escapeHtml(line.description)}</td>
        <td>${escapeHtml(line.accountCode)}</td>
        <td class="r">${money(line.grossAmount, voucher.currencyCode)}</td>
        <td class="r">${money(line.taxAmount, voucher.currencyCode)}</td>
        <td class="r">${money(line.withholdingTaxAmount, voucher.currencyCode)}</td>
        <td class="r">${money(line.netAmount, voucher.currencyCode)}</td>
      </tr>
    `,
    )
    .join("");
}

function voucherHtml(voucher: PaymentVoucherRecord, options: VoucherDocOptions) {
  const kind = options.templateKind ?? (voucher.template?.templateKind as TemplateKind | undefined) ?? "STANDARD_CORPORATE";
  const bankBlock = voucher.bankAccount
    ? `
      <div><span>Bank</span><strong>${escapeHtml(voucher.bankAccount.bankName ?? voucher.bankAccount.name)}</strong></div>
      <div><span>Account</span><strong>${escapeHtml(voucher.bankAccount.accountName ?? voucher.bankAccount.name)}</strong></div>
      <div><span>Number</span><strong>${escapeHtml(voucher.bankAccount.number ?? "-")}</strong></div>
    `
    : `<div><span>Settlement</span><strong>Cash account</strong></div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>Payment Voucher</title>
<style>
*{box-sizing:border-box} body{font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#eef4fb;padding:28px;color:#102542} .sheet{max-width:860px;margin:0 auto;background:#fff;border:1px solid #d9e4f2;border-radius:24px;overflow:hidden;box-shadow:0 16px 48px rgba(16,37,66,.08)} .head{padding:40px 44px;border-bottom:1px solid #e4edf7;display:grid;grid-template-columns:1.3fr 1fr;gap:28px} .brand h1{margin:0;font-size:32px;line-height:1.05} .brand p{margin:8px 0 0;color:#55708e} .meta{display:grid;gap:10px;justify-items:end} .meta-card{background:${kind === "CLEAN_A4" ? "#fff" : "#f5f9ff"};border:1px solid #d9e4f2;border-radius:18px;padding:16px 18px;min-width:250px} .meta-row{display:flex;justify-content:space-between;gap:16px;margin:6px 0;color:#55708e} .meta-row strong{color:#102542} .body{padding:34px 44px 40px} .top-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px} .panel{border:1px solid #d9e4f2;border-radius:18px;padding:18px 20px;background:${kind === "FINANCE_TREASURY" ? "#f8fbff" : "#fff"}} .label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#6d7c90;margin-bottom:10px} .panel h3{margin:0 0 8px;font-size:18px} .bank-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px} .bank-grid span{display:block;font-size:12px;color:#6d7c90} .bank-grid strong{display:block;font-size:13px;color:#102542;margin-top:2px} table{width:100%;border-collapse:collapse;margin-top:8px} th,td{padding:12px 14px;border-bottom:1px solid #e8eef6;font-size:13px} th{background:#f3f7fc;color:#4b6786;text-align:left} .r{text-align:right} .summary{display:grid;grid-template-columns:1fr 280px;gap:24px;margin-top:24px} .totals{border:1px solid #d9e4f2;border-radius:20px;padding:18px 20px;background:${kind === "STANDARD_CORPORATE" ? "#f4f8fe" : "#fff"}} .totals-row{display:flex;justify-content:space-between;margin:10px 0;color:#55708e} .totals-row strong{color:#102542} .grand{padding-top:12px;border-top:1px solid #d9e4f2;font-size:16px;font-weight:700;color:#102542} .notes{font-size:13px;color:#55708e;line-height:1.7} .trail{margin-top:24px;border-top:1px solid #e4edf7;padding-top:20px} .approval-grid{display:grid;gap:10px} .approval-item{border:1px solid #d9e4f2;border-radius:16px;padding:12px 14px;background:#fbfdff} .approval-item strong{display:block;margin-bottom:4px}.approval-item span{display:inline-block;margin-right:12px;color:#5b7694;font-size:12px}.reject{color:#b45252}.footer{padding:18px 44px 28px;color:#6d7c90;font-size:12px;display:flex;justify-content:space-between;gap:20px;border-top:1px solid #e4edf7}
</style></head><body>
<div class="sheet">
  <div class="head">
    <div class="brand">
      <div class="label">${escapeHtml(voucherTemplateLabel(kind))}</div>
<h1>${escapeHtml(options.company?.name ?? "Company not specified")}</h1>
<p>${escapeHtml(options.branchName ?? "Branch not specified")}</p>
    </div>
    <div class="meta">
      <div class="meta-card">
        <div class="meta-row"><span>Voucher No.</span><strong>${escapeHtml(voucher.voucherNumber)}</strong></div>
        <div class="meta-row"><span>Date</span><strong>${escapeHtml(shortDate(voucher.voucherDate))}</strong></div>
        <div class="meta-row"><span>Requested</span><strong>${escapeHtml(shortDate(voucher.requestedPaymentDate))}</strong></div>
        <div class="meta-row"><span>Status</span><strong>${escapeHtml(voucher.status)}</strong></div>
        <div class="meta-row"><span>Payment</span><strong>${escapeHtml(voucher.paymentStatus)}</strong></div>
      </div>
    </div>
  </div>
  <div class="body">
    <div class="top-grid">
      <div class="panel">
        <div class="label">Beneficiary</div>
        <h3>${escapeHtml(voucher.beneficiaryName)}</h3>
        <div>${escapeHtml(voucher.beneficiaryType.replace(/_/g, " "))}</div>
        <div>${escapeHtml(voucher.beneficiaryCode ?? voucher.referenceNumber ?? "-")}</div>
        <div style="margin-top:10px;color:#55708e">${escapeHtml(voucher.purposeOfPayment)}</div>
      </div>
      <div class="panel">
        <div class="label">Settlement Details</div>
        <div class="bank-grid">${bankBlock}<div><span>Method</span><strong>${escapeHtml(voucher.paymentMethod.replace(/_/g, " "))}</strong></div><div><span>Currency</span><strong>${escapeHtml(voucher.currencyCode)}</strong></div></div>
      </div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Description</th><th>Account</th><th class="r">Gross</th><th class="r">Tax</th><th class="r">WHT</th><th class="r">Net</th></tr></thead>
      <tbody>${lineRows(voucher)}</tbody>
    </table>
    <div class="summary">
      <div class="notes">
        <div class="label">Narration</div>
        <div>${escapeHtml(voucher.narration)}</div>
        <div style="margin-top:16px" class="label">Approvals & Comments</div>
        <div>${escapeHtml(voucher.comments?.map((comment) => `${comment.authorName ?? "User"}: ${comment.body}`).join(" | ") ?? "No remarks yet")}</div>
      </div>
      <div class="totals">
        <div class="totals-row"><span>Total amount</span><strong>${money(voucher.totalAmount, voucher.currencyCode)}</strong></div>
        <div class="totals-row"><span>Tax</span><strong>${money(voucher.taxAmount, voucher.currencyCode)}</strong></div>
        <div class="totals-row"><span>Withholding</span><strong>${money(voucher.withholdingTaxAmount, voucher.currencyCode)}</strong></div>
        <div class="totals-row grand"><span>Net payment</span><strong>${money(voucher.netPaymentAmount, voucher.currencyCode)}</strong></div>
        <div style="margin-top:12px;color:#55708e;font-size:12px">${escapeHtml(voucher.amountInWords ?? "")}</div>
      </div>
    </div>
    <div class="trail">
      <div class="label">Approval Trail</div>
      <div class="approval-grid">${approvalTrail(voucher) || `<div class="approval-item">No approval activity yet.</div>`}</div>
    </div>
  </div>
<div class="footer"><span>${escapeHtml(options.company?.name ?? "Company not specified")} payment control document</span><span>Printed ${escapeHtml(shortDate(new Date().toISOString()))}</span></div>
</div>
</body></html>`;
}

function openDocWindow(html: string, title: string, shouldPrint = false) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");
  if (!win) throw new Error("Allow pop-ups to preview or print the voucher.");
  win.document.open();
  win.document.write(html);
  win.document.close();
  if (shouldPrint) {
    win.focus();
    win.onload = () => win.print();
  }
}

export function previewPaymentVoucherDocument(voucher: PaymentVoucherRecord, options: VoucherDocOptions = {}) {
  openDocWindow(voucherHtml(voucher, options), `Voucher ${voucher.voucherNumber}`);
}

export function printPaymentVoucherDocument(voucher: PaymentVoucherRecord, options: VoucherDocOptions = {}) {
  openDocWindow(voucherHtml(voucher, options), `Voucher ${voucher.voucherNumber}`, true);
}

export function exportPaymentVoucherPdf(voucher: PaymentVoucherRecord, options: VoucherDocOptions = {}) {
  const kind = options.templateKind ?? (voucher.template?.templateKind as TemplateKind | undefined) ?? "STANDARD_CORPORATE";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
doc.text(options.company?.name ?? "Company not specified", 48, 60);
  doc.setFontSize(11);
  doc.setTextColor(91, 118, 148);
doc.text(options.branchName ?? "Branch not specified", 48, 78);
  doc.setTextColor(16, 37, 66);
  doc.setFontSize(12);
  doc.text(`Payment Voucher ${voucher.voucherNumber}`, 390, 60);
  doc.text(`Date: ${shortDate(voucher.voucherDate)}`, 390, 78);
  doc.text(`Status: ${voucher.status}`, 390, 96);
  doc.text(`Template: ${voucherTemplateLabel(kind)}`, 390, 114);

  doc.setFontSize(11);
  doc.setTextColor(91, 118, 148);
  doc.text("Beneficiary", 48, 150);
  doc.setTextColor(16, 37, 66);
  doc.text(voucher.beneficiaryName, 48, 168);
  doc.text(voucher.purposeOfPayment, 48, 186);
  doc.text(`Method: ${voucher.paymentMethod.replace(/_/g, " ")}`, 48, 204);
  doc.text(`Net payment: ${money(voucher.netPaymentAmount, voucher.currencyCode, "pdf")}`, 390, 168);
  doc.text(`Bank ref: ${voucher.bankPaymentReference ?? "-"}`, 390, 186);

  autoTable(doc, {
    startY: 228,
    head: [["#", "Description", "Account", "Gross", "Tax", "WHT", "Net"]],
    body: voucher.lines.map((line) => [
      String(line.lineNumber),
      line.description,
      line.accountCode,
      money(line.grossAmount, voucher.currencyCode, "pdf"),
      money(line.taxAmount, voucher.currencyCode, "pdf"),
      money(line.withholdingTaxAmount, voucher.currencyCode, "pdf"),
      money(line.netAmount, voucher.currencyCode, "pdf"),
    ]),
    styles: { font: "helvetica", fontSize: 9, textColor: [16, 37, 66] },
    headStyles: { fillColor: [243, 247, 252], textColor: [75, 103, 134] },
    margin: { left: 48, right: 48 },
  });

  const lastY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 420;
  doc.text(`Total: ${money(voucher.totalAmount, voucher.currencyCode, "pdf")}`, 370, lastY + 30);
  doc.text(`Withholding: ${money(voucher.withholdingTaxAmount, voucher.currencyCode, "pdf")}`, 370, lastY + 48);
  doc.setFont("helvetica", "bold");
  doc.text(`Net payment: ${money(voucher.netPaymentAmount, voucher.currencyCode, "pdf")}`, 370, lastY + 70);
  doc.setFont("helvetica", "normal");
  doc.text(voucher.amountInWords ?? "", 48, lastY + 48, { maxWidth: 270 });
  doc.text(`GL ref: ${voucher.glJournal?.reference ?? "Pending"}`, 48, lastY + 70);
  doc.save(`${voucher.voucherNumber.toLowerCase()}.pdf`);
}
