"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

function escapeCsvCell(value: unknown) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsvFile(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const csv = [headers.map(escapeCsvCell).join(","), ...rows.map((row) => row.map(escapeCsvCell).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(filename, blob);
}

export function downloadExcelFile(filename: string, headers: string[], rows: Array<Array<unknown>>, sheetName = "Records") {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(filename, blob);
}

export function downloadPdfFile(filename: string, title: string, headers: string[], rows: Array<Array<unknown>>) {
  const doc = new jsPDF({
    orientation: headers.length > 5 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  const printableRows = rows.map((row) => row.map((value) => String(value ?? "")));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title, 40, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`, 40, 60);

  autoTable(doc, {
    head: [headers],
    body: printableRows,
    startY: 76,
    styles: {
      fontSize: 8,
      cellPadding: 6,
      lineColor: [217, 222, 230],
      lineWidth: 0.5,
      textColor: [28, 37, 54],
    },
    headStyles: {
      fillColor: [36, 74, 146],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [247, 249, 252],
    },
    margin: {
      left: 40,
      right: 40,
      bottom: 36,
    },
  });

  doc.save(filename);
}
