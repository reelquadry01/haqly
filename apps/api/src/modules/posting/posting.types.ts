import { Prisma } from '@prisma/client';

export type PostingLinePattern =
  | 'SALES_INVOICE'
  | 'PURCHASE_BILL'
  | 'DEPRECIATION'
  | 'LOAN_DISBURSEMENT'
  | 'LOAN_REPAYMENT'
  | 'MANUAL_JOURNAL';

export type PostingContext = {
  module: string;
  transactionType: string;
  transactionSubtype?: string;
  triggeringEvent: string;
  postingDate: Date;
  sourceTable: string;
  sourceDocumentId: string;
  sourceDocumentNumber: string;
  referenceId?: string;
  sourceStatus: string;
  legalEntityId?: number;
  branchId?: number;
  departmentId?: number;
  productCategoryId?: number;
  partyName?: string;
  customerGroup?: string;
  vendorGroup?: string;
  taxCode?: string;
  currencyCode?: string;
  subledgerPartyId?: number;
  projectId?: number;
  projectCode?: string;
  costCenterId?: number;
  costCenterCode?: string;
  narration?: string;
  approvalReference?: string;
  userId?: number;
  correlationId?: string;
  idempotencyKey?: string;
  descriptionTemplateData?: Record<string, string | number>;
};

export type PostingAmounts = {
  baseAmount: number;
  taxAmount?: number;
  totalAmount: number;
  exchangeDifferenceAmount?: number;
  roundingAmount?: number;
  principalAmount?: number;
  interestAmount?: number;
  feeAmount?: number;
};

export type PostingRequest = {
  context: PostingContext;
  pattern: PostingLinePattern;
  amounts: PostingAmounts;
};

export type ResolvedPostingRule = Prisma.PostingRuleGetPayload<{
  include: {
    debitAccount: true;
    creditAccount: true;
    taxAccount: true;
    roundingAccount: true;
    exchangeGainAccount: true;
    exchangeLossAccount: true;
    suspenseAccount: true;
  };
}>;

export type GeneratedJournalLine = {
  accountId: number;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  branchId?: number;
  memo?: string;
};
