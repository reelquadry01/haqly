export type WorkflowCheckStatus = "ready" | "missing" | "attention";
export type WorkflowStageStatus = "completed" | "current" | "blocked" | "upcoming";

export type WorkflowChecklistItem = {
  id: string;
  label: string;
  detail: string;
  status: WorkflowCheckStatus;
};

export type WorkflowStage = {
  id: string;
  label: string;
  detail: string;
  status: WorkflowStageStatus;
};

export type WorkflowRelatedRecord = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export type WorkflowBlueprint = {
  title: string;
  summary: string;
  checklist: WorkflowChecklistItem[];
  stages: WorkflowStage[];
  relatedRecords: WorkflowRelatedRecord[];
  assumptionNote?: string;
};

function statusFromBoolean(condition: boolean, missingDetail?: boolean): WorkflowCheckStatus {
  if (condition) {
    return "ready";
  }
  return missingDetail ? "attention" : "missing";
}

export function buildSalesWorkflow(input: {
  customerCount: number;
  productCount: number;
  taxCodeCount: number;
  invoiceCount: number;
}) : WorkflowBlueprint {
  const hasCustomers = input.customerCount > 0;
  const hasProducts = input.productCount > 0;
  const hasTaxCodes = input.taxCodeCount > 0;
  const hasInvoices = input.invoiceCount > 0;
  const invoiceReady = hasCustomers && hasProducts;

  return {
    title: "Sales process engine",
    summary: "Customer master feeds invoicing, invoices feed receivables, and posted sales flow into the general ledger and reporting.",
    checklist: [
      {
        id: "sales-customers",
        label: "Customer master exists",
        detail: hasCustomers ? `${input.customerCount} customer records are available for billing.` : "Create and approve at least one customer before invoicing.",
        status: statusFromBoolean(hasCustomers),
      },
      {
        id: "sales-products",
        label: "Items or services exist",
        detail: hasProducts ? `${input.productCount} sellable products are available for invoice lines.` : "Add items or services first so invoice lines can be created from master data.",
        status: statusFromBoolean(hasProducts),
      },
      {
        id: "sales-tax",
        label: "Tax setup is ready",
        detail: hasTaxCodes ? `${input.taxCodeCount} tax code(s) are configured for VAT or other statutory treatment.` : "Tax codes are still missing. Direct invoicing works, but tax treatment should be configured before live billing.",
        status: statusFromBoolean(hasTaxCodes, true),
      },
      {
        id: "sales-direct-invoice",
        label: "Direct invoice path is available",
        detail: invoiceReady ? "The invoice desk can create a direct invoice immediately from shared customer and item master data." : "Direct invoicing unlocks as soon as both customer and item master data exist.",
        status: invoiceReady ? "ready" : "missing",
      },
    ],
    stages: [
      {
        id: "sales-stage-customer",
        label: "Customer onboarding",
        detail: "Shared customer records originate in CRM and are reused by billing and statements.",
        status: hasCustomers ? "completed" : "current",
      },
      {
        id: "sales-stage-items",
        label: "Item or service setup",
        detail: "Invoice lines pull from the product master rather than ad-hoc entry.",
        status: hasProducts ? "completed" : hasCustomers ? "current" : "upcoming",
      },
      {
        id: "sales-stage-invoice",
        label: "Invoice creation",
        detail: "Direct invoices are available today and should be created only after customer and item prerequisites are satisfied.",
        status: hasInvoices ? "completed" : invoiceReady ? "current" : "blocked",
      },
      {
        id: "sales-stage-receipt",
        label: "Receipt and statement follow-through",
        detail: "Receivables, customer statements, and collections follow the posted invoice.",
        status: hasInvoices ? "current" : "upcoming",
      },
      {
        id: "sales-stage-gl",
        label: "Ledger and reporting impact",
        detail: "Posted invoices should feed receivables, revenue, tax, and downstream finance reports.",
        status: hasInvoices ? "current" : "upcoming",
      },
    ],
    relatedRecords: [
      { id: "sales-rel-customers", label: "Customers", value: String(input.customerCount), detail: "Shared customer master" },
      { id: "sales-rel-products", label: "Items / services", value: String(input.productCount), detail: "Invoiceable products" },
      { id: "sales-rel-tax", label: "Tax codes", value: String(input.taxCodeCount), detail: "Sales tax treatment" },
      { id: "sales-rel-invoices", label: "Invoices", value: String(input.invoiceCount), detail: "Downstream sales documents" },
    ],
    assumptionNote:
      "Order-based invoicing, quotations, and deliveries are not yet modeled as first-class records in the current schema, so the live sales path currently centers on customer -> direct invoice -> receivable/GL.",
  };
}

