"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanyRecord, CustomerReceiptRecord } from "./api";

type ReceiptDocOptions = {
  company?: CompanyRecord | null;
  branchName?: string | null;
};

function money(value: string | number | null | undefined, mode: "html" | "pdf" = "html") {
  const amount = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return mode === "pdf" ? `NGN ${formatted}` : `₦${formatted}`;
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

function resolveCompanyName(receipt: CustomerReceiptRecord, options: ReceiptDocOptions) {
  return options.company?.name ?? receipt.legalEntity?.name ?? "Haqly";
}

function resolveBranchName(receipt: CustomerReceiptRecord, options: ReceiptDocOptions) {
return options.branchName ?? receipt.branch?.name ?? "Branch not specified";
}

function customerAddress(receipt: CustomerReceiptRecord) {
  const address = receipt.customer?.addresses?.[0];
  return [receipt.customer?.email, receipt.customer?.phone, address?.line1, address?.city, address?.state, address?.country]
    .filter(Boolean)
    .join("<br>");
}

function receiptBodyRows(receipt: CustomerReceiptRecord) {
  return receipt.lines
    .map((line, index) => {
      const invoice = line.invoice;
      return `
        <tr>
          <td class="c">${index + 1}</td>
          <td class="iname">${escapeHtml(line.description)}</td>
          <td>${escapeHtml(invoice?.number ?? "-")}</td>
          <td>${escapeHtml(invoice?.status ?? receipt.status)}</td>
          <td class="r">${money(line.appliedAmount)}</td>
        </tr>
      `;
    })
    .join("");
}

function receiptHtml(receipt: CustomerReceiptRecord, options: ReceiptDocOptions) {
  const companyName = resolveCompanyName(receipt, options);
  const branchName = resolveBranchName(receipt, options);
  const amountInWords = receipt.amountInWords ?? "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Receipt ${escapeHtml(receipt.receiptNumber)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --ink: #0d1f35;
      --ink-mid: #2c4260;
      --ink-light: #5e7ea0;
      --rule: #a8c4de;
      --bg: #cfe0ef;
      --paper: #e8f3fb;
      --serif: "Libre Baskerville", Georgia, serif;
      --display: "IM Fell English", "Times New Roman", serif;
    }
    body {
      background: var(--bg);
      font-family: var(--serif);
      color: var(--ink);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 28px 16px;
      gap: 14px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .btn-bar { display: flex; gap: 8px; }
    .btn {
      font-family: var(--serif);
      font-size: 11px;
      cursor: pointer;
      border: 1px solid var(--ink);
      padding: 6px 18px;
      background: var(--paper);
      color: var(--ink);
      letter-spacing: 0.04em;
    }
    .btn:hover { background: var(--ink); color: var(--paper); }
    .receipt {
      width: 794px;
      min-height: 559px;
      background: var(--paper);
      border: 1px solid #7aaecf;
      box-shadow: 3px 3px 0 #7aaecf;
      display: flex;
      flex-direction: column;
    }
    .frame {
      margin: 10px;
      border: 1.5px double var(--rule);
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 14px 20px 12px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--rule);
    }
    .co-block .co-name { font-family: var(--display); font-size: 18px; font-weight: 700; color: var(--ink); }
    .co-block .co-sub { font-size: 9.5px; color: var(--ink-light); margin-top: 3px; font-style: italic; line-height: 1.6; }
    .title-block { text-align: center; }
    .title-block .doc-title { font-family: var(--display); font-size: 26px; letter-spacing: 0.08em; color: var(--ink); font-style: italic; }
    .title-block .doc-sub { font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-light); margin-top: 1px; }
    .ref-block { text-align: right; }
    .ref-block .ref-no { font-size: 11px; color: var(--ink-mid); }
    .ref-block .ref-no span { font-weight: 700; display: block; font-size: 13px; color: var(--ink); }
    .ref-block .ref-date { font-size: 10px; color: var(--ink-light); margin-top: 4px; font-style: italic; }
    .party-band {
      display: grid;
      grid-template-columns: 1.2fr 1fr 1fr;
      padding: 8px 0;
      border-bottom: 1px solid var(--rule);
      gap: 12px;
    }
    .pf { font-size: 10px; color: var(--ink-mid); line-height: 1.7; }
    .pf .pf-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-light); border-bottom: 1px solid var(--rule); padding-bottom: 2px; margin-bottom: 4px; }
    .pf .pf-value { font-size: 10.5px; color: var(--ink); }
    .pf .pf-value strong { font-weight: 700; display: block; }
    .items-wrap { flex: 1; padding: 4px 0; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.items thead tr { border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink); }
    table.items thead th { font-size: 8.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-mid); padding: 5px 6px; text-align: left; font-weight: 700; }
    table.items thead th.r { text-align: right; }
    table.items thead th.c { text-align: center; width: 24px; }
    table.items tbody tr { border-bottom: 1px dotted var(--rule); }
    table.items tbody td { padding: 5px 6px; font-size: 10px; color: var(--ink-mid); }
    table.items tbody td.c { text-align: center; font-size: 9px; color: var(--rule); }
    table.items tbody td.r { text-align: right; }
    table.items tbody td.iname { font-size: 10.5px; color: var(--ink); font-weight: 700; }
    table.items tfoot tr td { padding: 4px 6px; font-size: 10px; }
    table.items tfoot tr.tf-line td { border-top: 1px solid var(--ink); padding-top: 5px; }
    table.items tfoot .tf-label { font-size: 9px; text-align: right; color: var(--ink-mid); padding-right: 10px; }
    table.items tfoot .tf-val { text-align: right; font-weight: 700; color: var(--ink); }
    table.items tfoot .tf-val.total { font-size: 13px; border-top: 2px solid var(--ink); border-bottom: 2px solid var(--ink); }
    .bottom {
      border-top: 1px solid var(--rule);
      padding-top: 8px;
      display: grid;
      grid-template-columns: 1.2fr 1fr 1fr;
      gap: 12px;
      align-items: end;
    }
    .pay-block .pay-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-light); margin-bottom: 4px; border-bottom: 1px solid var(--rule); padding-bottom: 2px; }
    .pay-block .pay-row { display: flex; justify-content: space-between; font-size: 10px; color: var(--ink-mid); line-height: 1.8; gap: 12px; }
    .pay-block .pay-row span:last-child { font-weight: 700; color: var(--ink); text-align: right; }
    .sig-block { text-align: center; }
    .sig-block .sig-line { border-bottom: 1px solid var(--ink-light); margin: 0 10px 3px; }
    .sig-block .sig-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-light); }
    @media print {
      body { background: white; padding: 0; display: block; }
      .btn-bar { display: none; }
      .receipt { box-shadow: none; border: none; width: 210mm; min-height: 148mm; break-after: page; }
      .receipt:last-of-type { break-after: auto; }
      @page { size: A5 landscape; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="btn-bar">
    <button class="btn" onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="receipt">
    <div class="frame">
      <div class="top">
        <div class="co-block">
          <div class="co-name">${escapeHtml(companyName)}</div>
          <div class="co-sub">${escapeHtml(branchName)}<br>${escapeHtml(receipt.legalEntity?.email ?? "")}</div>
        </div>
        <div class="title-block">
          <div class="doc-title">Receipt</div>
          <div class="doc-sub">Official Customer Receipt</div>
        </div>
        <div class="ref-block">
          <div class="ref-no">No. <span>${escapeHtml(receipt.receiptNumber)}</span></div>
          <div class="ref-date">Paid: ${escapeHtml(shortDate(receipt.paymentDate))}</div>
          <div class="ref-date">Method: ${escapeHtml(receipt.paymentMethod.replace(/_/g, " "))}</div>
        </div>
      </div>
      <div class="party-band">
        <div class="pf">
          <div class="pf-label">Received From</div>
<div class="pf-value"><strong>${escapeHtml(receipt.customer?.name ?? "Customer not specified")}</strong></div>
          <div class="pf-value">${customerAddress(receipt) || "Customer contact not yet captured"}</div>
        </div>
        <div class="pf">
          <div class="pf-label">Payment Reference</div>
          <div class="pf-value">Bank Ref: ${escapeHtml(receipt.bankReference ?? "-")}</div>
          <div class="pf-value">External Ref: ${escapeHtml(receipt.externalReference ?? "-")}</div>
          <div class="pf-value">GL Ref: ${escapeHtml(receipt.glJournal?.reference ?? "Pending post")}</div>
        </div>
        <div class="pf">
          <div class="pf-label">Receipt Summary</div>
          <div class="pf-value">Status: ${escapeHtml(receipt.status)}</div>
          <div class="pf-value">Currency: ${escapeHtml(receipt.currencyCode)}</div>
          <div class="pf-value">Amount in words: ${escapeHtml(amountInWords)}</div>
        </div>
      </div>
      <div class="items-wrap">
        <table class="items">
          <thead>
            <tr>
              <th class="c">#</th>
              <th style="width:46%">Description</th>
              <th>Invoice Ref</th>
              <th>Status</th>
              <th class="r">Amount</th>
            </tr>
          </thead>
          <tbody>${receiptBodyRows(receipt)}</tbody>
          <tfoot>
            <tr class="tf-line">
              <td colspan="3"></td>
              <td class="tf-label" style="font-weight:700;color:var(--ink);">Total Received</td>
              <td class="tf-val total">${money(receipt.amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="bottom">
        <div class="pay-block">
          <div class="pay-label">Payment Details</div>
          <div class="pay-row"><span>Method:</span><span>${escapeHtml(receipt.paymentMethod.replace(/_/g, " "))}</span></div>
          <div class="pay-row"><span>Bank / Cash:</span><span>${escapeHtml(receipt.bankAccount?.name ?? receipt.cashAccount?.name ?? "-")}</span></div>
          <div class="pay-row"><span>Reference:</span><span>${escapeHtml(receipt.bankReference ?? receipt.externalReference ?? receipt.receiptNumber)}</span></div>
          <div class="pay-row"><span>Posting Date:</span><span>${escapeHtml(shortDate(receipt.postingDate))}</span></div>
        </div>
        <div class="sig-block">
          <div class="sig-line" style="margin-top:22px;"></div>
          <div class="sig-label">Cashier / Treasury</div>
        </div>
        <div class="sig-block">
          <div class="sig-line" style="margin-top:22px;"></div>
          <div class="sig-label">Customer Acknowledgement</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function receiptDocumentHtml(receipts: CustomerReceiptRecord[], options: ReceiptDocOptions) {
  return receipts.map((receipt) => receiptHtml(receipt, options)).join("");
}

function openDocWindow(html: string, title: string, shouldPrint = false) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=980,height=720");
  if (!win) throw new Error("Allow pop-ups to preview or print the receipt.");
  win.document.open();
  win.document.write(html);
  win.document.close();
  if (shouldPrint) {
    win.focus();
    win.onload = () => win.print();
  }
}

export function previewReceipts(receipts: CustomerReceiptRecord[], options: ReceiptDocOptions = {}) {
  openDocWindow(receiptDocumentHtml(receipts, options), "Receipt Preview");
}

export function printReceipts(receipts: CustomerReceiptRecord[], options: ReceiptDocOptions = {}) {
  openDocWindow(receiptDocumentHtml(receipts, options), "Receipt Print", true);
}

export function exportReceiptsPdf(receipts: CustomerReceiptRecord[], options: ReceiptDocOptions = {}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a5" });

  receipts.forEach((receipt, index) => {
    if (index > 0) doc.addPage("a5", "landscape");

    const companyName = resolveCompanyName(receipt, options);
    const branchName = resolveBranchName(receipt, options);
    const amountInWords = receipt.amountInWords ?? "-";

    doc.setFillColor(232, 243, 251);
    doc.rect(0, 0, 595, 420, "F");
    doc.setDrawColor(122, 174, 207);
    doc.rect(8, 8, 579, 404);
    doc.rect(16, 16, 563, 388);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(13, 31, 53);
    doc.setFontSize(18);
    doc.text(companyName, 28, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(94, 126, 160);
    doc.text(branchName, 28, 58);

    doc.setFont("times", "bolditalic");
    doc.setFontSize(24);
    doc.setTextColor(13, 31, 53);
    doc.text("Receipt", 298, 44, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("OFFICIAL CUSTOMER RECEIPT", 298, 57, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(44, 66, 96);
    doc.text(`No. ${receipt.receiptNumber}`, 552, 42, { align: "right" });
    doc.text(`Paid: ${shortDate(receipt.paymentDate)}`, 552, 57, { align: "right" });
    doc.text(`Method: ${receipt.paymentMethod.replace(/_/g, " ")}`, 552, 72, { align: "right" });

    doc.setDrawColor(168, 196, 222);
    doc.line(24, 84, 571, 84);

    const topBlocksY = 102;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(94, 126, 160);
    doc.text("RECEIVED FROM", 28, topBlocksY);
    doc.text("PAYMENT REFERENCE", 230, topBlocksY);
    doc.text("RECEIPT SUMMARY", 420, topBlocksY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(13, 31, 53);
doc.text(receipt.customer?.name ?? "Customer not specified", 28, topBlocksY + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const customerLines = [receipt.customer?.email, receipt.customer?.phone, receipt.customer?.addresses?.[0]?.line1].filter(Boolean) as string[];
    customerLines.forEach((line, rowIndex) => doc.text(line, 28, topBlocksY + 31 + rowIndex * 12));

    const refLines = [
      `Bank Ref: ${receipt.bankReference ?? "-"}`,
      `External Ref: ${receipt.externalReference ?? "-"}`,
      `GL Ref: ${receipt.glJournal?.reference ?? "Pending post"}`,
    ];
    refLines.forEach((line, rowIndex) => doc.text(line, 230, topBlocksY + 16 + rowIndex * 12));

    const summaryLines = [
      `Status: ${receipt.status}`,
      `Currency: ${receipt.currencyCode}`,
      `Amount in words: ${amountInWords}`,
    ];
    doc.setFontSize(8.5);
    summaryLines.forEach((line, rowIndex) => {
      const wrapped = doc.splitTextToSize(line, 145);
      doc.text(wrapped, 420, topBlocksY + 16 + rowIndex * 18);
    });

    autoTable(doc, {
      startY: 166,
      margin: { left: 24, right: 24 },
      head: [["#", "Description", "Invoice Ref", "Status", "Amount"]],
      body: receipt.lines.map((line, rowIndex) => [
        String(rowIndex + 1),
        line.description,
        line.invoice?.number ?? "-",
        line.invoice?.status ?? receipt.status,
        money(line.appliedAmount, "pdf"),
      ]),
      foot: [["", "", "", "Total Received", money(receipt.amount, "pdf")]],
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        textColor: [44, 66, 96],
        cellPadding: 5,
        lineColor: [168, 196, 222],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [232, 243, 251],
        textColor: [44, 66, 96],
        fontStyle: "bold",
      },
      footStyles: {
        fillColor: [255, 255, 255],
        textColor: [13, 31, 53],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 22 },
        1: { cellWidth: 250 },
        2: { cellWidth: 92 },
        3: { cellWidth: 80 },
        4: { halign: "right", cellWidth: 90 },
      },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 280;
    const payY = finalY + 18;

    doc.setDrawColor(168, 196, 222);
    doc.line(24, payY, 571, payY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(94, 126, 160);
    doc.text("PAYMENT DETAILS", 28, payY + 14);
    doc.text("TREASURY", 255, payY + 14);
    doc.text("CUSTOMER ACKNOWLEDGEMENT", 425, payY + 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const payLines = [
      `Method: ${receipt.paymentMethod.replace(/_/g, " ")}`,
      `Bank / Cash: ${receipt.bankAccount?.name ?? receipt.cashAccount?.name ?? "-"}`,
      `Reference: ${receipt.bankReference ?? receipt.externalReference ?? receipt.receiptNumber}`,
      `Posting Date: ${shortDate(receipt.postingDate)}`,
    ];
    payLines.forEach((line, rowIndex) => doc.text(line, 28, payY + 30 + rowIndex * 12));

    doc.line(238, payY + 56, 360, payY + 56);
    doc.line(408, payY + 56, 544, payY + 56);
    doc.setFontSize(8);
    doc.setTextColor(94, 126, 160);
    doc.text("Cashier / Treasury", 299, payY + 68, { align: "center" });
    doc.text("Customer Acknowledgement", 476, payY + 68, { align: "center" });
  });

  doc.save(receipts.length === 1 ? `${receipts[0].receiptNumber}.pdf` : "customer-receipts.pdf");
}
