"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanyRecord, SalesInvoiceRecord } from "./api";

type InvoiceDocOptions = {
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
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function escapeHtml(value: string | null | undefined) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function invoiceTotals(invoice: SalesInvoiceRecord) {
  const subtotal = invoice.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
  const tax = invoice.items.reduce(
    (sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice) * Number(item.taxRate ?? 0)) / 100,
    0,
  );
  return {
    subtotal,
    tax,
    total: Number(invoice.total ?? subtotal + tax),
  };
}

function companyRegistrationLine(company?: CompanyRecord | null) {
  return company?.name ? `${company.name} · Enterprise invoice document` : "Haqly · Enterprise invoice document";
}

function customerAddressLines(invoice: SalesInvoiceRecord) {
  const address = invoice.customer?.addresses?.[0];
  return [address?.line1, address?.city, address?.state, address?.country].filter(Boolean);
}

function invoiceSectionHtml(invoice: SalesInvoiceRecord, options: InvoiceDocOptions) {
  const totals = invoiceTotals(invoice);
  const addressLines = customerAddressLines(invoice);
  const rows = invoice.items
    .map((item) => {
      const lineSubtotal = Number(item.quantity) * Number(item.unitPrice);
      const lineTotal = lineSubtotal + (lineSubtotal * Number(item.taxRate ?? 0)) / 100;
      return `
        <tr>
          <td class="desc-cell">
<div class="desc-title">${escapeHtml(item.product?.name ?? "Unmapped item")}</div>
            <div class="desc-sub">${escapeHtml(item.product?.sku ?? "ERP line item")}</div>
          </td>
          <td class="r mono">${Number(item.quantity).toFixed(2)}</td>
          <td class="r mono">${money(item.unitPrice)}</td>
          <td class="r mono">${Number(item.taxRate ?? 0).toFixed(2)}%</td>
          <td class="r mono">${money(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="invoice-wrap">
      <div class="inv-header">
        <div class="company-block">
          <div class="company-mark">
            ${
              options.company?.logoUrl
                ? `<img src="${options.company.logoUrl}" alt="${escapeHtml(options.company.name)} logo" class="company-logo" />`
                : `<div class="company-logo company-logo--fallback">${escapeHtml((options.company?.name ?? "HQ").slice(0, 2).toUpperCase())}</div>`
            }
            <div>
              <div class="company-name">${escapeHtml(options.company?.name ?? "Haqly")}</div>
<p>${escapeHtml(options.branchName ?? invoice.customer?.addresses?.[0]?.city ?? "Branch not specified")}</p>
            </div>
          </div>
        </div>
        <div class="inv-meta">
          <div class="inv-label">INVOICE</div>
          <table>
            <tr><td>Invoice No.</td><td>${escapeHtml(invoice.number)}</td></tr>
            <tr><td>Issue Date</td><td>${escapeHtml(shortDate(invoice.date))}</td></tr>
            <tr><td>Due Date</td><td>${escapeHtml(shortDate(invoice.dueDate))}</td></tr>
            <tr><td>Currency</td><td>NGN</td></tr>
          </table>
          <div><span class="status-badge">${escapeHtml(invoice.status)}</span></div>
        </div>
      </div>

      <div class="billing-row">
        <div class="billing-col">
          <div class="col-label">Billed To</div>
<div class="client-name">${escapeHtml(invoice.customer?.name ?? "Customer not specified")}</div>
          <p>
            ${escapeHtml(invoice.customer?.email ?? "")}${invoice.customer?.email ? "<br>" : ""}
            ${escapeHtml(invoice.customer?.phone ?? "")}${invoice.customer?.phone ? "<br>" : ""}
            ${addressLines.map((line) => `${escapeHtml(line)}<br>`).join("")}
          </p>
        </div>
        <div class="billing-col">
          <div class="col-label">Reference</div>
          <p>
            Invoice reference: ${escapeHtml(invoice.number)}<br>
            Customer ID: ${escapeHtml(String(invoice.customerId))}<br>
            Status: ${escapeHtml(invoice.status)}
          </p>
        </div>
        <div class="billing-col">
          <div class="col-label">Terms</div>
          <p>
            Payment due by ${escapeHtml(shortDate(invoice.dueDate))}.<br>
            Quote ${escapeHtml(invoice.number)} on remittance advice.<br>
            Generated from Haqly.
          </p>
        </div>
      </div>

      <div class="items-section">
        <table class="items">
          <thead>
            <tr>
              <th style="width:42%">Description</th>
              <th class="r" style="width:10%">Qty</th>
              <th class="r" style="width:16%">Unit Price</th>
              <th class="r" style="width:10%">Tax</th>
              <th class="r" style="width:16%">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="totals-section">
        <div class="totals-table">
          <div class="totals-row">
            <span class="t-label">Subtotal</span>
            <span class="t-val">${money(totals.subtotal)}</span>
          </div>
          <div class="totals-row">
            <span class="t-label">VAT / Tax</span>
            <span class="t-val">${money(totals.tax)}</span>
          </div>
          <div class="totals-row">
            <span class="t-label">Discount</span>
            <span class="t-val">₦0.00</span>
          </div>
          <div class="grand-total">
            <span class="t-label">Total Due</span>
            <span class="t-val">${money(totals.total)}</span>
          </div>
        </div>
      </div>

      <div class="footer-band">
        <div class="footer-col">
          <div class="fc-label">Settlement</div>
          <div class="bank-grid">
            <span class="bk">Company</span><span class="bv">${escapeHtml(options.company?.name ?? "Haqly")}</span>
            <span class="bk">Branch</span><span class="bv">${escapeHtml(options.branchName ?? "Head Office")}</span>
            <span class="bk">Invoice</span><span class="bv">${escapeHtml(invoice.number)}</span>
            <span class="bk">Status</span><span class="bv">${escapeHtml(invoice.status)}</span>
          </div>
        </div>
        <div class="footer-col">
          <div class="fc-label">Notes &amp; Terms</div>
          <p>
            Thank you for your business. Please quote the invoice number on all payments.
            All values shown are generated from the ERP source record and should be used as the authoritative customer copy.
          </p>
        </div>
      </div>

      <div class="bottom-bar">
        <span class="tagline">${escapeHtml(companyRegistrationLine(options.company))}</span>
        <div class="seal">ORIGINAL<br>INVOICE</div>
        <span class="page-num">Page 1 of 1</span>
      </div>
    </div>
  `;
}

function invoiceDocumentHtml(invoices: SalesInvoiceRecord[], options: InvoiceDocOptions) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Invoice Print</title>
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --ink: #0d0d0d;
            --ink-mid: #3a3a3a;
            --ink-low: #7a7f8a;
            --rule: #e4e4e0;
            --surface: #fafaf8;
            --paper: #ffffff;
            --accent: #2c3e73;
            --accent-soft: #eaf0fb;
            --teal: #2fa4a9;
          }
          @media print {
            body { background: #fff; padding: 0; }
            .invoice-wrap { box-shadow: none; max-width: 100%; break-after: page; }
            .invoice-wrap:last-child { break-after: auto; }
          }
          body {
            font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #eeefec;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 32px 20px;
            color: var(--ink);
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .invoice-wrap {
            width: 100%;
            max-width: 820px;
            background: var(--paper);
            box-shadow: 0 8px 40px rgba(31, 31, 36, 0.1);
            position: relative;
            overflow: hidden;
            margin-bottom: 24px;
          }
          .invoice-wrap::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 6px;
            background: var(--accent);
          }
          .inv-header {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            padding: 52px 56px 36px 64px;
            border-bottom: 1.5px solid var(--rule);
          }
          .company-mark {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .company-logo {
            width: 56px;
            height: 56px;
            object-fit: cover;
            border-radius: 16px;
            background: var(--accent-soft);
            border: 1px solid rgba(44, 62, 115, 0.12);
            display: grid;
            place-items: center;
            color: var(--accent);
            font-weight: 700;
          }
          .company-name {
            font-size: 30px;
            font-weight: 700;
            letter-spacing: -0.04em;
            color: var(--ink);
            margin-bottom: 8px;
          }
          .company-block p {
            font-size: 13px;
            color: var(--ink-low);
            line-height: 1.7;
          }
          .inv-meta {
            text-align: right;
          }
          .inv-label {
            font-size: 38px;
            font-weight: 700;
            letter-spacing: -0.04em;
            color: var(--accent);
            line-height: 1;
            margin-bottom: 16px;
          }
          .inv-meta table {
            margin-left: auto;
            border-collapse: collapse;
          }
          .inv-meta td {
            font-size: 12.5px;
            padding: 3px 0;
          }
          .inv-meta td:first-child {
            color: var(--ink-low);
            padding-right: 20px;
            text-align: left;
          }
          .inv-meta td:last-child {
            font-size: 12px;
            font-weight: 600;
            text-align: right;
            color: var(--ink);
          }
          .status-badge {
            display: inline-block;
            margin-top: 12px;
            padding: 6px 12px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            border-radius: 999px;
            background: rgba(47, 164, 169, 0.12);
            color: var(--teal);
            border: 1px solid rgba(47, 164, 169, 0.24);
          }
          .billing-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            padding: 28px 56px 28px 64px;
            background: var(--surface);
            border-bottom: 1.5px solid var(--rule);
          }
          .billing-col {
            padding-right: 24px;
          }
          .billing-col:last-child {
            padding-right: 0;
            border-left: 1px solid var(--rule);
            padding-left: 24px;
          }
          .col-label, .fc-label {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--accent);
            margin-bottom: 10px;
          }
          .billing-col p, .footer-col p {
            font-size: 12.5px;
            line-height: 1.8;
            color: var(--ink-mid);
          }
          .client-name {
            font-size: 14px;
            font-weight: 700;
            color: var(--ink);
            margin-bottom: 4px;
          }
          .items-section {
            padding: 32px 56px 0 64px;
          }
          table.items {
            width: 100%;
            border-collapse: collapse;
          }
          table.items thead tr {
            border-bottom: 2px solid var(--ink);
          }
          table.items thead th {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--ink-low);
            padding: 0 0 12px;
            text-align: left;
          }
          table.items thead th.r { text-align: right; }
          table.items tbody tr {
            border-bottom: 1px solid var(--rule);
          }
          table.items tbody td {
            padding: 14px 0;
            font-size: 13px;
            vertical-align: top;
            color: var(--ink);
          }
          table.items tbody td.r { text-align: right; }
          .desc-title { font-weight: 600; margin-bottom: 2px; }
          .desc-sub { font-size: 11.5px; color: var(--ink-low); }
          .mono { font-variant-numeric: tabular-nums; }
          .totals-section {
            display: flex;
            justify-content: flex-end;
            padding: 24px 56px 36px 64px;
          }
          .totals-table { width: 296px; }
          .totals-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 7px 0;
            font-size: 13px;
            border-bottom: 1px dashed var(--rule);
          }
          .totals-row:last-child { border-bottom: none; }
          .t-label { color: var(--ink-low); font-size: 12px; }
          .t-val { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
          .grand-total {
            margin-top: 8px;
            padding: 14px 16px;
            background: var(--ink);
            color: #fff;
            border-radius: 3px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .grand-total .t-label {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.65);
          }
          .grand-total .t-val {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.02em;
          }
          .footer-band {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            padding: 28px 56px 28px 64px;
            background: var(--surface);
            border-top: 1.5px solid var(--rule);
          }
          .bank-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 3px 16px;
            font-size: 12px;
          }
          .bk { color: var(--ink-low); }
          .bv { font-size: 11.5px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
          .bottom-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 56px 16px 64px;
            border-top: 1.5px solid var(--rule);
          }
          .tagline, .page-num {
            font-size: 11px;
            color: var(--ink-low);
          }
          .seal {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: 2px solid var(--accent);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8.5px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-align: center;
            color: var(--accent);
            line-height: 1.3;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        ${invoices.map((invoice) => invoiceSectionHtml(invoice, options)).join("")}
      </body>
    </html>
  `;
}

export function printInvoices(invoices: SalesInvoiceRecord[], company?: CompanyRecord | null, branchName?: string | null) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");
  if (!popup) {
    throw new Error("Pop-up was blocked. Please allow pop-ups to print invoices.");
  }
  popup.document.open();
  popup.document.write(invoiceDocumentHtml(invoices, { company, branchName }));
  popup.document.close();
  popup.focus();
  popup.onload = () => {
    popup.print();
  };
}

export function previewInvoices(invoices: SalesInvoiceRecord[], company?: CompanyRecord | null, branchName?: string | null) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");
  if (!popup) {
    throw new Error("Pop-up was blocked. Please allow pop-ups to preview invoices.");
  }
  popup.document.open();
  popup.document.write(invoiceDocumentHtml(invoices, { company, branchName }));
  popup.document.close();
  popup.focus();
}

export function exportInvoicesPdf(invoices: SalesInvoiceRecord[], company?: CompanyRecord | null, branchName?: string | null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  invoices.forEach((invoice, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const totals = invoiceTotals(invoice);
    const addressLines = customerAddressLines(invoice);

    doc.setFillColor(44, 62, 115);
    doc.rect(36, 24, 6, 760, "F");

    doc.setDrawColor(228, 228, 224);
    doc.setLineWidth(1);
    doc.line(52, 132, 555, 132);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(13, 13, 13);
    doc.text(company?.name ?? "Haqly", 64, 62);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(122, 127, 138);
doc.text(branchName ?? "Branch not specified", 64, 80);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(44, 62, 115);
    doc.text("INVOICE", 555, 56, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(122, 127, 138);
    const metaTop = 78;
    const metaRows = [
      ["Invoice No.", invoice.number],
      ["Issue Date", shortDate(invoice.date)],
      ["Due Date", shortDate(invoice.dueDate)],
      ["Currency", "NGN"],
    ];
    metaRows.forEach(([label, value], rowIndex) => {
      const y = metaTop + rowIndex * 16;
      doc.text(label, 430, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(13, 13, 13);
      doc.text(value, 555, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(122, 127, 138);
    });

    doc.setFillColor(234, 240, 251);
    doc.roundedRect(471, 138, 84, 18, 9, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(47, 164, 169);
    doc.text(String(invoice.status).toUpperCase(), 513, 150, { align: "center" });

    doc.setFillColor(250, 250, 248);
    doc.rect(52, 162, 503, 102, "F");
    doc.setDrawColor(228, 228, 224);
    doc.line(388, 162, 388, 264);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(44, 62, 115);
    doc.text("BILLED TO", 64, 182);
    doc.text("REFERENCE", 240, 182);
    doc.text("TERMS", 400, 182);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(13, 13, 13);
doc.text(invoice.customer?.name ?? "Customer not specified", 64, 200);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(58, 58, 58);
    const customerLines = [invoice.customer?.email, invoice.customer?.phone, ...addressLines].filter(Boolean) as string[];
    customerLines.forEach((line, idx) => {
      doc.text(line, 64, 216 + idx * 14);
    });

    const referenceLines = [
      `Invoice reference: ${invoice.number}`,
      `Customer ID: ${invoice.customerId}`,
      `Status: ${invoice.status}`,
    ];
    referenceLines.forEach((line, idx) => {
      doc.text(line, 240, 200 + idx * 14);
    });

    const termsLines = [
      `Payment due by ${shortDate(invoice.dueDate)}`,
      `Quote ${invoice.number} on remittance advice`,
      "Generated from Haqly",
    ];
    termsLines.forEach((line, idx) => {
      doc.text(line, 400, 200 + idx * 14);
    });

    autoTable(doc, {
      startY: 292,
      margin: { left: 52, right: 40 },
      head: [["Description", "Qty", "Unit Price", "Tax", "Amount"]],
      body: invoice.items.map((item) => {
        const lineSubtotal = Number(item.quantity) * Number(item.unitPrice);
        const lineTotal = lineSubtotal + (lineSubtotal * Number(item.taxRate ?? 0)) / 100;
        return [
`${item.product?.name ?? "Unmapped item"}\n${item.product?.sku ?? "No SKU"}`,
          Number(item.quantity).toFixed(2),
          money(item.unitPrice, "pdf"),
          `${Number(item.taxRate ?? 0).toFixed(2)}%`,
          money(lineTotal, "pdf"),
        ];
      }),
      styles: {
        font: "helvetica",
        fontSize: 9.5,
        textColor: [13, 13, 13],
        cellPadding: { top: 10, right: 0, bottom: 10, left: 0 },
        lineColor: [228, 228, 224],
        lineWidth: 0,
      },
      headStyles: {
        textColor: [122, 127, 138],
        fillColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "left",
      },
      bodyStyles: {
        valign: "top",
      },
      columnStyles: {
        0: { cellWidth: 220 },
        1: { halign: "right", cellWidth: 48 },
        2: { halign: "right", cellWidth: 90 },
        3: { halign: "right", cellWidth: 55 },
        4: { halign: "right", cellWidth: 90 },
      },
      didParseCell: (hook) => {
        hook.cell.styles.lineWidth = { bottom: 0.6 };
        hook.cell.styles.lineColor = [228, 228, 224];
      },
      didDrawCell: (hook) => {
        if (hook.section === "head") {
          doc.setDrawColor(13, 13, 13);
          doc.setLineWidth(1.2);
          doc.line(hook.cell.x, hook.cell.y + hook.cell.height, hook.cell.x + hook.cell.width, hook.cell.y + hook.cell.height);
        }
      },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 480;
    const totalsX = 355;
    const totalsY = finalY + 24;

    const drawRow = (label: string, value: string, y: number) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(122, 127, 138);
      doc.text(label, totalsX, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(13, 13, 13);
      doc.text(value, 555, y, { align: "right" });
      doc.setDrawColor(228, 228, 224);
      doc.setLineWidth(0.5);
      doc.line(totalsX, y + 8, 555, y + 8);
    };

    drawRow("Subtotal", money(totals.subtotal, "pdf"), totalsY);
    drawRow("VAT / Tax", money(totals.tax, "pdf"), totalsY + 22);
    drawRow("Discount", "NGN 0.00", totalsY + 44);

    doc.setFillColor(13, 13, 13);
    doc.roundedRect(totalsX, totalsY + 62, 200, 34, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("TOTAL DUE", totalsX + 14, totalsY + 83);
    doc.setFontSize(15);
    doc.text(money(totals.total, "pdf"), 542, totalsY + 84, { align: "right" });

    const footerY = totalsY + 120;
    doc.setFillColor(250, 250, 248);
    doc.rect(52, footerY, 503, 94, "F");
    doc.setDrawColor(228, 228, 224);
    doc.line(52, footerY, 555, footerY);
    doc.line(303, footerY, 303, footerY + 94);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(44, 62, 115);
    doc.text("SETTLEMENT", 64, footerY + 18);
    doc.text("NOTES & TERMS", 315, footerY + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(122, 127, 138);
    const settlementRows = [
      ["Company", company?.name ?? "Haqly"],
["Branch", branchName ?? "Branch not specified"],
      ["Invoice", invoice.number],
      ["Status", invoice.status],
    ];
    settlementRows.forEach(([label, value], idx) => {
      const y = footerY + 36 + idx * 14;
      doc.text(label, 64, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(13, 13, 13);
      doc.text(value, 130, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(122, 127, 138);
    });

    const noteText =
      "Thank you for your business. Please quote the invoice number on all payments. All values shown are generated from the ERP source record.";
    const splitNotes = doc.splitTextToSize(noteText, 210);
    doc.text(splitNotes, 315, footerY + 36);

    const bottomY = footerY + 111;
    doc.setDrawColor(228, 228, 224);
    doc.line(52, bottomY, 555, bottomY);
    doc.setFontSize(8.5);
    doc.setTextColor(122, 127, 138);
    doc.text(companyRegistrationLine(company), 64, bottomY + 18);
    doc.text("Page 1 of 1", 555, bottomY + 18, { align: "right" });

    doc.setDrawColor(44, 62, 115);
    doc.setLineWidth(1.5);
    doc.circle(304, bottomY + 14, 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(44, 62, 115);
    doc.text("ORIGINAL", 304, bottomY + 11, { align: "center" });
    doc.text("INVOICE", 304, bottomY + 18, { align: "center" });
  });

  doc.save(invoices.length === 1 ? `${invoices[0].number}.pdf` : "invoice-batch.pdf");
}