export function buildProcurementWorkflow(input: {
  supplierCount: number;
  productCount: number;
  warehouseCount: number;
  taxCodeCount: number;
  billCount: number;
}) : WorkflowBlueprint {
  const hasSuppliers = input.supplierCount > 0;
  const hasProducts = input.productCount > 0;
  const hasWarehouses = input.warehouseCount > 0;
  const hasBills = input.billCount > 0;
  const billReady = hasSuppliers && hasProducts;

  return {
    title: "Procurement process engine",
    summary: "Supplier master, items, and receiving locations feed purchasing. Bills then inform payables, stock, and finance.",
    checklist: [
      {
        id: "proc-suppliers",
        label: "Supplier master exists",
        detail: hasSuppliers ? `${input.supplierCount} suppliers are available for purchase processing.` : "Create at least one supplier before raising live purchase documents.",
        status: statusFromBoolean(hasSuppliers),
      },
      {
        id: "proc-items",
        label: "Purchasable items exist",
        detail: hasProducts ? `${input.productCount} item records can be reused on bills and stock receipts.` : "Create or import items before entering supplier bills.",
        status: statusFromBoolean(hasProducts),
      },
      {
        id: "proc-warehouses",
        label: "Receipt location is available",
        detail: hasWarehouses ? `${input.warehouseCount} warehouses are available for inbound stock receipts.` : "Configure at least one warehouse if purchased goods should land in inventory.",
        status: statusFromBoolean(hasWarehouses, true),
      },
      {
        id: "proc-tax",
        label: "Input tax setup is ready",
        detail: input.taxCodeCount > 0 ? `${input.taxCodeCount} tax code(s) can support purchase tax treatment.` : "Tax codes are missing. Bills can still be entered, but statutory purchase tax treatment is incomplete.",
        status: statusFromBoolean(input.taxCodeCount > 0, true),
      },
    ],
    stages: [
      {
        id: "proc-stage-supplier",
        label: "Vendor setup",
        detail: "Approved supplier records become the single source for bills and payables.",
        status: hasSuppliers ? "completed" : "current",
      },
      {
        id: "proc-stage-bill",
        label: "Bill or receipt entry",
        detail: "Live procurement currently starts from supplier bills, with optional inventory receipt into a warehouse.",
        status: hasBills ? "completed" : billReady ? "current" : "blocked",
      },
      {
        id: "proc-stage-stock",
        label: "Inventory update",
        detail: "When a warehouse is supplied, purchased quantity lands in stock movement history.",
        status: hasBills && hasWarehouses ? "current" : hasBills ? "upcoming" : "blocked",
      },
      {
        id: "proc-stage-payables",
        label: "Vendor liability",
        detail: "Posted bills feed accounts payable and downstream payment processing.",
        status: hasBills ? "current" : "upcoming",
      },
      {
        id: "proc-stage-finance",
        label: "Ledger impact",
        detail: "Purchase postings should feed inventory or expense, tax, and vendor control accounts.",
        status: hasBills ? "current" : "upcoming",
      },
    ],
    relatedRecords: [
      { id: "proc-rel-suppliers", label: "Suppliers", value: String(input.supplierCount), detail: "Reusable vendor master" },
      { id: "proc-rel-items", label: "Items", value: String(input.productCount), detail: "Purchasable goods/services" },
      { id: "proc-rel-warehouses", label: "Warehouses", value: String(input.warehouseCount), detail: "Inbound receipt locations" },
      { id: "proc-rel-bills", label: "Bills", value: String(input.billCount), detail: "Live purchase documents" },
    ],
    assumptionNote:
      "Requisitions, purchase orders, approvals, and goods-received notes are not yet modeled as separate transactional tables, so today’s live procurement path centers on supplier -> bill -> optional stock receipt -> payables/GL.",
  };
}

