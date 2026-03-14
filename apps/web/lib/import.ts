"use client";

import { downloadCsvFile } from "./export";

export type ImportDatasetKey =
  | "chart_of_accounts"
  | "customers"
  | "suppliers"
  | "products"
  | "tax_codes";

export type ParsedCsvResult = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

export const importTemplates: Record<
  ImportDatasetKey,
  {
    label: string;
    headers: string[];
    sampleRows: string[][];
  }
> = {
  chart_of_accounts: {
    label: "Chart of Accounts",
    headers: ["code", "name", "type", "description", "parentCode", "isActive", "allowsPosting", "isControlAccount", "controlSource"],
    sampleRows: [["4100", "Consulting Revenue", "INCOME", "Professional service revenue", "", "true", "true", "false", ""]],
  },
  customers: {
    label: "Customers",
    headers: ["name", "email", "phone", "line1", "city", "state", "country", "postalCode"],
    sampleRows: [["Atlantic Retail Ltd", "ap@atlanticretail.com", "+2348011111111", "14 Akin Adesola Street", "Lagos", "Lagos", "Nigeria", "100001"]],
  },
  suppliers: {
    label: "Suppliers",
    headers: ["name", "email", "phone", "line1", "city", "state", "country", "postalCode"],
    sampleRows: [["Prime Industrial", "orders@primeindustrial.com", "+2348033333333", "8 Creek Road", "Port Harcourt", "Rivers", "Nigeria", "500001"]],
  },
  products: {
    label: "Products",
    headers: ["sku", "name", "category", "uom", "isActive"],
    sampleRows: [["FG-400", "Demo Product", "Finished Goods", "Unit", "true"]],
  },
  tax_codes: {
    label: "Tax Codes",
    headers: ["companyId", "code", "name", "taxType", "rate", "isInclusive", "recoverable", "filingFrequency", "outputAccountCode", "inputAccountCode", "liabilityAccountCode"],
    sampleRows: [["1", "VAT", "Value Added Tax", "VAT", "7.5", "false", "true", "MONTHLY", "2300", "1400", "2300"]],
  },
};

export function downloadImportTemplate(dataset: ImportDatasetKey) {
  const template = importTemplates[dataset];
  downloadCsvFile(`${dataset}-template.csv`, template.headers, template.sampleRows);
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseCsv(text: string): ParsedCsvResult {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((accumulator, header, index) => {
      accumulator[header] = values[index] ?? "";
      return accumulator;
    }, {});
  });

  return { headers, rows };
}

export async function readCsvFile(file: File) {
  const text = await file.text();
  return parseCsv(text);
}

export function coerceBoolean(value: string | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase() === "true";
}

export function coerceNumber(value: string | undefined) {
  return Number(value ?? 0);
}
