export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
// ─────────────────────────────────────────────────────────────────────────────
// Silent token refresh — uses the httpOnly refresh cookie automatically.
// Called when memory token is missing (e.g. after page reload) or on 401.
// ─────────────────────────────────────────────────────────────────────────────
async function silentRefresh(): Promise<string | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include", // sends httpOnly refresh cookie automatically
    });
    if (!response.ok) return null;
    const data = await response.json() as { token?: string };
    if (data?.token) {
      setMemoryToken(data.token);
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// authFetch — drop-in replacement for fetch() on authenticated endpoints.
// Automatically attaches the in-memory token and silently refreshes on 401.
// ─────────────────────────────────────────────────────────────────────────────
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getMemoryToken();

  // No token in memory (e.g. page was reloaded) — try silent refresh first
  if (!token) {
    token = (await silentRefresh()) ?? "";
  }

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // Token expired mid-session — try one silent refresh and retry
  if (response.status === 401) {
    const newToken = await silentRefresh();
    if (!newToken) return response;
    return fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...options.headers,
        Authorization: `Bearer ${newToken}`,
      },
    });
  }

  return response;
}
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "/backend/api/v1";

function toApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return new Error("The request timed out. Please try again.");
    }

    if (error.message === "Failed to fetch") {
      return new Error("The ERP service is unavailable right now. Please retry in a moment or contact your administrator.");
    }

    return error;
  }

  return new Error(fallbackMessage);
}

async function readApiResponse<T>(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") ?? "";
  const rawText = await response.text();
  const isJson = contentType.includes("application/json");
  let data: T | { message?: string } | null = null;
  if (isJson && rawText) {
    try {
      data = JSON.parse(rawText) as T | { message?: string };
    } catch {
      throw new Error("Service returned unreadable data. Please retry.");
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "message" in data && data.message) ||
      (!isJson ? "Service is temporarily unavailable. Please retry in a moment." : undefined) ||
      fallbackMessage;
    throw new Error(message);
  }

  if (!isJson) {
    throw new Error("Service returned an unexpected response. Please retry.");
  }

  return data as T;
}