export function buildInventoryWorkflow(input: {
  productCount: number;
  warehouseCount: number;
  movementCount: number;
  inboundCount: number;
}) : WorkflowBlueprint {
  const hasProducts = input.productCount > 0;
  const hasWarehouses = input.warehouseCount > 0;
  const hasOpeningStock = input.inboundCount > 0;
  const movementReady = hasProducts && hasWarehouses;

  return {
    title: "Inventory process engine",
    summary: "Item master and warehouse setup feed stock receipts, issues, transfers, and valuation. Inventory then informs procurement and finance.",
    checklist: [
      {
        id: "inv-items",
        label: "Item master exists",
        detail: hasProducts ? `${input.productCount} stock items are available for receiving, issuing, and counting.` : "Create or import items before attempting stock activity.",
        status: statusFromBoolean(hasProducts),
      },
      {
        id: "inv-warehouses",
        label: "Warehouse setup exists",
        detail: hasWarehouses ? `${input.warehouseCount} warehouses are available for stock storage and movement.` : "Configure a warehouse before recording stock receipts or issues.",
        status: statusFromBoolean(hasWarehouses),
      },
      {
        id: "inv-opening",
        label: "Opening stock or first receipt exists",
        detail: hasOpeningStock ? `${input.inboundCount} inbound movement(s) have established stock on hand.` : "No inbound receipts exist yet. Issues and transfers should wait until stock is available.",
        status: statusFromBoolean(hasOpeningStock, true),
      },
    ],
    stages: [
      {
        id: "inv-stage-foundation",
        label: "Item and warehouse foundation",
        detail: "Inventory uses shared item master data and structured storage locations.",
        status: hasProducts && hasWarehouses ? "completed" : "current",
      },
      {
        id: "inv-stage-receipt",
        label: "Stock receipt",
        detail: "Inbound movements establish opening stock or purchase receipts.",
        status: hasOpeningStock ? "completed" : movementReady ? "current" : "blocked",
      },
      {
        id: "inv-stage-movement",
        label: "Issue, transfer, or adjustment",
        detail: "Once stock exists, operational movements update availability and traceability.",
        status: input.movementCount > 0 ? "current" : hasOpeningStock ? "current" : "blocked",
      },
      {
        id: "inv-stage-valuation",
        label: "Valuation and replenishment",
        detail: "Stock history feeds valuation, reorder planning, and count/variance review.",
        status: input.movementCount > 0 ? "current" : "upcoming",
      },
    ],
    relatedRecords: [
      { id: "inv-rel-items", label: "Items", value: String(input.productCount), detail: "Inventory master records" },
      { id: "inv-rel-warehouses", label: "Warehouses", value: String(input.warehouseCount), detail: "Storage locations" },
      { id: "inv-rel-movements", label: "Movements", value: String(input.movementCount), detail: "Stock transaction history" },
      { id: "inv-rel-receipts", label: "Inbound receipts", value: String(input.inboundCount), detail: "Stock-on-hand foundation" },
    ],
  };
}

export function buildFinanceWorkflow(input: {
  accountCount: number;
  openPeriodCount: number;
  journalCount: number;
  salesDocumentCount: number;
  purchaseDocumentCount: number;
}) : WorkflowBlueprint {
  const hasAccounts = input.accountCount > 0;
  const hasOpenPeriods = input.openPeriodCount > 0;
  const hasJournals = input.journalCount > 0;
  const readyForPosting = hasAccounts && hasOpenPeriods;

  return {
    title: "Finance process engine",
    summary: "Shared master data and operational postings feed journals, journals feed the general ledger, and the ledger feeds statutory and management reporting.",
    checklist: [
      {
        id: "fin-coa",
        label: "Chart of accounts exists",
        detail: hasAccounts ? `${input.accountCount} GL accounts are available for posting and reporting.` : "Create the chart of accounts before attempting journal or subledger posting.",
        status: statusFromBoolean(hasAccounts),
      },
      {
        id: "fin-periods",
        label: "An open accounting period exists",
        detail: hasOpenPeriods ? `${input.openPeriodCount} open accounting period(s) are available for posting.` : "No open period is available. Finance posting should remain blocked until a period is opened.",
        status: statusFromBoolean(hasOpenPeriods),
      },
      {
        id: "fin-subledgers",
        label: "Operational transactions are feeding finance",
        detail:
          input.salesDocumentCount + input.purchaseDocumentCount > 0
            ? `${input.salesDocumentCount} sales document(s) and ${input.purchaseDocumentCount} procurement document(s) are available as subledger drivers.`
            : "No sales or procurement documents are available yet. Finance is currently relying on direct journals only.",
        status: statusFromBoolean(input.salesDocumentCount + input.purchaseDocumentCount > 0, true),
      },
    ],
    stages: [
      {
        id: "fin-stage-foundation",
        label: "Accounting setup",
        detail: "Company, COA, tax, and periods provide the finance control framework.",
        status: hasAccounts && hasOpenPeriods ? "completed" : "current",
      },
      {
        id: "fin-stage-posting",
        label: "Journal and subledger posting",
        detail: "Manual journals and operational documents post into the ledger only after controls are satisfied.",
        status: hasJournals ? "completed" : readyForPosting ? "current" : "blocked",
      },
      {
        id: "fin-stage-ledger",
        label: "General ledger",
        detail: "Approved postings become immutable ledger activity and support drill-down.",
        status: hasJournals ? "current" : "upcoming",
      },
      {
        id: "fin-stage-reporting",
        label: "Trial balance and final accounts",
        detail: "Ledger balances feed trial balance, financial statements, and management analysis.",
        status: hasJournals ? "current" : "upcoming",
      },
    ],
    relatedRecords: [
      { id: "fin-rel-accounts", label: "GL accounts", value: String(input.accountCount), detail: "Posting destinations" },
      { id: "fin-rel-periods", label: "Open periods", value: String(input.openPeriodCount), detail: "Allowed posting windows" },
      { id: "fin-rel-journals", label: "Journals", value: String(input.journalCount), detail: "Ledger-driving entries" },
      { id: "fin-rel-subledgers", label: "Subledger docs", value: String(input.salesDocumentCount + input.purchaseDocumentCount), detail: "Sales and procurement feeds" },
    ],
  };
}

