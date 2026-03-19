"use client";

import { downloadCsvFile } from "./export";

export type ImportDatasetKey =
  | "chart_of_accounts"
  | "customers"
  | "suppliers"
  | "products"
  | "tax_codes"
  | "departments"
  | "warehouses"
  | "bank_accounts"
  | "asset_categories"
  | "gl_opening_balances"
  | "gl_journal_dump"
  | "ar_opening_balances"
  | "ap_opening_balances"
  | "customer_receipts"
  | "supplier_payments"
  | "fixed_assets"
  | "stock_opening_balances";

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
  // ── Master data ───────────────────────────────────────────────────────────
  chart_of_accounts: {
    label: "Chart of Accounts",
    headers: [
      "code",
      "name",
      "type",
      "description",
      "parentCode",
      "isActive",
      "allowsPosting",
      "isControlAccount",
      "controlSource",
    ],
    sampleRows: [
      ["1000", "Cash at Bank", "ASSET", "Main operating bank account", "", "true", "true", "false", ""],
      ["1100", "Accounts Receivable", "ASSET", "Trade debtors control account", "", "true", "false", "true", "SALES"],
      ["2000", "Accounts Payable", "LIABILITY", "Trade creditors control account", "", "true", "false", "true", "PROCUREMENT"],
      ["3000", "Retained Earnings", "EQUITY", "Accumulated profit", "", "true", "true", "false", ""],
      ["4000", "Sales Revenue", "INCOME", "Product and service revenue", "", "true", "true", "false", ""],
      ["5000", "Cost of Sales", "EXPENSE", "Direct cost of goods sold", "", "true", "true", "false", ""],
    ],
  },

  customers: {
    label: "Customers",
    headers: ["name", "email", "phone", "customerType", "taxId", "contactPerson", "line1", "line2", "city", "state", "country", "postalCode"],
    sampleRows: [
      ["Atlantic Retail Ltd", "ap@atlanticretail.com", "+2348011111111", "BUSINESS", "12345678-0001", "Amina Yusuf", "14 Akin Adesola Street", "Victoria Island", "Lagos", "Lagos", "Nigeria", "100001"],
      ["Northern Foods Ltd", "finance@northernfoods.ng", "+2348022222222", "BUSINESS", "22345678-0002", "Musa Bello", "5 Industrial Layout", "", "Kano", "Kano", "Nigeria", "700001"],
    ],
  },

  suppliers: {
    label: "Suppliers",
    headers: ["name", "email", "phone", "line1", "line2", "city", "state", "country", "postalCode"],
    sampleRows: [
      ["Prime Industrial", "orders@primeindustrial.com", "+2348033333333", "8 Creek Road", "Trans Amadi", "Port Harcourt", "Rivers", "Nigeria", "500001"],
      ["Lagos Packaging Co", "billing@lagospkg.ng", "+2348044444444", "22 Apapa Road", "", "Lagos", "Lagos", "Nigeria", "100002"],
    ],
  },

  products: {
    label: "Products",
    headers: ["sku", "name", "category", "uom", "isActive"],
    sampleRows: [
      ["FG-400", "Industrial Solvent 20L", "Finished Goods", "Unit", "true"],
      ["RM-110", "Packaging Film Roll", "Raw Materials", "Roll", "true"],
    ],
  },

  tax_codes: {
    label: "Tax Codes",
    headers: [
      "companyId",
      "code",
      "name",
      "taxType",
      "rate",
      "isInclusive",
      "recoverable",
      "filingFrequency",
      "outputAccountCode",
      "inputAccountCode",
      "liabilityAccountCode",
    ],
    sampleRows: [
      ["1", "VAT", "Value Added Tax", "VAT", "7.5", "false", "true", "MONTHLY", "2300", "1400", "2300"],
      ["1", "WHT", "Withholding Tax", "WITHHOLDING", "5", "false", "false", "MONTHLY", "", "", "2400"],
    ],
  },

  departments: {
    label: "Departments",
    headers: ["companyCode", "departmentName"],
    sampleRows: [
      ["HAQLY", "Finance"],
      ["HAQLY", "Operations"],
      ["HAQLY", "Sales"],
    ],
  },

  warehouses: {
    label: "Warehouses",
    headers: ["branchCode", "warehouseName"],
    sampleRows: [
      ["HQ", "Main Warehouse"],
      ["HQ", "Returns Warehouse"],
      ["LAG", "Lekki Warehouse"],
    ],
  },

  bank_accounts: {
    label: "Bank Accounts",
    headers: ["companyCode", "branchCode", "bankName", "accountName", "accountNumber", "currencyCode", "glAccountCode", "isActive"],
    sampleRows: [
      ["HAQLY", "HQ", "Access Bank", "HAQLY Operations", "0123456789", "NGN", "1000", "true"],
      ["HAQLY", "HQ", "GTBank", "HAQLY Collections", "1234567890", "NGN", "1000", "true"],
    ],
  },

  asset_categories: {
    label: "Asset Categories",
    headers: ["name", "usefulLifeMonths", "residualRate", "depreciationMethod"],
    sampleRows: [
      ["Computer Equipment", "36", "5", "STRAIGHT_LINE"],
      ["Motor Vehicles", "72", "10", "STRAIGHT_LINE"],
      ["Production Equipment", "84", "5", "DECLINING_BALANCE"],
    ],
  },

  // ── Accounting migration ──────────────────────────────────────────────────
  gl_opening_balances: {
    label: "GL Opening Balances",
    headers: ["accountCode", "accountName", "type", "debit", "credit", "branchCode", "narration"],
    sampleRows: [
      ["1000", "Cash at Bank", "ASSET", "2500000", "0", "", "Opening balance as at 31 Dec 2025"],
      ["1100", "Accounts Receivable", "ASSET", "5000000", "0", "", "Opening balance as at 31 Dec 2025"],
      ["1200", "Inventory", "ASSET", "3750000", "0", "", "Opening balance as at 31 Dec 2025"],
      ["1500", "Fixed Assets", "ASSET", "12500000", "0", "", "Opening balance as at 31 Dec 2025"],
      ["2000", "Accounts Payable", "LIABILITY", "0", "3200000", "", "Opening balance as at 31 Dec 2025"],
      ["2100", "Accrued Liabilities", "LIABILITY", "0", "550000", "", "Opening balance as at 31 Dec 2025"],
      ["3000", "Retained Earnings", "EQUITY", "0", "20000000", "", "Opening balance as at 31 Dec 2025"],
    ],
  },

  gl_journal_dump: {
    label: "GL Journal Dump",
    headers: [
      "journalNumber",
      "postingDate",
      "branchCode",
      "accountCode",
      "debit",
      "credit",
      "currencyCode",
      "departmentCode",
      "costCenterCode",
      "projectCode",
      "reference",
      "sourceDocument",
      "narration",
    ],
    sampleRows: [
      ["JV-2025-0001", "2025-12-31", "HQ", "1000", "2500000", "0", "NGN", "", "", "", "GLDUMP-001", "LEGACY-ERP", "Cash opening migration"],
      ["JV-2025-0001", "2025-12-31", "HQ", "3000", "0", "2500000", "NGN", "", "", "", "GLDUMP-001", "LEGACY-ERP", "Retained earnings opening migration"],
      ["JV-2025-0002", "2025-12-31", "HQ", "1100", "850000", "0", "NGN", "Finance", "", "", "GLDUMP-002", "INV-2025-0891", "Customer invoice migration"],
      ["JV-2025-0002", "2025-12-31", "HQ", "4000", "0", "850000", "NGN", "Finance", "", "", "GLDUMP-002", "INV-2025-0891", "Revenue migration"],
    ],
  },

  ar_opening_balances: {
    label: "AR Opening Balances",
    headers: [
      "customerName",
      "customerEmail",
      "invoiceNumber",
      "invoiceDate",
      "dueDate",
      "amount",
      "outstanding",
      "currencyCode",
      "narration",
    ],
    sampleRows: [
      ["Atlantic Retail Ltd", "ap@atlanticretail.com", "INV-2025-0891", "2025-12-01", "2025-12-31", "850000", "850000", "NGN", "Opening AR — fully outstanding"],
      ["Northern Foods Ltd", "finance@northernfoods.ng", "INV-2025-0876", "2025-11-15", "2025-12-15", "420000", "210000", "NGN", "Opening AR — partially paid"],
      ["Metro Health Ltd", "accounts@metrohealth.ng", "INV-2025-0860", "2025-11-01", "2025-12-01", "320000", "320000", "NGN", "Opening AR — fully outstanding"],
    ],
  },

  ap_opening_balances: {
    label: "AP Opening Balances",
    headers: [
      "supplierName",
      "supplierEmail",
      "billNumber",
      "billDate",
      "dueDate",
      "amount",
      "outstanding",
      "currencyCode",
      "narration",
    ],
    sampleRows: [
      ["Prime Industrial", "orders@primeindustrial.com", "PO-2025-0441", "2025-12-05", "2026-01-05", "1200000", "1200000", "NGN", "Opening AP — fully outstanding"],
      ["Lagos Packaging Co", "billing@lagospkg.ng", "PO-2025-0398", "2025-11-20", "2025-12-20", "380000", "190000", "NGN", "Opening AP — partially paid"],
    ],
  },

  customer_receipts: {
    label: "Customer Receipts",
    headers: ["customerName", "receiptNumber", "receiptDate", "amount", "invoiceReference", "paymentMethod", "bankAccountCode", "narration"],
    sampleRows: [
      ["Atlantic Retail Ltd", "RCP-2025-0120", "2025-12-28", "850000", "INV-2025-0891", "BANK_TRANSFER", "1000", "Bank transfer received"],
      ["Metro Health Ltd", "RCP-2025-0119", "2025-12-22", "320000", "INV-2025-0860", "CHEQUE", "1000", "Cheque payment cleared"],
    ],
  },

  supplier_payments: {
    label: "Supplier Payments",
    headers: ["supplierName", "paymentReference", "paymentDate", "amount", "billReference", "paymentMethod", "bankAccountCode", "narration"],
    sampleRows: [
      ["Prime Industrial", "PAY-2025-0088", "2025-12-30", "600000", "PO-2025-0441", "BANK_TRANSFER", "1000", "Partial payment for Dec supplies"],
      ["Lagos Packaging Co", "PAY-2025-0087", "2025-12-28", "380000", "PO-2025-0398", "BANK_TRANSFER", "1000", "Full settlement"],
    ],
  },

  fixed_assets: {
    label: "Fixed Asset Register",
    headers: [
      "assetCode",
      "assetName",
      "category",
      "acquisitionDate",
      "costPrice",
      "accumulatedDepreciation",
      "netBookValue",
      "depreciationMethod",
      "usefulLifeYears",
      "assetAccountCode",
      "depreciationAccountCode",
      "location",
      "serialNumber",
      "narration",
    ],
    sampleRows: [
      ["VEH-001", "Toyota Hilux 2022", "Motor Vehicles", "2022-03-15", "12500000", "4166667", "8333333", "STRAIGHT_LINE", "6", "1500", "1510", "Head Office", "TY22-HIL-001", "Migrated from legacy register"],
      ["IT-002", "Dell Server R740", "Computer Equipment", "2023-01-10", "3800000", "1266667", "2533333", "STRAIGHT_LINE", "3", "1500", "1510", "Data Centre", "SRV-DELL-002", "Migrated from legacy register"],
      ["FUR-003", "Executive Office Furniture", "Furniture & Fittings", "2021-06-01", "850000", "425000", "425000", "STRAIGHT_LINE", "4", "1500", "1510", "Head Office", "", "Migrated from legacy register"],
    ],
  },

  stock_opening_balances: {
    label: "Stock Opening Balances",
    headers: ["sku", "productName", "warehouseName", "quantity", "unitCost", "totalValue", "uom", "inventoryAccountCode", "narration"],
    sampleRows: [
      ["FG-400", "Industrial Solvent 20L", "Main Warehouse", "250", "15000", "3750000", "Unit", "1200", "Opening stock as at 31 Dec 2025"],
      ["RM-110", "Packaging Film Roll", "Lekki Warehouse", "80", "8500", "680000", "Roll", "1200", "Opening stock as at 31 Dec 2025"],
      ["FG-401", "Industrial Lubricant 5L", "Main Warehouse", "120", "4500", "540000", "Unit", "1200", "Opening stock as at 31 Dec 2025"],
    ],
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