export type CompanyRecord = {
  id: number;
  name: string;
  legalName?: string | null;
  code?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  logoUrl?: string | null;
  timezone?: string | null;
  fiscalYearStartMonth?: number | null;
  isActive?: boolean;
  useBranches?: boolean;
  useInventory?: boolean;
  usePayroll?: boolean;
  useDepartments?: boolean;
  currency?: {
    id: number;
    code: string;
    name: string;
    symbol?: string | null;
  } | null;
  fiscalYears?: Array<{
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
  branches: Array<{
    id: number;
    name: string;
    code: string;
  }>;
};

export type LoginResponse = {
  token: string;
  roles: string[];
  workspaceRole: string;
  user: {
    id: number;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
};

export type UserRecord = {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type SalesCustomer = {
  id: number;
  companyId?: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  customerType?: string | null;
  onboardingStatus?: string | null;
  contactPerson?: string | null;
  industry?: string | null;
  taxId?: string | null;
  creditLimit?: string | number | null;
  addresses?: Array<{
    id: number;
    line1: string;
    city?: string | null;
    state?: string | null;
    country?: string | null;
  }>;
};

export type PurchaseSupplier = {
  id: number;
  companyId?: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  addresses?: Array<{
    id: number;
    line1: string;
    city?: string | null;
    state?: string | null;
    country?: string | null;
  }>;
};

export type PurchaseBillRecord = {
  id: number;
  number: string;
  supplierId: number;
  date: string;
  dueDate?: string | null;
  status: string;
  total: string | number;
  supplier?: PurchaseSupplier;
  items: Array<{
    id: number;
    productId: number;
    quantity: string | number;
    unitCost: string | number;
    taxRate?: string | number | null;
    product?: InventoryProduct;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type InventoryProduct = {
  id: number;
  companyId?: number;
  name: string;
  sku: string;
  categoryId?: number | null;
  uomId?: number | null;
  isActive: boolean;
};

export type InventoryWarehouse = {
  id: number;
  name: string;
  branchId: number;
  branch?: {
    id: number;
    name: string;
    code: string;
  };
};

export type InventoryStockMovement = {
  id: number;
  productId: number;
  warehouseId: number;
  quantity: string | number;
  direction: string;
  reference?: string | null;
  createdAt: string;
  product?: InventoryProduct;
  warehouse?: InventoryWarehouse;
};

export type TaxConfigRecord = {
  id: number;
  code: string;
  name: string;
  taxType?: string;
  rate: string | number;
  isInclusive: boolean;
  recoverable?: boolean;
  filingFrequency?: string;
  companyId: number;
  outputAccountId?: number | null;
  inputAccountId?: number | null;
  liabilityAccountId?: number | null;
  company?: {
    id: number;
    name: string;
  };
  outputAccount?: {
    id: number;
    code: string;
    name: string;
  } | null;
  inputAccount?: {
    id: number;
    code: string;
    name: string;
  } | null;
  liabilityAccount?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

export type TaxDashboardConfigRow = {
  id: number;
  code: string;
  name: string;
  taxType: string;
  rate: number;
  isInclusive: boolean;
  recoverable: boolean;
  filingFrequency: string;
  outputTax: number;
  inputTax: number;
  netTax: number;
  liabilityBalance: number;
};

export type TaxDashboardResponse = {
  companyId: number;
  from: string | null;
  to: string | null;
  configs: TaxDashboardConfigRow[];
  totals: {
    outputTax: number;
    inputTax: number;
    netTax: number;
    liabilityBalance: number;
  };
  calendar: Array<{
    code: string;
    name: string;
    filingFrequency: string;
    nextDueDate: string;
    status: string;
  }>;
};

export type TaxActivityRow = {
  id: number;
  date: string;
  reference: string;
  description: string;
  taxCode: string;
  taxName: string;
  bucket: string;
  account: string;
  debit: number;
  credit: number;
  net: number;
  memo: string;
};

export type SalesInvoiceRecord = {
  id: number;
  number: string;
  customerId: number;
  date: string;
  dueDate?: string | null;
  status: string;
  total: string | number;
  customer: SalesCustomer;
  items: Array<{
    id: number;
    productId: number;
    quantity: string | number;
    unitPrice: string | number;
    taxRate?: string | number | null;
    product?: InventoryProduct;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type CustomerReceiptStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type CustomerReceiptLineRecord = {
  id: number;
  lineNumber: number;
  invoiceId?: number | null;
  description: string;
  appliedAmount: string | number;
  invoice?: SalesInvoiceRecord | null;
};

export type CustomerReceiptRecord = {
  id: number;
  receiptNumber: string;
  legalEntityId: number;
  branchId: number;
  customerId: number;
  bankAccountId?: number | null;
  cashAccountId?: number | null;
  receivableAccountId: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  postingDate: string;
  currencyCode: string;
  exchangeRate?: string | number | null;
  amount: string | number;
  bankReference?: string | null;
  externalReference?: string | null;
  narration: string;
  remarks?: string | null;
  status: CustomerReceiptStatus;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
  postedBy?: number | null;
  postedAt?: string | null;
  glJournalId?: number | null;
  amountInWords?: string;
  legalEntity?: CompanyRecord | null;
  branch?: CompanyRecord["branches"][number] | null;
  customer?: SalesCustomer | null;
  bankAccount?: {
    id: number;
    name: string;
    accountName?: string | null;
    number?: string | null;
    bankName?: string | null;
    glAccountId?: number | null;
  } | null;
  cashAccount?: AccountingAccount | null;
  receivableAccount?: AccountingAccount | null;
  glJournal?: AccountingJournal | null;
  lines: CustomerReceiptLineRecord[];
};

export type CustomerReceiptMetadataResponse = {
  company: {
    id: number;
    name: string;
    currencyCode: string;
  };
  branches: Array<{
    id: number;
    name: string;
    code: string;
  }>;
  receivableAccounts: AccountingAccount[];
  cashAccounts: AccountingAccount[];
  bankAccounts: Array<{
    id: number;
    name: string;
    accountName?: string | null;
    number?: string | null;
    bankName?: string | null;
    branchId?: number | null;
    currencyCode?: string | null;
    glAccountId?: number | null;
    glAccountCode?: string | null;
    glAccountName?: string | null;
  }>;
  paymentMethods: PaymentMethod[];
};

export type AccountingAccount = {
  id: number;
  code: string;
  name: string;
  type: string;
  description?: string | null;
  parentId?: number | null;
};

export type AccountingJournalLine = {
  id: number;
  entryId: number;
  accountId: number;
  branchId?: number | null;
  debit: string | number;
  credit: string | number;
  memo?: string | null;
};

export type AccountingJournal = {
  id: number;
  reference: string;
  type: string;
  description?: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
  lines: AccountingJournalLine[];
};

export type AccountingVoucher = {
  id: number;
  type: string;
  reference: string;
  amount: string | number;
  date: string;
  payee?: string | null;
  memo?: string | null;
  journalId?: number | null;
};

export type JournalStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "POSTED"
  | "REVERSED"
  | "CANCELLED";

export type JournalType =
  | "MANUAL"
  | "ADJUSTMENT"
  | "ACCRUAL"
  | "REVERSAL"
  | "OPENING_BALANCE"
  | "RECURRING"
  | "ALLOCATION"
  | "RECLASSIFICATION"
  | "SYSTEM";

export type JournalSourceType =
  | "MANUAL"
  | "SALES"
  | "PROCUREMENT"
  | "PAYROLL"
  | "ASSETS"
  | "INVENTORY"
  | "SYSTEM";

export type JournalMetadataResponse = {
  company: {
    id: number;
    name: string;
    currencyCode: string;
  };
  journalTypes: JournalType[];
  sourceTypes: JournalSourceType[];
  statuses: JournalStatus[];
  periods: Array<{
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    fiscalYearId?: number | null;
  }>;
  fiscalYears: Array<{
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
  costCenters: Array<{
    id: number;
    code: string;
    name: string;
  }>;
  projects: Array<{
    id: number;
    code: string;
    name: string;
  }>;
  taxCodes: Array<{
    id: number;
    code: string;
    name: string;
    rate: number;
  }>;
};

export type JournalEntryLineRecord = {
  id: number;
  lineNumber: number;
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  subledgerType?: string | null;
  subledgerId?: string | null;
  debitAmount: string | number;
  creditAmount: string | number;
  transactionCurrencyCode: string;
  exchangeRate?: string | number | null;
  taxCodeId?: number | null;
  taxAmount?: string | number | null;
  branchId?: number | null;
  departmentId?: number | null;
  costCenterId?: number | null;
  projectId?: number | null;
  lineNarration?: string | null;
  partnerName?: string | null;
  partnerCode?: string | null;
};

export type JournalEntryRecord = {
  id: number;
  journalNumber: string;
  journalType: JournalType;
  sourceType: JournalSourceType;
  sourceModule?: string | null;
  sourceDocumentId?: string | null;
  sourceDocumentNumber?: string | null;
  legalEntityId: number;
  branchId: number;
  departmentId?: number | null;
  costCenterId?: number | null;
  projectId?: number | null;
  journalDate: string;
  postingDate: string;
  accountingPeriodId: number;
  fiscalYearId?: number | null;
  currencyCode: string;
  exchangeRate?: string | number | null;
  referenceNumber?: string | null;
  externalReference?: string | null;
  narration: string;
  description?: string | null;
  attachmentCount: number;
  status: JournalStatus;
  workflowStatus: string;
  approvalLevel?: number | null;
  createdBy?: number | null;
  createdAt: string;
  updatedBy?: number | null;
  updatedAt: string;
  submittedBy?: number | null;
  submittedAt?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  postedBy?: number | null;
  postedAt?: string | null;
  reversedBy?: number | null;
  reversedAt?: string | null;
  reversalOfJournalId?: number | null;
  reversalReason?: string | null;
  isSystemGenerated: boolean;
  isAutoReversing: boolean;
  autoReverseDate?: string | null;
  isRecurring: boolean;
  recurringTemplateId?: number | null;
  isIntercompany: boolean;
  intercompanyReference?: string | null;
  postedJournalEntryId?: number | null;
  branch?: {
    id: number;
    name: string;
    code: string;
  } | null;
  legalEntity?: {
    id: number;
    name: string;
  } | null;
  accountingPeriod?: {
    id: number;
    name: string;
    status: string;
  } | null;
  fiscalYear?: {
    id: number;
    name: string;
    status: string;
  } | null;
  costCenter?: {
    id: number;
    code: string;
    name: string;
  } | null;
  project?: {
    id: number;
    code: string;
    name: string;
  } | null;
  lines: JournalEntryLineRecord[];
  attachments?: Array<{
    id: number;
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
  }>;
  approvalHistory?: Array<{
    id: number;
    action: string;
    comments?: string | null;
    actedAt: string;
    actorName?: string | null;
  }>;
  auditLogs?: Array<{
    id: number;
    action: string;
    actorName?: string | null;
    createdAt: string;
  }>;
  statusHistory?: Array<{
    id: number;
    fromStatus?: JournalStatus | null;
    toStatus: JournalStatus;
    changedAt: string;
    reason?: string | null;
  }>;
  reversalJournals?: Array<{
    id: number;
    journalNumber: string;
    status: JournalStatus;
  }>;
  postedJournalEntry?: AccountingJournal | null;
};

export type JournalEntryPayload = {
  journalType: JournalType;
  sourceType?: JournalSourceType;
  sourceModule?: string;
  sourceDocumentId?: string;
  sourceDocumentNumber?: string;
  legalEntityId: number;
  branchId: number;
  departmentId?: number;
  costCenterId?: number;
  projectId?: number;
  journalDate: string;
  postingDate: string;
  accountingPeriodId: number;
  fiscalYearId?: number;
  currencyCode: string;
  exchangeRate?: number;
  referenceNumber?: string;
  externalReference?: string;
  narration: string;
  description?: string;
  isAutoReversing?: boolean;
  autoReverseDate?: string;
  isRecurring?: boolean;
  recurringTemplateId?: number;
  isIntercompany?: boolean;
  intercompanyReference?: string;
  idempotencyKey?: string;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    mimeType?: string;
  }>;
  lines: Array<{
    accountId: number;
    subledgerType?: string;
    subledgerId?: string;
    debitAmount?: number;
    creditAmount?: number;
    transactionCurrencyCode?: string;
    exchangeRate?: number;
    taxCodeId?: number;
    taxAmount?: number;
    branchId?: number;
    departmentId?: number;
    costCenterId?: number;
    projectId?: number;
    lineNarration?: string;
    partnerName?: string;
    partnerCode?: string;
  }>;
};

export type PaymentVoucherStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "PARTIALLY_APPROVED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "POSTED"
  | "PAID"
  | "FAILED_PAYMENT"
  | "REVERSED";

export type PaymentWorkflowStatus =
  | "AWAITING_SUBMISSION"
  | "AWAITING_LEVEL_1_APPROVAL"
  | "AWAITING_LEVEL_2_APPROVAL"
  | "AWAITING_FINAL_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED_FOR_CORRECTION";

export type PaymentExecutionStatus =
  | "NOT_PAID"
  | "PAYMENT_INITIATED"
  | "PAYMENT_PROCESSING"
  | "PAID"
  | "FAILED"
  | "REVERSED";

export type PaymentVoucherType =
  | "VENDOR_PAYMENT"
  | "EXPENSE_PAYMENT"
  | "STAFF_REIMBURSEMENT"
  | "ADVANCE_PAYMENT"
  | "PREPAYMENT"
  | "REFUND"
  | "TAX_REMITTANCE"
  | "INTERCOMPANY_PAYMENT"
  | "BANK_TRANSFER"
  | "CASH_PAYMENT";

export type PaymentMethod =
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "CASH"
  | "CARD"
  | "GATEWAY"
  | "WALLET";

export type PaymentBeneficiaryType =
  | "VENDOR"
  | "EMPLOYEE"
  | "CUSTOMER"
  | "TAX_AUTHORITY"
  | "BANK"
  | "OTHER";

export type PaymentTemplateRecord = {
  id: number;
  name: string;
  voucherType: PaymentVoucherType;
  templateKind: "STANDARD_CORPORATE" | "FINANCE_TREASURY" | "CLEAN_A4";
  paymentMethod?: PaymentMethod | null;
  requiresAttachment: boolean;
  allowRecall: boolean;
  postAfterFinalApproval: boolean;
  allowPaymentExecution: boolean;
  enableGateway: boolean;
  defaultNarration?: string | null;
  purposeTemplate?: string | null;
  approvalMatrix?: unknown;
};

export type PaymentVoucherLineRecord = {
  id: number;
  lineNumber: number;
  lineType: string;
  accountId: number;
  accountCode: string;
  accountName: string;
  description: string;
  grossAmount: string | number;
  taxCodeId?: number | null;
  taxAmount?: string | number | null;
  withholdingTaxCodeId?: number | null;
  withholdingTaxAmount?: string | number | null;
  netAmount: string | number;
  branchId?: number | null;
  departmentId?: number | null;
  costCenterId?: number | null;
  projectId?: number | null;
  dueDate?: string | null;
  lineStatus: string;
  account?: AccountingAccount;
  taxCode?: TaxConfigRecord | null;
  withholdingTaxCode?: TaxConfigRecord | null;
};

export type PaymentVoucherRecord = {
  id: number;
  voucherNumber: string;
  voucherType: PaymentVoucherType;
  sourceType: string;
  sourceModule?: string | null;
  sourceDocumentId?: string | null;
  sourceDocumentNumber?: string | null;
  legalEntityId: number;
  branchId: number;
  departmentId?: number | null;
  costCenterId?: number | null;
  projectId?: number | null;
  beneficiaryType: PaymentBeneficiaryType;
  beneficiaryId?: string | null;
  beneficiaryName: string;
  beneficiaryCode?: string | null;
  supplierId?: number | null;
  payableAccountId?: number | null;
  bankAccountId?: number | null;
  cashAccountId?: number | null;
  paymentMethod: PaymentMethod;
  paymentChannel?: string | null;
  currencyCode: string;
  exchangeRate?: string | number | null;
  voucherDate: string;
  requestedPaymentDate: string;
  postingDate: string;
  accountingPeriodId: number;
  fiscalYearId?: number | null;
  referenceNumber?: string | null;
  externalReference?: string | null;
  invoiceReference?: string | null;
  narration: string;
  purposeOfPayment: string;
  totalAmount: string | number;
  taxAmount?: string | number | null;
  withholdingTaxAmount?: string | number | null;
  netPaymentAmount: string | number;
  status: PaymentVoucherStatus;
  workflowStatus: PaymentWorkflowStatus;
  paymentStatus: PaymentExecutionStatus;
  approvalLevel: number;
  currentApproverId?: number | null;
  finalApproverId?: number | null;
  requiresAttachment: boolean;
  attachmentCount: number;
  commentsCount: number;
  createdBy?: number | null;
  createdAt: string;
  updatedBy?: number | null;
  updatedAt: string;
  submittedBy?: number | null;
  submittedAt?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  rejectedBy?: number | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
  postedBy?: number | null;
  postedAt?: string | null;
  paidBy?: number | null;
  paidAt?: string | null;
  cancelledBy?: number | null;
  cancelledAt?: string | null;
  isSystemGenerated: boolean;
  isPostedToGL: boolean;
  glJournalId?: number | null;
  gatewayTransactionReference?: string | null;
  bankPaymentReference?: string | null;
  amountInWords?: string;
  branch?: CompanyRecord["branches"][number];
  bankAccount?: {
    id: number;
    name: string;
    accountName?: string | null;
    number?: string | null;
    bankName?: string | null;
    glAccountId?: number | null;
  } | null;
  cashAccount?: AccountingAccount | null;
  payableAccount?: AccountingAccount | null;
  glJournal?: AccountingJournal | null;
  template?: PaymentTemplateRecord | null;
  lines: PaymentVoucherLineRecord[];
  attachments?: Array<{
    id: number;
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
    uploadedAt: string;
  }>;
  comments?: Array<{
    id: number;
    commentType: string;
    body: string;
    authorName?: string | null;
    createdAt: string;
  }>;
  approvalHistory?: Array<{
    id: number;
    action: string;
    approvalLevel: number;
    actorName?: string | null;
    comments?: string | null;
    rejectionReason?: string | null;
    assignedRole?: string | null;
    actedAt: string;
  }>;
  statusHistory?: Array<{
    id: number;
    fromStatus?: PaymentVoucherStatus | null;
    toStatus?: PaymentVoucherStatus | null;
    fromWorkflowStatus?: PaymentWorkflowStatus | null;
    toWorkflowStatus?: PaymentWorkflowStatus | null;
    fromPaymentStatus?: PaymentExecutionStatus | null;
    toPaymentStatus?: PaymentExecutionStatus | null;
    changedAt: string;
    reason?: string | null;
  }>;
  paymentEvents?: Array<{
    id: number;
    eventType: string;
    providerName?: string | null;
    providerReference?: string | null;
    providerStatus?: string | null;
    providerMessage?: string | null;
    bankReference?: string | null;
    proofFileUrl?: string | null;
    createdAt: string;
  }>;
};

export type PaymentVoucherMetadataResponse = {
  company: {
    id: number;
    name: string;
    currencyCode: string;
  };
  voucherTypes: PaymentVoucherType[];
  paymentMethods: PaymentMethod[];
  statuses: PaymentVoucherStatus[];
  paymentStatuses: PaymentExecutionStatus[];
  workflowStatuses: PaymentWorkflowStatus[];
  beneficiaryTypes: PaymentBeneficiaryType[];
  periods: JournalMetadataResponse["periods"];
  fiscalYears: JournalMetadataResponse["fiscalYears"];
  branches: CompanyRecord["branches"];
  costCenters: JournalMetadataResponse["costCenters"];
  projects: JournalMetadataResponse["projects"];
  taxCodes: Array<{
    id: number;
    code: string;
    name: string;
    rate: number;
    inputAccountId?: number | null;
    liabilityAccountId?: number | null;
  }>;
  bankAccounts: Array<{
    id: number;
    name: string;
    accountName?: string | null;
    number?: string | null;
    bankName?: string | null;
    currencyCode?: string | null;
    branchId?: number | null;
    glAccountId?: number | null;
  }>;
  templates: PaymentTemplateRecord[];
  accounts: Array<{
    id: number;
    code: string;
    name: string;
    type: string;
    requiresSubledger?: boolean;
    requiresDepartment?: boolean;
    requiresCostCenter?: boolean;
    requiresProject?: boolean;
    requiresTax?: boolean;
  }>;
  suppliers: PurchaseSupplier[];
};

export type PaymentVoucherPayload = {
  voucherType: PaymentVoucherType;
  sourceType?: string;
  sourceModule?: string;
  sourceDocumentId?: string;
  sourceDocumentNumber?: string;
  legalEntityId: number;
  branchId: number;
  departmentId?: number;
  costCenterId?: number;
  projectId?: number;
  beneficiaryType: PaymentBeneficiaryType;
  beneficiaryId?: string;
  beneficiaryName: string;
  beneficiaryCode?: string;
  supplierId?: number;
  payableAccountId?: number;
  bankAccountId?: number;
  cashAccountId?: number;
  paymentMethod: PaymentMethod;
  paymentChannel?: string;
  currencyCode: string;
  exchangeRate?: number;
  voucherDate: string;
  requestedPaymentDate: string;
  postingDate: string;
  accountingPeriodId: number;
  fiscalYearId?: number;
  referenceNumber?: string;
  externalReference?: string;
  invoiceReference?: string;
  narration: string;
  purposeOfPayment: string;
  requiresAttachment?: boolean;
  templateId?: number;
  idempotencyKey?: string;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    mimeType?: string;
  }>;
  lines: Array<{
    lineType: string;
    accountId: number;
    subledgerType?: string;
    subledgerId?: string;
    sourceInvoiceId?: string;
    sourceInvoiceNumber?: string;
    sourceExpenseClaimId?: string;
    description: string;
    grossAmount: number;
    taxCodeId?: number;
    taxAmount?: number;
    withholdingTaxCodeId?: number;
    withholdingTaxAmount?: number;
    netAmount: number;
    branchId?: number;
    departmentId?: number;
    costCenterId?: number;
    projectId?: number;
    dueDate?: string;
  }>;
};

export type FixedAssetCategoryRecord = {
  id: number;
  name: string;
  usefulLifeMonths: number;
  residualRate?: string | number;
  depreciationMethod: string;
};

export type DepreciationLineRecord = {
  id: number;
  runId: number;
  assetId: number;
  amount: string | number;
  accumulated: string | number;
  periodStart: string;
  periodEnd: string;
};

export type FixedAssetRecord = {
  id: number;
  tag: string;
  name: string;
  categoryId: number;
  branchId?: number | null;
  acquisitionDate: string;
  acquisitionCost: string | number;
  residualValue: string | number;
  status: string;
  depreciationStart?: string | null;
  category: FixedAssetCategoryRecord;
  depreciationLines: DepreciationLineRecord[];
};

export type LoanScheduleRecord = {
  id: number;
  installment: number;
  dueDate: string;
  principalDue: string | number;
  interestDue: string | number;
  feesDue: string | number;
  status: string;
};

export type LoanPaymentRecord = {
  id: number;
  loanId: number;
  scheduleId?: number | null;
  paymentDate: string;
  principalPaid: string | number;
  interestPaid: string | number;
  feesPaid: string | number;
  memo?: string | null;
};

export type LoanRecord = {
  id: number;
  code: string;
  lender: string;
  type: string;
  principal: string | number;
  startDate: string;
  endDate?: string | null;
  baseRate?: string | number | null;
  spread?: string | number | null;
  scheduleType: string;
  schedules?: LoanScheduleRecord[];
  payments?: LoanPaymentRecord[];
};

export type TrialBalanceRow = {
  code: string;
  account: string;
  type: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
};

export type AccountStatementSummaryRow = {
  code: string;
  account: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
  entries: number;
  lastActivity: string | null;
};

export type AccountStatementDetailRow = {
  date: string;
  reference: string;
  description: string;
  memo: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type TrialBalanceResponse = {
  report: string;
  from: string | null;
  asOf: string;
  rows: TrialBalanceRow[];
  totals: {
    openingDebit: number;
    openingCredit: number;
    periodDebit: number;
    periodCredit: number;
    closingDebit: number;
    closingCredit: number;
  };
};

export type AccountStatementSummaryResponse = {
  report: string;
  from: string | null;
  to: string | null;
  rows: AccountStatementSummaryRow[];
  totals: { debit: number; credit: number; balance: number };
};

export type AccountStatementResponse = {
  report: string;
  account: { id: number; code: string; name: string; type: string };
  from: string | null;
  to: string | null;
  rows: AccountStatementDetailRow[];
  totals: { debit: number; credit: number; closingBalance: number };
};

export type FinancialStatementLine = {
  label: string;
  current: number;
  comparative: number;
  depth?: number;
  kind?: "account" | "subtotal" | "total" | "info";
  code?: string;
  category?: string | null;
};

export type FinancialStatementSection = {
  key: string;
  label: string;
  lines: FinancialStatementLine[];
};

export type FinancialStatementResponse = {
  report: "financial_statement";
  statement: "profit-or-loss" | "financial-position" | "cash-flow" | "changes-in-equity" | "notes";
  title: string;
  company: { id: number | null; name: string };
  branch: { id: number | null; name: string | null };
  currency: string;
  period: {
    from: string | null;
    to: string | null;
    compareFrom: string | null;
    compareTo: string | null;
  };
  sections: FinancialStatementSection[];
  warnings: string[];
  validation: Record<string, unknown>;
  schedules?: Array<{
    title: string;
    rows: Array<{ code: string; account: string; current: number; comparative: number }>;
  }>;
};

export type RatioAnalysisRow = {
  category: string;
  name: string;
  value: number | null;
  formattedValue: string;
  formula: string;
  interpretation: string;
  status: "ok" | "warning";
};

export type RatioAnalysisResponse = {
  report: "ratio_analysis";
  company: { id: number | null; name: string };
  branch: { id: number | null; name: string | null };
  currency: string;
  period: {
    from: string | null;
    to: string | null;
    compareFrom: string | null;
    compareTo: string | null;
  };
  ratios: RatioAnalysisRow[];
  warnings: string[];
  sourceSummary: Record<string, number>;
};

export type BulkImportResponse = {
  dataset: string;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

export type FiscalYearPeriodRecord = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED" | "LOCKED";
};

export type FiscalYearRecord = {
  id: number;
  companyId: number;
  name: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED" | "LOCKED";
  isCurrent: boolean;
  counts: {
    total: number;
    open: number;
    closed: number;
    locked: number;
  };
  periods: FiscalYearPeriodRecord[];
};

export async function getHealth() {
  const response = await fetch(`${apiBaseUrl}/health`, {
    cache: "no-store",
  });

  return readApiResponse<{
    status: string;
  }>(response, "Health check failed");
}

export async function importChartOfAccounts(token: string, rows: Array<Record<string, unknown>>) {
  const response = await fetch(`${apiBaseUrl}/imports/chart-of-accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rows }),
  });

  return readApiResponse<BulkImportResponse>(response, "Could not import chart of accounts");
}

export async function importCustomers(token: string, companyId: number, rows: Array<Record<string, unknown>>) {
  const response = await fetch(`${apiBaseUrl}/imports/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ companyId, rows }),
  });

  return readApiResponse<BulkImportResponse>(response, "Could not import customers");
}

export async function importSuppliers(token: string, companyId: number, rows: Array<Record<string, unknown>>) {
  const response = await fetch(`${apiBaseUrl}/imports/suppliers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ companyId, rows }),
  });

  return readApiResponse<BulkImportResponse>(response, "Could not import suppliers");
}

export async function importProducts(token: string, companyId: number, rows: Array<Record<string, unknown>>) {
  const response = await fetch(`${apiBaseUrl}/imports/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ companyId, rows }),
  });

  return readApiResponse<BulkImportResponse>(response, "Could not import products");
}

export async function importTaxConfigs(token: string, rows: Array<Record<string, unknown>>) {
  const response = await fetch(`${apiBaseUrl}/imports/tax-configs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rows }),
  });

  return readApiResponse<BulkImportResponse>(response, "Could not import tax codes");
}

export async function getCompanies(token?: string, options?: { includeInactive?: boolean }) {
  const query = new URLSearchParams();
  if (options?.includeInactive) {
    query.set("includeInactive", "true");
  }
  const response = await fetch(`${apiBaseUrl}/org/companies${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return readApiResponse<CompanyRecord[]>(response, `Companies request failed: ${response.status}`);
}

export async function getUsers(token: string) {
  const response = await fetch(`${apiBaseUrl}/users`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<UserRecord[]>(response, "Could not load users");
}

export async function login(email: string, password: string) {
  try {
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await readApiResponse<LoginResponse>(response, "Login failed");
    if (!("token" in data)) {
      throw new Error("Login failed");
    }

    return data;
  } catch (error) {
    throw toApiError(error, "Login failed");
  }
}

export async function createUser(
  token: string,
  payload: { email: string; password: string; firstName?: string; lastName?: string; isActive?: boolean },
) {
  const response = await fetch(`${apiBaseUrl}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<UserRecord>(response, "Could not create user");
}

export async function updateUser(
  token: string,
  userId: number,
  payload: { firstName?: string; lastName?: string; isActive?: boolean },
) {
  const response = await fetch(`${apiBaseUrl}/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<UserRecord>(response, "Could not update user");
}

export async function createAdminRole(
  token: string,
  payload: { name: string; description?: string; permissions?: string[] },
) {
  const response = await fetch(`${apiBaseUrl}/admin/roles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<{ id: number; name: string; description?: string | null }>(response, "Could not create role");
}

export async function createAdminPermission(
  token: string,
  payload: { code: string; description?: string },
) {
  const response = await fetch(`${apiBaseUrl}/admin/permissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<{ id: number; code: string; description?: string | null }>(
    response,
    "Could not create permission",
  );
}

export async function assignAdminRoles(token: string, userId: number, roles: string[]) {
  const response = await fetch(`${apiBaseUrl}/admin/users/${userId}/roles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ roles }),
  });

  return readApiResponse<{ userId: number; roles: string[] }>(response, "Could not assign roles");
}

export async function getFiscalYears(token: string, companyId: number) {
  const response = await fetch(`${apiBaseUrl}/admin/fiscal-years?companyId=${companyId}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<FiscalYearRecord[]>(response, "Could not load fiscal years");
}

export async function createFiscalYear(
  token: string,
  payload: {
    companyId: number;
    name: string;
    startDate: string;
    endDate: string;
    generateMonthlyPeriods?: boolean;
  },
) {
  const response = await fetch(`${apiBaseUrl}/admin/fiscal-years`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<FiscalYearRecord>(response, "Could not create fiscal year");
}

export async function closeFiscalYear(token: string, fiscalYearId: number, reason?: string) {
  const response = await fetch(`${apiBaseUrl}/admin/fiscal-years/${fiscalYearId}/close`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });

  return readApiResponse<{ status: string; fiscalYearId: number; reason?: string | null }>(
    response,
    "Could not close fiscal year",
  );
}

export async function lockFiscalYear(token: string, fiscalYearId: number, reason?: string) {
  const response = await fetch(`${apiBaseUrl}/admin/fiscal-years/${fiscalYearId}/lock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });

  return readApiResponse<{ status: string; fiscalYearId: number; reason?: string | null }>(
    response,
    "Could not lock fiscal year",
  );
}

export async function updateAccountingPeriodStatus(
  token: string,
  periodId: number,
  payload: { status: "OPEN" | "CLOSED" | "LOCKED"; reason?: string },
) {
  const response = await fetch(`${apiBaseUrl}/admin/accounting-periods/${periodId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<FiscalYearPeriodRecord & { fiscalYearStatus: string; reason?: string | null }>(
    response,
    "Could not update the accounting period",
  );
}

export async function createCompany(
  token: string,
  payload: {
    name: string;
    code: string;
    legalName?: string;
    registrationNumber?: string;
    taxId?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    currencyCode?: string;
    timezone?: string;
    fiscalYearStartMonth?: number;
    isActive?: boolean;
    useBranches?: boolean;
    useInventory?: boolean;
    usePayroll?: boolean;
    useDepartments?: boolean;
    logoUrl?: string;
    defaultBranchName?: string;
    defaultBranchCode?: string;
  },
) {
  const response = await fetch(`${apiBaseUrl}/org/companies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<CompanyRecord>(response, "Could not create company");
}

export async function updateCompany(
  token: string,
  companyId: number,
  payload: {
    name?: string;
    legalName?: string;
    code?: string;
    registrationNumber?: string;
    taxId?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    currencyCode?: string;
    timezone?: string;
    fiscalYearStartMonth?: number;
    isActive?: boolean;
    useBranches?: boolean;
    useInventory?: boolean;
    usePayroll?: boolean;
    useDepartments?: boolean;
    logoUrl?: string;
  },
) {
  const response = await fetch(`${apiBaseUrl}/org/companies/${companyId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<CompanyRecord>(response, "Could not update company");
}

export async function createBranch(
  token: string,
  companyId: number,
  payload: { name: string; code: string },
) {
  const response = await fetch(`${apiBaseUrl}/org/companies/${companyId}/branches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<{ id: number; name: string; code: string }>(response, "Could not create branch");
}

export async function cloneCompany(
  token: string,
  companyId: number,
  payload: { name: string; code?: string; branchCodePrefix?: string },
) {
  const response = await fetch(`${apiBaseUrl}/org/companies/${companyId}/clone`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<{ company: CompanyRecord }>(response, "Could not clone company");
}

export async function getSalesCustomers(token: string, companyId?: number) {
  const query = new URLSearchParams();
  if (companyId) query.set("companyId", String(companyId));
  const response = await fetch(`${apiBaseUrl}/sales/customers${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<SalesCustomer[]>(response, "Could not load customers");
}

export async function createSalesCustomer(
  token: string,
  payload: {
    companyId: number;
    name: string;
    email?: string;
    phone?: string;
    customerType?: string;
    onboardingStatus?: string;
    contactPerson?: string;
    industry?: string;
    taxId?: string;
    creditLimit?: number;
    addressLine1?: string;
    city?: string;
    state?: string;
    country?: string;
  },
) {
  const response = await fetch(`${apiBaseUrl}/sales/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<SalesCustomer>(response, "Could not create customer");
}


export async function updateSalesCustomer(
  token: string,
  customerId: number,
  companyId: number,
  payload: {
    name?: string;
    email?: string;
    phone?: string;
    customerType?: string;
    onboardingStatus?: string;
    contactPerson?: string;
    industry?: string;
    taxId?: string;
    creditLimit?: number;
    addressLine1?: string;
    city?: string;
    state?: string;
    country?: string;
  },
) {
  const response = await fetch(`${apiBaseUrl}/sales/customers/${customerId}?companyId=${companyId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<SalesCustomer>(response, "Could not update customer");
}
export async function getSalesInvoices(token: string, companyId?: number) {
  const query = new URLSearchParams();
  if (companyId) query.set("companyId", String(companyId));
  const response = await fetch(`${apiBaseUrl}/sales/invoices${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<SalesInvoiceRecord[]>(response, "Could not load invoices");
}

export async function createSalesInvoice(
  token: string,
  payload: {
    legalEntityId: number;
    customerId: number;
    date: string;
    dueDate?: string;
    warehouseId?: number;
    arAccountId?: number;
    revenueAccountId?: number;
    taxAccountId?: number;
    items: Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
      taxRate?: number;
    }>;
  },
) {
  const response = await fetch(`${apiBaseUrl}/sales/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<SalesInvoiceRecord>(response, "Could not create invoice");
}

export async function getCustomerReceiptMetadata(token: string, legalEntityId: number) {
  const response = await fetch(`${apiBaseUrl}/sales/receipts/metadata/options/${legalEntityId}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<CustomerReceiptMetadataResponse>(response, "Could not load receipt setup");
}

export async function getCustomerReceipts(token: string, params?: { companyId?: number; branchId?: number }) {
  const query = new URLSearchParams();
  if (params?.companyId) query.set("companyId", String(params.companyId));
  if (params?.branchId) query.set("branchId", String(params.branchId));
  const response = await fetch(`${apiBaseUrl}/sales/receipts${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<CustomerReceiptRecord[]>(response, "Could not load customer receipts");
}

export async function getCustomerReceipt(token: string, receiptId: number, companyId?: number) {
  const response = await fetch(`${apiBaseUrl}/sales/receipts/${receiptId}${companyId ? `?companyId=${companyId}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<CustomerReceiptRecord>(response, "Could not load the customer receipt");
}

export async function createCustomerReceipt(
  token: string,
  payload: {
    legalEntityId: number;
    branchId: number;
    customerId: number;
    bankAccountId?: number;
    cashAccountId?: number;
    receivableAccountId: number;
    paymentMethod: PaymentMethod;
    paymentDate: string;
    postingDate: string;
    currencyCode: string;
    exchangeRate?: number;
    bankReference?: string;
    externalReference?: string;
    narration: string;
    remarks?: string;
    lines: Array<{
      invoiceId?: number;
      description: string;
      appliedAmount: number;
    }>;
  },
) {
  const response = await fetch(`${apiBaseUrl}/sales/receipts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<CustomerReceiptRecord>(response, "Could not save customer receipt");
}

export async function postCustomerReceipt(
  token: string,
  receiptId: number,
  payload?: {
    narration?: string;
  },
) {
  const response = await fetch(`${apiBaseUrl}/sales/receipts/${receiptId}/post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload ?? {}),
  });

  return readApiResponse<CustomerReceiptRecord>(response, "Could not post customer receipt to the general ledger");
}

export async function getInventoryProducts(token: string, companyId?: number) {
  const query = new URLSearchParams();
  if (companyId) query.set("companyId", String(companyId));
  const response = await fetch(`${apiBaseUrl}/inventory/products${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<InventoryProduct[]>(response, "Could not load products");
}

export async function getInventoryWarehouses(token: string, companyId?: number) {
  const query = new URLSearchParams();
  if (companyId) query.set("companyId", String(companyId));
  const response = await fetch(`${apiBaseUrl}/inventory/warehouses${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<InventoryWarehouse[]>(response, "Could not load warehouses");
}

export async function getInventoryStockMovements(token: string, companyId?: number) {
  const query = new URLSearchParams();
  if (companyId) query.set("companyId", String(companyId));
  const response = await fetch(`${apiBaseUrl}/inventory/stock-movements${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<InventoryStockMovement[]>(response, "Could not load stock movements");
}

export async function createInventoryStockMovement(
  token: string,
  payload: {
    productId: number;
    warehouseId: number;
    quantity: number;
    direction: "IN" | "OUT";
    reference?: string;
  },
) {
  const response = await fetch(`${apiBaseUrl}/inventory/stock-movements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<InventoryStockMovement>(response, "Could not save stock movement");
}

export async function getPurchaseSuppliers(token: string, companyId?: number) {
  const query = new URLSearchParams();
  if (companyId) query.set("companyId", String(companyId));
  const response = await fetch(`${apiBaseUrl}/purchases/suppliers${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<PurchaseSupplier[]>(response, "Could not load suppliers");
}

export async function createPurchaseSupplier(
  token: string,
  payload: {
    companyId: number;
    name: string;
    email?: string;
    phone?: string;
  },
) {
  const response = await fetch(`${apiBaseUrl}/purchases/suppliers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<PurchaseSupplier>(response, "Could not create supplier");
}

export async function getPurchaseBills(token: string, companyId?: number) {
  const query = new URLSearchParams();
  if (companyId) query.set("companyId", String(companyId));
  const response = await fetch(`${apiBaseUrl}/purchases/bills${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<PurchaseBillRecord[]>(response, "Could not load purchase bills");
}

export async function createPurchaseBill(
  token: string,
  payload: {
    legalEntityId: number;
    supplierId: number;
    date: string;
    dueDate?: string;
    warehouseId?: number;
    items: Array<{
      productId: number;
      quantity: number;
      unitCost: number;
      taxRate?: number;
    }>;
  },
) {
  const response = await fetch(`${apiBaseUrl}/purchases/bills`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<PurchaseBillRecord>(response, "Could not create purchase bill");
}

export async function getTaxConfigs(token: string, companyId: number) {
  const response = await fetch(`${apiBaseUrl}/tax/configs?companyId=${companyId}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<TaxConfigRecord[]>(response, "Could not load tax rules");
}

export async function createTaxConfig(
  token: string,
  payload: {
    companyId: number;
    code: string;
    name: string;
    taxType?: string;
    rate: number;
    isInclusive: boolean;
    recoverable?: boolean;
    filingFrequency?: string;
    outputAccountId?: number;
    inputAccountId?: number;
    liabilityAccountId?: number;
  },
) {
  const response = await fetch(`${apiBaseUrl}/tax/configs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<TaxConfigRecord>(response, "Could not create tax rule");
}

export async function updateTaxConfig(
  token: string,
  id: number,
  payload: {
    code?: string;
    name?: string;
    taxType?: string;
    rate?: number;
    isInclusive?: boolean;
    recoverable?: boolean;
    filingFrequency?: string;
    outputAccountId?: number;
    inputAccountId?: number;
    liabilityAccountId?: number;
  },
) {
  const response = await fetch(`${apiBaseUrl}/tax/configs/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<TaxConfigRecord>(response, "Could not update tax rule");
}

export async function getTaxDashboard(
  token: string,
  companyId: number,
  options?: { from?: string; to?: string },
) {
  const query = new URLSearchParams({ companyId: String(companyId) });
  if (options?.from) query.set("from", options.from);
  if (options?.to) query.set("to", options.to);

  const response = await fetch(`${apiBaseUrl}/tax/dashboard?${query.toString()}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<TaxDashboardResponse>(response, "Could not load tax dashboard");
}

export async function getTaxActivity(
  token: string,
  companyId: number,
  options?: { from?: string; to?: string },
) {
  const query = new URLSearchParams({ companyId: String(companyId) });
  if (options?.from) query.set("from", options.from);
  if (options?.to) query.set("to", options.to);

  const response = await fetch(`${apiBaseUrl}/tax/activity?${query.toString()}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<TaxActivityRow[]>(response, "Could not load tax activity");
}

export async function getAccountingAccounts(token: string) {
  const response = await fetch(`${apiBaseUrl}/accounting/accounts`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<AccountingAccount[]>(response, "Could not load chart of accounts");
}

export async function getFixedAssetCategories(token: string) {
  const response = await fetch(`${apiBaseUrl}/fixed-assets/categories`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  return readApiResponse<FixedAssetCategoryRecord[]>(response, "Could not load asset categories");
}

export async function createFixedAsset(
  token: string,
  payload: {
    name: string;
    tag: string;
    categoryId: number;
    branchId?: number;
    acquisitionDate: string;
    acquisitionCost: number;
    residualValue?: number;
  },
) {
  const response = await fetch(`${apiBaseUrl}/fixed-assets/assets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<FixedAssetRecord>(response, "Could not create asset");
}

export async function getFixedAssets(token: string) {
  const response = await fetch(`${apiBaseUrl}/fixed-assets/assets`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  return readApiResponse<FixedAssetRecord[]>(response, "Could not load fixed assets");
}

export async function runDepreciation(
  token: string,
  payload: { periodStart: string; periodEnd: string; book?: string },
) {
  const response = await fetch(`${apiBaseUrl}/depreciation/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<{ id: number; lines: DepreciationLineRecord[] }>(response, "Could not run depreciation");
}

export async function getLoans(token: string) {
  const response = await fetch(`${apiBaseUrl}/loans`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  return readApiResponse<LoanRecord[]>(response, "Could not load loans");
}

export async function createLoan(
  token: string,
  payload: {
    code: string;
    lender: string;
    type: "TERM" | "REVOLVING";
    principal: number;
    startDate: string;
    endDate?: string;
    baseRate?: number;
    spread?: number;
    scheduleType: "ANNUITY" | "INTEREST_ONLY" | "BALLOON" | "CUSTOM";
  },
) {
  const response = await fetch(`${apiBaseUrl}/loans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<LoanRecord>(response, "Could not create loan");
}

export async function createLoanPayment(
  token: string,
  payload: {
    loanId: number;
    paymentDate: string;
    principalPaid: number;
    interestPaid: number;
    feesPaid?: number;
  },
) {
  const response = await fetch(`${apiBaseUrl}/loans/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<LoanPaymentRecord>(response, "Could not record loan payment");
}

export async function getAccountingJournals(token: string) {
  const response = await fetch(`${apiBaseUrl}/accounting/journals`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<AccountingJournal[]>(response, "Could not load journals");
}

export async function getAccountingVouchers(token: string) {
  const response = await fetch(`${apiBaseUrl}/accounting/vouchers`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<AccountingVoucher[]>(response, "Could not load vouchers");
}

export async function createAccountingJournal(
  token: string,
  payload: {
    reference?: string;
    description?: string;
    date: string;
    type?: string;
    lines: Array<{
      accountId: number;
      branchId?: number;
      debit: number;
      credit: number;
      memo?: string;
    }>;
  },
) {
  const response = await fetch(`${apiBaseUrl}/accounting/journals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<AccountingJournal>(response, "Could not post journal");
}

export async function getJournalMetadata(token: string, legalEntityId: number) {
  const response = await fetch(`${apiBaseUrl}/journals/metadata/options?legalEntityId=${legalEntityId}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<JournalMetadataResponse>(response, "Could not load journal setup options");
}

export async function getJournalEntries(
  token: string,
  params?: {
    search?: string;
    status?: JournalStatus;
    journalType?: JournalType;
    sourceModule?: string;
    branchId?: number;
  },
) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.journalType) query.set("journalType", params.journalType);
  if (params?.sourceModule) query.set("sourceModule", params.sourceModule);
  if (params?.branchId) query.set("branchId", String(params.branchId));

  const response = await fetch(`${apiBaseUrl}/journals${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<JournalEntryRecord[]>(response, "Could not load journal entries");
}

export async function getJournalEntry(token: string, journalId: number) {
  const response = await fetch(`${apiBaseUrl}/journals/${journalId}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<JournalEntryRecord>(response, "Could not load the journal entry");
}

export async function createJournalDraft(token: string, payload: JournalEntryPayload) {
  const response = await fetch(`${apiBaseUrl}/journals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<JournalEntryRecord>(response, "Could not save the journal draft");
}

export async function updateJournalDraft(token: string, journalId: number, payload: Partial<JournalEntryPayload>) {
  const response = await fetch(`${apiBaseUrl}/journals/${journalId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<JournalEntryRecord>(response, "Could not update the journal draft");
}

export async function validateJournalEntry(token: string, journalId: number) {
  const response = await fetch(`${apiBaseUrl}/journals/${journalId}/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ strict: true }),
  });

  return readApiResponse<{
    valid: boolean;
    errors: string[];
    totalDebit: number;
    totalCredit: number;
  }>(response, "Could not validate the journal");
}

async function mutateJournalEntry<T>(
  token: string,
  journalId: number,
  action: string,
  payload?: Record<string, unknown>,
  fallbackMessage = "Could not update the journal",
) {
  const response = await fetch(`${apiBaseUrl}/journals/${journalId}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload ?? {}),
  });

  return readApiResponse<T>(response, fallbackMessage);
}

export function submitJournalEntry(token: string, journalId: number) {
  return mutateJournalEntry<JournalEntryRecord>(token, journalId, "submit", {}, "Could not submit the journal");
}

export function recallJournalEntry(token: string, journalId: number) {
  return mutateJournalEntry<JournalEntryRecord>(token, journalId, "recall", {}, "Could not recall the journal");
}

export function approveJournalEntry(token: string, journalId: number, comments?: string) {
  return mutateJournalEntry<JournalEntryRecord>(token, journalId, "approve", { comments }, "Could not approve the journal");
}

export function rejectJournalEntry(token: string, journalId: number, reason: string) {
  return mutateJournalEntry<JournalEntryRecord>(token, journalId, "reject", { reason }, "Could not reject the journal");
}

export function postJournalEntry(token: string, journalId: number) {
  return mutateJournalEntry<JournalEntryRecord>(token, journalId, "post", {}, "Could not post the journal to the general ledger");
}

export function reverseJournalEntry(token: string, journalId: number, reversalDate: string, reason: string) {
  return mutateJournalEntry<JournalEntryRecord>(
    token,
    journalId,
    "reverse",
    { reversalDate, reason },
    "Could not reverse the journal",
  );
}

export function cancelJournalEntry(token: string, journalId: number, reason: string) {
  return mutateJournalEntry<JournalEntryRecord>(token, journalId, "cancel", { reason }, "Could not cancel the journal");
}

export async function getPaymentVoucherMetadata(token: string, legalEntityId: number) {
  const response = await fetch(`${apiBaseUrl}/payment-vouchers/metadata/options?legalEntityId=${legalEntityId}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<PaymentVoucherMetadataResponse>(response, "Could not load payment voucher setup");
}

export async function getPaymentVouchers(
  token: string,
  params?: {
    search?: string;
    status?: PaymentVoucherStatus;
    paymentStatus?: PaymentExecutionStatus;
    voucherType?: PaymentVoucherType;
    branchId?: number;
  },
) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.paymentStatus) query.set("paymentStatus", params.paymentStatus);
  if (params?.voucherType) query.set("voucherType", params.voucherType);
  if (params?.branchId) query.set("branchId", String(params.branchId));

  const response = await fetch(`${apiBaseUrl}/payment-vouchers${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<PaymentVoucherRecord[]>(response, "Could not load payment vouchers");
}

export async function getPaymentVoucherApprovalQueue(token: string) {
  const response = await fetch(`${apiBaseUrl}/payment-vouchers/queue`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<PaymentVoucherRecord[]>(response, "Could not load payment approvals");
}

export async function getPaymentVoucher(token: string, voucherId: number) {
  const response = await fetch(`${apiBaseUrl}/payment-vouchers/${voucherId}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<PaymentVoucherRecord>(response, "Could not load the payment voucher");
}

export async function createPaymentVoucherDraft(token: string, payload: PaymentVoucherPayload) {
  const response = await fetch(`${apiBaseUrl}/payment-vouchers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<PaymentVoucherRecord>(response, "Could not save the payment voucher draft");
}

export async function updatePaymentVoucherDraft(
  token: string,
  voucherId: number,
  payload: Partial<PaymentVoucherPayload>,
) {
  const response = await fetch(`${apiBaseUrl}/payment-vouchers/${voucherId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<PaymentVoucherRecord>(response, "Could not update the payment voucher draft");
}

export async function validatePaymentVoucher(token: string, voucherId: number) {
  const response = await fetch(`${apiBaseUrl}/payment-vouchers/${voucherId}/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ requireAttachments: true }),
  });

  return readApiResponse<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    totals: {
      gross: number;
      tax: number;
      withholding: number;
      total: number;
      net: number;
    };
  }>(response, "Could not validate the payment voucher");
}

async function mutatePaymentVoucher<T>(
  token: string,
  voucherId: number,
  action: string,
  payload?: Record<string, unknown>,
  fallbackMessage = "Could not update the payment voucher",
) {
  const response = await fetch(`${apiBaseUrl}/payment-vouchers/${voucherId}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload ?? {}),
  });

  return readApiResponse<T>(response, fallbackMessage);
}

export function submitPaymentVoucher(token: string, voucherId: number) {
  return mutatePaymentVoucher<PaymentVoucherRecord>(token, voucherId, "submit", {}, "Could not submit the voucher");
}

export function recallPaymentVoucher(token: string, voucherId: number, reason?: string) {
  return mutatePaymentVoucher<PaymentVoucherRecord>(token, voucherId, "recall", { reason }, "Could not recall the voucher");
}

export function approvePaymentVoucher(token: string, voucherId: number, comments?: string) {
  return mutatePaymentVoucher<PaymentVoucherRecord>(token, voucherId, "approve", { comments }, "Could not approve the voucher");
}

export function rejectPaymentVoucher(token: string, voucherId: number, rejectionReason: string, comments?: string) {
  return mutatePaymentVoucher<PaymentVoucherRecord>(
    token,
    voucherId,
    "reject",
    { rejectionReason, comments },
    "Could not reject the voucher",
  );
}

export function returnPaymentVoucherForCorrection(token: string, voucherId: number, reason: string) {
  return mutatePaymentVoucher<PaymentVoucherRecord>(token, voucherId, "return", { reason }, "Could not return the voucher");
}

export function postPaymentVoucher(token: string, voucherId: number) {
  return mutatePaymentVoucher<PaymentVoucherRecord>(token, voucherId, "post", {}, "Could not post the voucher to GL");
}

export function initiateVoucherPayment(
  token: string,
  voucherId: number,
  payload: { paymentChannel?: string; providerName?: string; providerReference?: string },
) {
  return mutatePaymentVoucher<PaymentVoucherRecord>(
    token,
    voucherId,
    "initiate-payment",
    payload,
    "Could not initiate the payment",
  );
}

export function markPaymentVoucherPaid(
  token: string,
  voucherId: number,
  payload: { bankReference?: string; proofFileUrl?: string; comments?: string },
) {
  return mutatePaymentVoucher<PaymentVoucherRecord>(token, voucherId, "mark-paid", payload, "Could not mark the voucher as paid");
}

export function cancelPaymentVoucher(token: string, voucherId: number, reason: string) {
  return mutatePaymentVoucher<PaymentVoucherRecord>(token, voucherId, "cancel", { reason }, "Could not cancel the voucher");
}

export function addPaymentVoucherComment(token: string, voucherId: number, body: string, commentType = "INTERNAL") {
  return mutatePaymentVoucher<PaymentVoucherRecord>(token, voucherId, "comments", { body, commentType }, "Could not add comment");
}

export async function previewPaymentVoucher(token: string, voucherId: number) {
  const response = await fetch(`${apiBaseUrl}/payment-vouchers/${voucherId}/preview`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<PaymentVoucherRecord & { printTimestamp: string }>(response, "Could not preview the voucher");
}

export async function uploadPaymentVoucherAttachment(token: string, voucherId: number, file: File) {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${apiBaseUrl}/payment-vouchers/${voucherId}/attachments/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  return readApiResponse<PaymentVoucherRecord>(response, "Could not upload attachment");
}

export async function getPaymentVoucherTemplates(token: string) {
  const response = await fetch(`${apiBaseUrl}/payment-vouchers/templates/all`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<PaymentTemplateRecord[]>(response, "Could not load payment templates");
}

export async function createPaymentVoucherTemplate(
  token: string,
  payload: {
    name: string;
    voucherType: PaymentVoucherType;
    templateKind?: "STANDARD_CORPORATE" | "FINANCE_TREASURY" | "CLEAN_A4";
    legalEntityId?: number;
    branchId?: number;
    paymentMethod?: PaymentMethod;
    minAmount?: number;
    maxAmount?: number;
    requiresAttachment?: boolean;
    allowRecall?: boolean;
    postAfterFinalApproval?: boolean;
    allowPaymentExecution?: boolean;
    enableGateway?: boolean;
    defaultAccountId?: number;
    defaultNarration?: string;
    purposeTemplate?: string;
    approvalMatrix?: unknown;
  },
) {
  const response = await fetch(`${apiBaseUrl}/payment-vouchers/templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return readApiResponse<PaymentTemplateRecord>(response, "Could not create payment template");
}

export async function getTrialBalance(
  token: string,
  params?: { from?: string; to?: string; companyId?: number; branchId?: number },
) {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.companyId) query.set("companyId", String(params.companyId));
  if (params?.branchId) query.set("branchId", String(params.branchId));
  const response = await fetch(`${apiBaseUrl}/reports/trial-balance${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Trial balance request failed: ${response.status}`);
  }

  return response.json() as Promise<TrialBalanceResponse>;
}

export async function getFinancialStatement(
  token: string,
  statement: "profit-or-loss" | "financial-position" | "cash-flow" | "changes-in-equity" | "notes",
  params?: {
    from?: string;
    to?: string;
    compareFrom?: string;
    compareTo?: string;
    companyId?: number;
    branchId?: number;
  },
) {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.compareFrom) query.set("compareFrom", params.compareFrom);
  if (params?.compareTo) query.set("compareTo", params.compareTo);
  if (params?.companyId) query.set("companyId", String(params.companyId));
  if (params?.branchId) query.set("branchId", String(params.branchId));
  const response = await fetch(
    `${apiBaseUrl}/reports/financial-statements/${statement}${query.size ? `?${query.toString()}` : ""}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Financial statement request failed: ${response.status}`);
  }

  return response.json() as Promise<FinancialStatementResponse>;
}

export async function getRatioAnalysis(
  token: string,
  params?: {
    from?: string;
    to?: string;
    compareFrom?: string;
    compareTo?: string;
    companyId?: number;
    branchId?: number;
  },
) {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.compareFrom) query.set("compareFrom", params.compareFrom);
  if (params?.compareTo) query.set("compareTo", params.compareTo);
  if (params?.companyId) query.set("companyId", String(params.companyId));
  if (params?.branchId) query.set("branchId", String(params.branchId));
  const response = await fetch(`${apiBaseUrl}/reports/ratio-analysis${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Ratio analysis request failed: ${response.status}`);
  }

  return response.json() as Promise<RatioAnalysisResponse>;
}

export async function getAccountStatementSummary(
  token: string,
  params?: { from?: string; to?: string; companyId?: number; branchId?: number },
) {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.companyId) query.set("companyId", String(params.companyId));
  if (params?.branchId) query.set("branchId", String(params.branchId));
  const response = await fetch(`${apiBaseUrl}/reports/account-statement-summary${query.size ? `?${query.toString()}` : ""}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Account statement summary request failed: ${response.status}`);
  }

  return response.json() as Promise<AccountStatementSummaryResponse>;
}

export async function getAccountStatement(
  token: string,
  params: { accountId: number; from?: string; to?: string; companyId?: number; branchId?: number },
) {
  const query = new URLSearchParams({ accountId: String(params.accountId) });
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.companyId) query.set("companyId", String(params.companyId));
  if (params.branchId) query.set("branchId", String(params.branchId));
  const response = await fetch(`${apiBaseUrl}/reports/account-statement?${query.toString()}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Account statement request failed: ${response.status}`);
  }

  return response.json() as Promise<AccountStatementResponse>;
}

export async function downloadReportFile(
  token: string,
  report:
    | "trial-balance"
    | "account-statement-summary"
    | "account-statement"
    | "financial-statements/profit-or-loss"
    | "financial-statements/financial-position"
    | "financial-statements/cash-flow"
    | "financial-statements/changes-in-equity"
    | "financial-statements/notes"
    | "ratio-analysis",
  params: Record<string, string | number | undefined>,
  format: "csv" | "xlsx" | "pdf",
) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  query.set("format", format);

  const response = await fetch(`${apiBaseUrl}/reports/${report}?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
// ─── Notifications ────────────────────────────────────────────────────────────
export type NotificationRecord = {
  id: number;
  title: string;
  detail: string;
  channel: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
};

export async function getNotifications(token: string): Promise<NotificationRecord[]> {
  try {
    const response = await fetch(`${apiBaseUrl}/notifications`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!response.ok) return [];
    return readApiResponse<NotificationRecord[]>(response, "Could not load notifications");
  } catch {
    return [];
  }
}

// ─── Accounting Migration Import Functions ────────────────────────────────────

export async function importGLOpeningBalances(
  token: string,
  companyId: number,
  openingDate: string,
  reference: string,
  rows: Array<Record<string, unknown>>,
) {
  const response = await fetch(\/imports/gl-opening-balances, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: Bearer \ },
    credentials: "include",
    body: JSON.stringify({ companyId, openingDate, reference, rows }),
  });
  return readApiResponse<BulkImportResponse>(response, "Could not import GL opening balances");
}

export async function importAROpeningBalances(
  token: string,
  companyId: number,
  openingDate: string,
  rows: Array<Record<string, unknown>>,
) {
  const response = await fetch(\/imports/ar-opening-balances, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: Bearer \ },
    credentials: "include",
    body: JSON.stringify({ companyId, openingDate, rows }),
  });
  return readApiResponse<BulkImportResponse>(response, "Could not import AR opening balances");
}

export async function importAPOpeningBalances(
  token: string,
  companyId: number,
  openingDate: string,
  rows: Array<Record<string, unknown>>,
) {
  const response = await fetch(\/imports/ap-opening-balances, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: Bearer \ },
    credentials: "include",
    body: JSON.stringify({ companyId, openingDate, rows }),
  });
  return readApiResponse<BulkImportResponse>(response, "Could not import AP opening balances");
}

export async function importCustomerReceipts(
  token: string,
  companyId: number,
  rows: Array<Record<string, unknown>>,
) {
  const response = await fetch(\/imports/customer-receipts, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: Bearer \ },
    credentials: "include",
    body: JSON.stringify({ companyId, rows }),
  });
  return readApiResponse<BulkImportResponse>(response, "Could not import customer receipts");
}

export async function importSupplierPayments(
  token: string,
  companyId: number,
  rows: Array<Record<string, unknown>>,
) {
  const response = await fetch(\/imports/supplier-payments, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: Bearer \ },
    credentials: "include",
    body: JSON.stringify({ companyId, rows }),
  });
  return readApiResponse<BulkImportResponse>(response, "Could not import supplier payments");
}

export async function importFixedAssets(
  token: string,
  companyId: number,
  asOfDate: string,
  rows: Array<Record<string, unknown>>,
) {
  const response = await fetch(\/imports/fixed-assets, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: Bearer \ },
    credentials: "include",
    body: JSON.stringify({ companyId, asOfDate, rows }),
  });
  return readApiResponse<BulkImportResponse>(response, "Could not import fixed assets");
}

export async function importStockOpeningBalances(
  token: string,
  companyId: number,
  openingDate: string,
  rows: Array<Record<string, unknown>>,
) {
  const response = await fetch(\/imports/stock-opening-balances, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: Bearer \ },
    credentials: "include",
    body: JSON.stringify({ companyId, openingDate, rows }),
  });
  return readApiResponse<BulkImportResponse>(response, "Could not import stock opening balances");
}