export function buildCrmWorkflow(input: {
  customerCount: number;
  pendingOnboardingCount: number;
  approvedCustomerCount: number;
  invoiceCount: number;
}) : WorkflowBlueprint {
  const hasCustomers = input.customerCount > 0;
  const canConvertToSales = input.approvedCustomerCount > 0;

  return {
    title: "CRM-to-sales process engine",
    summary: "CRM is the upstream system for customer readiness. Approved customers should flow into invoicing, statements, and collections without re-entry.",
    checklist: [
      {
        id: "crm-customer",
        label: "Customer record exists",
        detail: hasCustomers ? `${input.customerCount} customer record(s) are in the shared master.` : "Create a customer record before sales can invoice or statement this account.",
        status: statusFromBoolean(hasCustomers),
      },
      {
        id: "crm-approval",
        label: "Onboarding approval is complete",
        detail:
          canConvertToSales
            ? `${input.approvedCustomerCount} customer(s) are approved and ready for sales conversion.`
            : input.pendingOnboardingCount > 0
            ? `${input.pendingOnboardingCount} customer(s) are still pending onboarding review.`
            : "Approve at least one customer before treating CRM as a sales-ready party master.",
        status: canConvertToSales ? "ready" : input.pendingOnboardingCount > 0 ? "attention" : "missing",
      },
      {
        id: "crm-sales-link",
        label: "Sales linkage is active",
        detail: input.invoiceCount > 0 ? `${input.invoiceCount} invoice(s) already exist against CRM-managed customers.` : "No sales invoices are linked yet. Approved customers should convert into sales activity next.",
        status: statusFromBoolean(input.invoiceCount > 0, true),
      },
    ],
    stages: [
      {
        id: "crm-stage-onboarding",
        label: "Onboard and classify",
        detail: "Customer identity, contact, type, and KYC/onboarding data are captured here first.",
        status: hasCustomers ? "completed" : "current",
      },
      {
        id: "crm-stage-approval",
        label: "Approve customer readiness",
        detail: "Approved onboarding is the clean handoff point from CRM into live sales operations.",
        status: canConvertToSales ? "completed" : hasCustomers ? "current" : "blocked",
      },
      {
        id: "crm-stage-sales",
        label: "Convert to sales",
        detail: "Approved customers should move into quotes, invoices, statements, and collections.",
        status: input.invoiceCount > 0 ? "current" : canConvertToSales ? "current" : "blocked",
      },
      {
        id: "crm-stage-statement",
        label: "Statements and collections",
        detail: "Once invoices exist, CRM and finance should both expose balance and activity context.",
        status: input.invoiceCount > 0 ? "current" : "upcoming",
      },
    ],
    relatedRecords: [
      { id: "crm-rel-customers", label: "Customers", value: String(input.customerCount), detail: "Shared party records" },
      { id: "crm-rel-pending", label: "Pending onboarding", value: String(input.pendingOnboardingCount), detail: "Needs approval" },
      { id: "crm-rel-approved", label: "Approved customers", value: String(input.approvedCustomerCount), detail: "Ready for sales" },
      { id: "crm-rel-invoices", label: "Linked invoices", value: String(input.invoiceCount), detail: "Downstream sales activity" },
    ],
    assumptionNote:
      "Leads, opportunities, and quotations are still lightweight placeholders in the current product, so the strongest live CRM handoff today is approved customer -> invoice/statement rather than a full opportunity-to-order chain.",
  };
}
