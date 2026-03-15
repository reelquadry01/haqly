-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('GENERAL', 'SALES', 'PURCHASE', 'CASH', 'BANK');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('PAYMENT', 'RECEIPT', 'CONTRA');

-- CreateEnum
CREATE TYPE "PaymentVoucherType" AS ENUM ('VENDOR_PAYMENT', 'EXPENSE_PAYMENT', 'STAFF_REIMBURSEMENT', 'ADVANCE_PAYMENT', 'PREPAYMENT', 'REFUND', 'TAX_REMITTANCE', 'INTERCOMPANY_PAYMENT', 'BANK_TRANSFER', 'CASH_PAYMENT');

-- CreateEnum
CREATE TYPE "PaymentVoucherSourceType" AS ENUM ('MANUAL', 'VENDOR_BILL', 'EXPENSE_CLAIM', 'PAYROLL', 'TAX', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentBeneficiaryType" AS ENUM ('VENDOR', 'EMPLOYEE', 'CUSTOMER', 'TAX_AUTHORITY', 'BANK', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'CARD', 'GATEWAY', 'WALLET');

-- CreateEnum
CREATE TYPE "PaymentVoucherStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'CANCELLED', 'POSTED', 'PAID', 'FAILED_PAYMENT', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentWorkflowStatus" AS ENUM ('AWAITING_SUBMISSION', 'AWAITING_LEVEL_1_APPROVAL', 'AWAITING_LEVEL_2_APPROVAL', 'AWAITING_FINAL_APPROVAL', 'APPROVED', 'REJECTED', 'RETURNED_FOR_CORRECTION');

-- CreateEnum
CREATE TYPE "PaymentExecutionStatus" AS ENUM ('NOT_PAID', 'PAYMENT_INITIATED', 'PAYMENT_PROCESSING', 'PAID', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentLineType" AS ENUM ('INVOICE_SETTLEMENT', 'EXPENSE', 'TAX', 'WITHHOLDING', 'ADVANCE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentApprovalAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED', 'RECALLED', 'DELEGATED', 'POSTED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentCommentType" AS ENUM ('INTERNAL', 'APPROVAL', 'REJECTION', 'TREASURY');

-- CreateEnum
CREATE TYPE "PaymentEventType" AS ENUM ('INITIATED', 'PROCESSING', 'CONFIRMED', 'FAILED', 'RETRIED', 'REVERSED', 'MANUAL_MARKED_PAID', 'VERIFIED');

-- CreateEnum
CREATE TYPE "PaymentTemplateKind" AS ENUM ('STANDARD_CORPORATE', 'FINANCE_TREASURY', 'CLEAN_A4');

-- CreateEnum
CREATE TYPE "CustomerReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GLJournalType" AS ENUM ('MANUAL', 'ADJUSTMENT', 'ACCRUAL', 'REVERSAL', 'OPENING_BALANCE', 'RECURRING', 'ALLOCATION', 'RECLASSIFICATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "GLJournalSourceType" AS ENUM ('MANUAL', 'SALES', 'PROCUREMENT', 'PAYROLL', 'ASSETS', 'INVENTORY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "GLSubledgerType" AS ENUM ('CUSTOMER', 'VENDOR', 'EMPLOYEE', 'BANK', 'ASSET');

-- CreateEnum
CREATE TYPE "GLJournalStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GLApprovalAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'RECALLED', 'ESCALATED', 'DELEGATED', 'POSTED', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'DISPOSED', 'IMPAIRED');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'DECLINING_BALANCE', 'UNITS_OF_PRODUCTION');

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('TERM', 'REVOLVING');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('ANNUITY', 'INTEREST_ONLY', 'BALLOON', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FinancialStatementCategory" AS ENUM ('REVENUE', 'COST_OF_SALES', 'OTHER_INCOME', 'OPERATING_EXPENSE', 'DEPRECIATION_AND_AMORTIZATION', 'FINANCE_INCOME', 'FINANCE_COST', 'INCOME_TAX', 'OTHER_COMPREHENSIVE_INCOME', 'ASSET_CURRENT', 'INVENTORY', 'RECEIVABLE', 'CASH_AND_EQUIVALENT', 'ASSET_NONCURRENT', 'LIABILITY_CURRENT', 'LIABILITY_NONCURRENT', 'EQUITY_SHARE_CAPITAL', 'EQUITY_RETAINED_EARNINGS', 'EQUITY_RESERVE', 'DIVIDEND');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT,
    "replacedByHash" TEXT,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "ipAddress" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "role" TEXT,
    "action" TEXT NOT NULL,
    "resourceId" TEXT,
    "entity" TEXT,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "meta" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "code" TEXT,
    "registrationNumber" TEXT,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "logoUrl" TEXT,
    "currencyId" INTEGER,
    "timezone" TEXT,
    "fiscalYearStartMonth" INTEGER DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "useBranches" BOOLEAN NOT NULL DEFAULT true,
    "useInventory" BOOLEAN NOT NULL DEFAULT true,
    "usePayroll" BOOLEAN NOT NULL DEFAULT false,
    "useDepartments" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxConfig" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxType" TEXT NOT NULL DEFAULT 'VAT',
    "rate" DECIMAL(10,4) NOT NULL,
    "isInclusive" BOOLEAN NOT NULL DEFAULT false,
    "recoverable" BOOLEAN NOT NULL DEFAULT false,
    "filingFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "companyId" INTEGER NOT NULL,
    "outputAccountId" INTEGER,
    "inputAccountId" INTEGER,
    "liabilityAccountId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberingSequence" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberingSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "financialStatementCategory" "FinancialStatementCategory",
    "description" TEXT,
    "parentId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowsPosting" BOOLEAN NOT NULL DEFAULT true,
    "allowsManualPosting" BOOLEAN NOT NULL DEFAULT true,
    "isControlAccount" BOOLEAN NOT NULL DEFAULT false,
    "controlSource" TEXT,
    "requiresSubledger" BOOLEAN NOT NULL DEFAULT false,
    "requiresDepartment" BOOLEAN NOT NULL DEFAULT false,
    "requiresCostCenter" BOOLEAN NOT NULL DEFAULT false,
    "requiresProject" BOOLEAN NOT NULL DEFAULT false,
    "requiresTax" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "JournalType" NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "branchId" INTEGER,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "memo" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" SERIAL NOT NULL,
    "type" "VoucherType" NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "payee" TEXT,
    "memo" TEXT,
    "journalId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" INTEGER,
    "fiscalYearId" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GLJournalHeader" (
    "id" SERIAL NOT NULL,
    "journalNumber" TEXT NOT NULL,
    "journalType" "GLJournalType" NOT NULL,
    "sourceType" "GLJournalSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceModule" TEXT,
    "sourceDocumentId" TEXT,
    "sourceDocumentNumber" TEXT,
    "legalEntityId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "costCenterId" INTEGER,
    "projectId" INTEGER,
    "journalDate" TIMESTAMP(3) NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "accountingPeriodId" INTEGER NOT NULL,
    "fiscalYearId" INTEGER,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6),
    "referenceNumber" TEXT,
    "externalReference" TEXT,
    "narration" TEXT NOT NULL,
    "description" TEXT,
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "status" "GLJournalStatus" NOT NULL DEFAULT 'DRAFT',
    "workflowStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvalLevel" INTEGER NOT NULL DEFAULT 0,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedBy" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "approvedBy" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "postedBy" INTEGER,
    "postedAt" TIMESTAMP(3),
    "reversedBy" INTEGER,
    "reversedAt" TIMESTAMP(3),
    "reversalOfJournalId" INTEGER,
    "reversalReason" TEXT,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "isAutoReversing" BOOLEAN NOT NULL DEFAULT false,
    "autoReverseDate" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringTemplateId" INTEGER,
    "isIntercompany" BOOLEAN NOT NULL DEFAULT false,
    "intercompanyReference" TEXT,
    "idempotencyKey" TEXT,
    "totalDebit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "postedJournalEntryId" INTEGER,

    CONSTRAINT "GLJournalHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GLJournalLine" (
    "id" SERIAL NOT NULL,
    "journalId" INTEGER NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "subledgerType" "GLSubledgerType",
    "subledgerId" TEXT,
    "debitAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "baseCurrencyDebit" DECIMAL(18,2),
    "baseCurrencyCredit" DECIMAL(18,2),
    "transactionCurrencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6),
    "taxCodeId" INTEGER,
    "taxAmount" DECIMAL(18,2),
    "branchId" INTEGER,
    "departmentId" INTEGER,
    "costCenterId" INTEGER,
    "projectId" INTEGER,
    "productId" INTEGER,
    "itemId" TEXT,
    "warehouseId" INTEGER,
    "quantity" DECIMAL(18,3),
    "unitOfMeasure" TEXT,
    "lineNarration" TEXT,
    "reference1" TEXT,
    "reference2" TEXT,
    "dueDate" TIMESTAMP(3),
    "partnerName" TEXT,
    "partnerCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GLJournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GLJournalAttachment" (
    "id" SERIAL NOT NULL,
    "journalId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedBy" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GLJournalAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GLJournalApprovalHistory" (
    "id" SERIAL NOT NULL,
    "journalId" INTEGER NOT NULL,
    "action" "GLApprovalAction" NOT NULL,
    "approvalLevel" INTEGER NOT NULL DEFAULT 0,
    "actorUserId" INTEGER,
    "actorName" TEXT,
    "comments" TEXT,
    "rejectionReason" TEXT,
    "delegatedTo" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GLJournalApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GLJournalAuditLog" (
    "id" SERIAL NOT NULL,
    "journalId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorName" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GLJournalAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GLJournalStatusHistory" (
    "id" SERIAL NOT NULL,
    "journalId" INTEGER NOT NULL,
    "fromStatus" "GLJournalStatus",
    "toStatus" "GLJournalStatus" NOT NULL,
    "changedBy" INTEGER,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GLJournalStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GLRecurringJournalTemplate" (
    "id" SERIAL NOT NULL,
    "templateName" TEXT NOT NULL,
    "journalType" "GLJournalType" NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "legalEntityId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "costCenterId" INTEGER,
    "projectId" INTEGER,
    "currencyCode" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "narrationTemplate" TEXT NOT NULL,
    "description" TEXT,
    "nextRunDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GLRecurringJournalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GLRecurringJournalTemplateLine" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "subledgerType" "GLSubledgerType",
    "subledgerId" TEXT,
    "debitAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "transactionCurrencyCode" TEXT NOT NULL,
    "taxCodeId" INTEGER,
    "branchId" INTEGER,
    "departmentId" INTEGER,
    "costCenterId" INTEGER,
    "projectId" INTEGER,
    "productId" INTEGER,
    "warehouseId" INTEGER,
    "quantity" DECIMAL(18,3),
    "unitOfMeasure" TEXT,
    "lineNarration" TEXT,
    "dueDate" TIMESTAMP(3),
    "partnerName" TEXT,
    "partnerCode" TEXT,

    CONSTRAINT "GLRecurringJournalTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostingRule" (
    "id" SERIAL NOT NULL,
    "module" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "transactionSubtype" TEXT,
    "legalEntityId" INTEGER,
    "branchId" INTEGER,
    "departmentId" INTEGER,
    "productCategoryId" INTEGER,
    "customerGroup" TEXT,
    "vendorGroup" TEXT,
    "taxCode" TEXT,
    "currencyCode" TEXT,
    "conditionExpression" TEXT,
    "debitAccountId" INTEGER NOT NULL,
    "creditAccountId" INTEGER NOT NULL,
    "taxAccountId" INTEGER,
    "roundingAccountId" INTEGER,
    "exchangeGainAccountId" INTEGER,
    "exchangeLossAccountId" INTEGER,
    "suspenseAccountId" INTEGER,
    "postingDescriptionTemplate" TEXT NOT NULL,
    "requiresSubledger" BOOLEAN NOT NULL DEFAULT false,
    "requiresCostCenter" BOOLEAN NOT NULL DEFAULT false,
    "requiresProject" BOOLEAN NOT NULL DEFAULT false,
    "requiresBranch" BOOLEAN NOT NULL DEFAULT false,
    "requiresTax" BOOLEAN NOT NULL DEFAULT false,
    "effectiveStartDate" TIMESTAMP(3) NOT NULL,
    "effectiveEndDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostingAudit" (
    "id" SERIAL NOT NULL,
    "journalEntryId" INTEGER,
    "postingRuleId" INTEGER,
    "sourceModule" TEXT NOT NULL,
    "sourceTable" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "sourceDocumentNumber" TEXT NOT NULL,
    "referenceId" TEXT,
    "partyName" TEXT,
    "triggeringEvent" TEXT NOT NULL,
    "userId" INTEGER,
    "approvalReference" TEXT,
    "postingTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period" TEXT,
    "branchId" INTEGER,
    "legalEntityId" INTEGER,
    "departmentId" INTEGER,
    "costCenterCode" TEXT,
    "projectCode" TEXT,
    "taxCode" TEXT,
    "currencyCode" TEXT,
    "narration" TEXT,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reversalOfAuditId" INTEGER,
    "ruleSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostingAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "accountName" TEXT,
    "number" TEXT,
    "bankName" TEXT,
    "companyId" INTEGER,
    "branchId" INTEGER,
    "currencyId" INTEGER,
    "glAccountId" INTEGER,
    "providerName" TEXT,
    "providerCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "gatewayConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "customerType" TEXT NOT NULL DEFAULT 'BUSINESS',
    "onboardingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "contactPerson" TEXT,
    "industry" TEXT,
    "taxId" TEXT,
    "creditLimit" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APPaymentVoucherHeader" (
    "id" SERIAL NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "voucherType" "PaymentVoucherType" NOT NULL,
    "sourceType" "PaymentVoucherSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceModule" TEXT,
    "sourceDocumentId" TEXT,
    "sourceDocumentNumber" TEXT,
    "legalEntityId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "costCenterId" INTEGER,
    "projectId" INTEGER,
    "beneficiaryType" "PaymentBeneficiaryType" NOT NULL,
    "beneficiaryId" TEXT,
    "beneficiaryName" TEXT NOT NULL,
    "beneficiaryCode" TEXT,
    "supplierId" INTEGER,
    "payableAccountId" INTEGER,
    "bankAccountId" INTEGER,
    "cashAccountId" INTEGER,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentChannel" TEXT,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6),
    "voucherDate" TIMESTAMP(3) NOT NULL,
    "requestedPaymentDate" TIMESTAMP(3) NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "accountingPeriodId" INTEGER NOT NULL,
    "fiscalYearId" INTEGER,
    "referenceNumber" TEXT,
    "externalReference" TEXT,
    "invoiceReference" TEXT,
    "narration" TEXT NOT NULL,
    "purposeOfPayment" TEXT NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2),
    "withholdingTaxAmount" DECIMAL(18,2),
    "netPaymentAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PaymentVoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "workflowStatus" "PaymentWorkflowStatus" NOT NULL DEFAULT 'AWAITING_SUBMISSION',
    "paymentStatus" "PaymentExecutionStatus" NOT NULL DEFAULT 'NOT_PAID',
    "approvalLevel" INTEGER NOT NULL DEFAULT 0,
    "currentApproverId" INTEGER,
    "finalApproverId" INTEGER,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedBy" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "approvedBy" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" INTEGER,
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "postedBy" INTEGER,
    "postedAt" TIMESTAMP(3),
    "paidBy" INTEGER,
    "paidAt" TIMESTAMP(3),
    "cancelledBy" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "isPostedToGL" BOOLEAN NOT NULL DEFAULT false,
    "glJournalId" INTEGER,
    "templateId" INTEGER,
    "gatewayTransactionReference" TEXT,
    "bankPaymentReference" TEXT,
    "idempotencyKey" TEXT,
    "approvalChain" JSONB,
    "paymentMetadata" JSONB,

    CONSTRAINT "APPaymentVoucherHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APPaymentVoucherLine" (
    "id" SERIAL NOT NULL,
    "paymentVoucherId" INTEGER NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "lineType" "PaymentLineType" NOT NULL,
    "accountId" INTEGER NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "subledgerType" TEXT,
    "subledgerId" TEXT,
    "sourceInvoiceId" TEXT,
    "sourceInvoiceNumber" TEXT,
    "sourceExpenseClaimId" TEXT,
    "description" TEXT NOT NULL,
    "grossAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxCodeId" INTEGER,
    "taxAmount" DECIMAL(18,2),
    "withholdingTaxCodeId" INTEGER,
    "withholdingTaxAmount" DECIMAL(18,2),
    "netAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "branchId" INTEGER,
    "departmentId" INTEGER,
    "costCenterId" INTEGER,
    "projectId" INTEGER,
    "dueDate" TIMESTAMP(3),
    "lineStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APPaymentVoucherLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APPaymentVoucherAttachment" (
    "id" SERIAL NOT NULL,
    "paymentVoucherId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedBy" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APPaymentVoucherAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APPaymentVoucherComment" (
    "id" SERIAL NOT NULL,
    "paymentVoucherId" INTEGER NOT NULL,
    "commentType" "PaymentCommentType" NOT NULL DEFAULT 'INTERNAL',
    "body" TEXT NOT NULL,
    "authorUserId" INTEGER,
    "authorName" TEXT,
    "taggedUsers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APPaymentVoucherComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APPaymentVoucherApprovalHistory" (
    "id" SERIAL NOT NULL,
    "paymentVoucherId" INTEGER NOT NULL,
    "action" "PaymentApprovalAction" NOT NULL,
    "approvalLevel" INTEGER NOT NULL DEFAULT 0,
    "actorUserId" INTEGER,
    "actorName" TEXT,
    "comments" TEXT,
    "rejectionReason" TEXT,
    "delegatedTo" TEXT,
    "assignedRole" TEXT,
    "assignedUserId" INTEGER,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APPaymentVoucherApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APPaymentVoucherAuditLog" (
    "id" SERIAL NOT NULL,
    "paymentVoucherId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorName" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APPaymentVoucherAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APPaymentVoucherStatusHistory" (
    "id" SERIAL NOT NULL,
    "paymentVoucherId" INTEGER NOT NULL,
    "fromStatus" "PaymentVoucherStatus",
    "toStatus" "PaymentVoucherStatus" NOT NULL,
    "fromWorkflowStatus" "PaymentWorkflowStatus",
    "toWorkflowStatus" "PaymentWorkflowStatus",
    "fromPaymentStatus" "PaymentExecutionStatus",
    "toPaymentStatus" "PaymentExecutionStatus",
    "changedBy" INTEGER,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APPaymentVoucherStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APPaymentVoucherPaymentEvent" (
    "id" SERIAL NOT NULL,
    "paymentVoucherId" INTEGER NOT NULL,
    "eventType" "PaymentEventType" NOT NULL,
    "paymentChannel" TEXT,
    "providerName" TEXT,
    "providerReference" TEXT,
    "providerStatus" TEXT,
    "providerMessage" TEXT,
    "initiatedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "bankReference" TEXT,
    "proofFileUrl" TEXT,
    "rawResponseJson" JSONB,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APPaymentVoucherPaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APPaymentTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "voucherType" "PaymentVoucherType" NOT NULL,
    "templateKind" "PaymentTemplateKind" NOT NULL DEFAULT 'STANDARD_CORPORATE',
    "legalEntityId" INTEGER,
    "branchId" INTEGER,
    "paymentMethod" "PaymentMethod",
    "minAmount" DECIMAL(18,2),
    "maxAmount" DECIMAL(18,2),
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "allowRecall" BOOLEAN NOT NULL DEFAULT true,
    "postAfterFinalApproval" BOOLEAN NOT NULL DEFAULT true,
    "allowPaymentExecution" BOOLEAN NOT NULL DEFAULT true,
    "enableGateway" BOOLEAN NOT NULL DEFAULT false,
    "defaultAccountId" INTEGER,
    "defaultNarration" TEXT,
    "purposeTemplate" TEXT,
    "approvalMatrix" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APPaymentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APPaymentGatewayLog" (
    "id" SERIAL NOT NULL,
    "paymentVoucherId" INTEGER NOT NULL,
    "bankAccountId" INTEGER,
    "providerName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "providerStatus" TEXT,
    "providerMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APPaymentGatewayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" SERIAL NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "customerId" INTEGER,
    "supplierId" INTEGER,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "categoryId" INTEGER,
    "uomId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "direction" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoice" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "legalEntityId" INTEGER,
    "customerId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReceiptHeader" (
    "id" SERIAL NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "legalEntityId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "bankAccountId" INTEGER,
    "cashAccountId" INTEGER,
    "receivableAccountId" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6),
    "amount" DECIMAL(18,2) NOT NULL,
    "bankReference" TEXT,
    "externalReference" TEXT,
    "narration" TEXT NOT NULL,
    "remarks" TEXT,
    "status" "CustomerReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postedBy" INTEGER,
    "postedAt" TIMESTAMP(3),
    "glJournalId" INTEGER,

    CONSTRAINT "CustomerReceiptHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReceiptLine" (
    "id" SERIAL NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "invoiceId" INTEGER,
    "description" TEXT NOT NULL,
    "appliedAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoiceItem" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(10,4),

    CONSTRAINT "SalesInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseBill" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "legalEntityId" INTEGER,
    "supplierId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseBillItem" (
    "id" SERIAL NOT NULL,
    "billId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(10,4),

    CONSTRAINT "PurchaseBillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "usefulLifeMonths" INTEGER NOT NULL,
    "residualRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "glAssetAccountId" INTEGER,
    "glAccumDepAccountId" INTEGER,
    "glExpenseAccountId" INTEGER,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" SERIAL NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "branchId" INTEGER,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "acquisitionCost" DECIMAL(18,2) NOT NULL,
    "residualValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "depreciationStart" TIMESTAMP(3),
    "disposalDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationPolicy" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "method" "DepreciationMethod" NOT NULL,
    "prorate" BOOLEAN NOT NULL DEFAULT true,
    "midMonth" BOOLEAN NOT NULL DEFAULT false,
    "companyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepreciationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationRun" (
    "id" SERIAL NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "book" TEXT NOT NULL DEFAULT 'book',
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepreciationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationLine" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "accumulated" DECIMAL(18,2) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepreciationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "type" "LoanType" NOT NULL DEFAULT 'TERM',
    "principal" DECIMAL(18,2) NOT NULL,
    "currencyId" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "rateType" TEXT NOT NULL,
    "baseRate" DECIMAL(9,4),
    "spread" DECIMAL(9,4),
    "scheduleType" "ScheduleType" NOT NULL DEFAULT 'ANNUITY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRate" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "effective" TIMESTAMP(3) NOT NULL,
    "rate" DECIMAL(9,4) NOT NULL,

    CONSTRAINT "LoanRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanSchedule" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "installment" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalDue" DECIMAL(18,2) NOT NULL,
    "interestDue" DECIMAL(18,2) NOT NULL,
    "feesDue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "LoanSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanPayment" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "scheduleId" INTEGER,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "principalPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interestPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "feesPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "memo" TEXT,

    CONSTRAINT "LoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "templateId" INTEGER,
    "channel" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAttachment" (
    "id" SERIAL NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "entity" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "mfaAdmins" BOOLEAN NOT NULL DEFAULT false,
    "mfaApprovers" BOOLEAN NOT NULL DEFAULT false,
    "sessionTimeout" INTEGER NOT NULL DEFAULT 30,
    "failedAttempts" INTEGER NOT NULL DEFAULT 5,
    "emailApprovals" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAlerts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "module" TEXT NOT NULL,
    "transaction" TEXT NOT NULL,
    "approvers" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "idx_refresh_token_user_expiry" ON "RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "idx_refresh_token_family" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "idx_login_attempt_user_time" ON "LoginAttempt"("userId", "attemptedAt");

-- CreateIndex
CREATE INDEX "idx_login_attempt_ip_time" ON "LoginAttempt"("ipAddress", "attemptedAt");

-- CreateIndex
CREATE INDEX "idx_audit_log_user_time" ON "AuditLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "idx_audit_log_action_time" ON "AuditLog"("action", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_companyId_name_key" ON "FiscalYear"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_companyId_code_key" ON "CostCenter"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Project_companyId_code_key" ON "Project"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TaxConfig_companyId_code_key" ON "TaxConfig"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Account_code_key" ON "Account"("code");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reference_key" ON "JournalEntry"("reference");

-- CreateIndex
CREATE INDEX "idx_journal_line_entry" ON "JournalLine"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_reference_key" ON "Voucher"("reference");

-- CreateIndex
CREATE INDEX "idx_accounting_period_company_dates" ON "AccountingPeriod"("companyId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "GLJournalHeader_journalNumber_key" ON "GLJournalHeader"("journalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GLJournalHeader_idempotencyKey_key" ON "GLJournalHeader"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "GLJournalHeader_postedJournalEntryId_key" ON "GLJournalHeader"("postedJournalEntryId");

-- CreateIndex
CREATE INDEX "idx_gl_journal_scope_dates" ON "GLJournalHeader"("legalEntityId", "branchId", "journalDate");

-- CreateIndex
CREATE INDEX "idx_gl_journal_status_type" ON "GLJournalHeader"("status", "journalType", "sourceType");

-- CreateIndex
CREATE INDEX "idx_gl_journal_source" ON "GLJournalHeader"("sourceModule", "sourceDocumentId");

-- CreateIndex
CREATE INDEX "idx_gl_journal_line_account" ON "GLJournalLine"("accountId");

-- CreateIndex
CREATE INDEX "idx_gl_journal_line_dimensions" ON "GLJournalLine"("branchId", "departmentId", "costCenterId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "GLJournalLine_journalId_lineNumber_key" ON "GLJournalLine"("journalId", "lineNumber");

-- CreateIndex
CREATE INDEX "idx_gl_journal_approval_history" ON "GLJournalApprovalHistory"("journalId", "actedAt");

-- CreateIndex
CREATE INDEX "idx_gl_journal_audit_log" ON "GLJournalAuditLog"("journalId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_gl_journal_status_history" ON "GLJournalStatusHistory"("journalId", "changedAt");

-- CreateIndex
CREATE INDEX "idx_gl_recurring_template_scope" ON "GLRecurringJournalTemplate"("legalEntityId", "branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "GLRecurringJournalTemplateLine_templateId_lineNumber_key" ON "GLRecurringJournalTemplateLine"("templateId", "lineNumber");

-- CreateIndex
CREATE INDEX "idx_posting_rule_event" ON "PostingRule"("module", "transactionType", "transactionSubtype", "status");

-- CreateIndex
CREATE INDEX "idx_posting_rule_scope" ON "PostingRule"("legalEntityId", "branchId", "departmentId");

-- CreateIndex
CREATE INDEX "idx_posting_rule_dimensions" ON "PostingRule"("productCategoryId", "customerGroup", "vendorGroup", "taxCode");

-- CreateIndex
CREATE UNIQUE INDEX "PostingAudit_journalEntryId_key" ON "PostingAudit"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "PostingAudit_idempotencyKey_key" ON "PostingAudit"("idempotencyKey");

-- CreateIndex
CREATE INDEX "idx_posting_audit_source" ON "PostingAudit"("sourceModule", "sourceTable", "sourceDocumentId");

-- CreateIndex
CREATE INDEX "idx_posting_audit_timestamp" ON "PostingAudit"("postingTimestamp");

-- CreateIndex
CREATE INDEX "idx_customer_company_name" ON "Customer"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customer_company_email" ON "Customer"("companyId", "email");

-- CreateIndex
CREATE INDEX "idx_supplier_company_name" ON "Supplier"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_supplier_company_email" ON "Supplier"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "APPaymentVoucherHeader_voucherNumber_key" ON "APPaymentVoucherHeader"("voucherNumber");

-- CreateIndex
CREATE UNIQUE INDEX "APPaymentVoucherHeader_glJournalId_key" ON "APPaymentVoucherHeader"("glJournalId");

-- CreateIndex
CREATE UNIQUE INDEX "APPaymentVoucherHeader_idempotencyKey_key" ON "APPaymentVoucherHeader"("idempotencyKey");

-- CreateIndex
CREATE INDEX "idx_ap_payment_voucher_scope_dates" ON "APPaymentVoucherHeader"("legalEntityId", "branchId", "voucherDate");

-- CreateIndex
CREATE INDEX "idx_ap_payment_voucher_status" ON "APPaymentVoucherHeader"("status", "workflowStatus", "paymentStatus");

-- CreateIndex
CREATE INDEX "idx_ap_payment_voucher_beneficiary" ON "APPaymentVoucherHeader"("beneficiaryType", "beneficiaryId");

-- CreateIndex
CREATE INDEX "idx_ap_payment_voucher_source" ON "APPaymentVoucherHeader"("sourceModule", "sourceDocumentId");

-- CreateIndex
CREATE INDEX "idx_ap_payment_voucher_line_account" ON "APPaymentVoucherLine"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "APPaymentVoucherLine_paymentVoucherId_lineNumber_key" ON "APPaymentVoucherLine"("paymentVoucherId", "lineNumber");

-- CreateIndex
CREATE INDEX "idx_ap_payment_voucher_attachment" ON "APPaymentVoucherAttachment"("paymentVoucherId", "uploadedAt");

-- CreateIndex
CREATE INDEX "idx_ap_payment_voucher_comment" ON "APPaymentVoucherComment"("paymentVoucherId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_ap_payment_voucher_approval_history" ON "APPaymentVoucherApprovalHistory"("paymentVoucherId", "actedAt");

-- CreateIndex
CREATE INDEX "idx_ap_payment_voucher_audit_log" ON "APPaymentVoucherAuditLog"("paymentVoucherId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_ap_payment_voucher_status_history" ON "APPaymentVoucherStatusHistory"("paymentVoucherId", "changedAt");

-- CreateIndex
CREATE INDEX "idx_ap_payment_voucher_payment_event" ON "APPaymentVoucherPaymentEvent"("paymentVoucherId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_ap_payment_template_match" ON "APPaymentTemplate"("voucherType", "paymentMethod", "isActive");

-- CreateIndex
CREATE INDEX "idx_ap_payment_gateway_log" ON "APPaymentGatewayLog"("paymentVoucherId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_product_company_name" ON "Product"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_sku_key" ON "Product"("companyId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_number_key" ON "SalesInvoice"("number");

-- CreateIndex
CREATE INDEX "idx_sales_invoice_company_date" ON "SalesInvoice"("legalEntityId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceiptHeader_receiptNumber_key" ON "CustomerReceiptHeader"("receiptNumber");

-- CreateIndex
CREATE INDEX "idx_customer_receipt_scope_date" ON "CustomerReceiptHeader"("legalEntityId", "branchId", "paymentDate");

-- CreateIndex
CREATE INDEX "idx_customer_receipt_customer_status" ON "CustomerReceiptHeader"("customerId", "status");

-- CreateIndex
CREATE INDEX "idx_customer_receipt_line_invoice" ON "CustomerReceiptLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceiptLine_receiptId_lineNumber_key" ON "CustomerReceiptLine"("receiptId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseBill_number_key" ON "PurchaseBill"("number");

-- CreateIndex
CREATE INDEX "idx_purchase_bill_company_date" ON "PurchaseBill"("legalEntityId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_tag_key" ON "Asset"("tag");

-- CreateIndex
CREATE INDEX "idx_depr_line_asset" ON "DepreciationLine"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_code_key" ON "Loan"("code");

-- CreateIndex
CREATE INDEX "idx_loan_schedule_loan" ON "LoanSchedule"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_code_key" ON "NotificationTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");

-- CreateIndex
CREATE INDEX "idx_approval_rule_company" ON "ApprovalRule"("companyId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxConfig" ADD CONSTRAINT "TaxConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxConfig" ADD CONSTRAINT "TaxConfig_outputAccountId_fkey" FOREIGN KEY ("outputAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxConfig" ADD CONSTRAINT "TaxConfig_inputAccountId_fkey" FOREIGN KEY ("inputAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxConfig" ADD CONSTRAINT "TaxConfig_liabilityAccountId_fkey" FOREIGN KEY ("liabilityAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberingSequence" ADD CONSTRAINT "NumberingSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalHeader" ADD CONSTRAINT "GLJournalHeader_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalHeader" ADD CONSTRAINT "GLJournalHeader_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalHeader" ADD CONSTRAINT "GLJournalHeader_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalHeader" ADD CONSTRAINT "GLJournalHeader_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalHeader" ADD CONSTRAINT "GLJournalHeader_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalHeader" ADD CONSTRAINT "GLJournalHeader_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalHeader" ADD CONSTRAINT "GLJournalHeader_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalHeader" ADD CONSTRAINT "GLJournalHeader_reversalOfJournalId_fkey" FOREIGN KEY ("reversalOfJournalId") REFERENCES "GLJournalHeader"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalHeader" ADD CONSTRAINT "GLJournalHeader_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "GLRecurringJournalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalHeader" ADD CONSTRAINT "GLJournalHeader_postedJournalEntryId_fkey" FOREIGN KEY ("postedJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalLine" ADD CONSTRAINT "GLJournalLine_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "GLJournalHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalLine" ADD CONSTRAINT "GLJournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalLine" ADD CONSTRAINT "GLJournalLine_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalLine" ADD CONSTRAINT "GLJournalLine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalLine" ADD CONSTRAINT "GLJournalLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalLine" ADD CONSTRAINT "GLJournalLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalLine" ADD CONSTRAINT "GLJournalLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalLine" ADD CONSTRAINT "GLJournalLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalLine" ADD CONSTRAINT "GLJournalLine_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalAttachment" ADD CONSTRAINT "GLJournalAttachment_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "GLJournalHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalApprovalHistory" ADD CONSTRAINT "GLJournalApprovalHistory_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "GLJournalHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalAuditLog" ADD CONSTRAINT "GLJournalAuditLog_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "GLJournalHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLJournalStatusHistory" ADD CONSTRAINT "GLJournalStatusHistory_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "GLJournalHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplate" ADD CONSTRAINT "GLRecurringJournalTemplate_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplate" ADD CONSTRAINT "GLRecurringJournalTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplate" ADD CONSTRAINT "GLRecurringJournalTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplate" ADD CONSTRAINT "GLRecurringJournalTemplate_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplate" ADD CONSTRAINT "GLRecurringJournalTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplateLine" ADD CONSTRAINT "GLRecurringJournalTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "GLRecurringJournalTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplateLine" ADD CONSTRAINT "GLRecurringJournalTemplateLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplateLine" ADD CONSTRAINT "GLRecurringJournalTemplateLine_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplateLine" ADD CONSTRAINT "GLRecurringJournalTemplateLine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplateLine" ADD CONSTRAINT "GLRecurringJournalTemplateLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplateLine" ADD CONSTRAINT "GLRecurringJournalTemplateLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplateLine" ADD CONSTRAINT "GLRecurringJournalTemplateLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplateLine" ADD CONSTRAINT "GLRecurringJournalTemplateLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLRecurringJournalTemplateLine" ADD CONSTRAINT "GLRecurringJournalTemplateLine_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_taxAccountId_fkey" FOREIGN KEY ("taxAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_roundingAccountId_fkey" FOREIGN KEY ("roundingAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_exchangeGainAccountId_fkey" FOREIGN KEY ("exchangeGainAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_exchangeLossAccountId_fkey" FOREIGN KEY ("exchangeLossAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_suspenseAccountId_fkey" FOREIGN KEY ("suspenseAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_productCategoryId_fkey" FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingAudit" ADD CONSTRAINT "PostingAudit_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingAudit" ADD CONSTRAINT "PostingAudit_postingRuleId_fkey" FOREIGN KEY ("postingRuleId") REFERENCES "PostingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingAudit" ADD CONSTRAINT "PostingAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingAudit" ADD CONSTRAINT "PostingAudit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingAudit" ADD CONSTRAINT "PostingAudit_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingAudit" ADD CONSTRAINT "PostingAudit_reversalOfAuditId_fkey" FOREIGN KEY ("reversalOfAuditId") REFERENCES "PostingAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_payableAccountId_fkey" FOREIGN KEY ("payableAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_glJournalId_fkey" FOREIGN KEY ("glJournalId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherHeader" ADD CONSTRAINT "APPaymentVoucherHeader_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "APPaymentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherLine" ADD CONSTRAINT "APPaymentVoucherLine_paymentVoucherId_fkey" FOREIGN KEY ("paymentVoucherId") REFERENCES "APPaymentVoucherHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherLine" ADD CONSTRAINT "APPaymentVoucherLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherLine" ADD CONSTRAINT "APPaymentVoucherLine_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherLine" ADD CONSTRAINT "APPaymentVoucherLine_withholdingTaxCodeId_fkey" FOREIGN KEY ("withholdingTaxCodeId") REFERENCES "TaxConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherLine" ADD CONSTRAINT "APPaymentVoucherLine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherLine" ADD CONSTRAINT "APPaymentVoucherLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherLine" ADD CONSTRAINT "APPaymentVoucherLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherLine" ADD CONSTRAINT "APPaymentVoucherLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherAttachment" ADD CONSTRAINT "APPaymentVoucherAttachment_paymentVoucherId_fkey" FOREIGN KEY ("paymentVoucherId") REFERENCES "APPaymentVoucherHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherComment" ADD CONSTRAINT "APPaymentVoucherComment_paymentVoucherId_fkey" FOREIGN KEY ("paymentVoucherId") REFERENCES "APPaymentVoucherHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherApprovalHistory" ADD CONSTRAINT "APPaymentVoucherApprovalHistory_paymentVoucherId_fkey" FOREIGN KEY ("paymentVoucherId") REFERENCES "APPaymentVoucherHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherAuditLog" ADD CONSTRAINT "APPaymentVoucherAuditLog_paymentVoucherId_fkey" FOREIGN KEY ("paymentVoucherId") REFERENCES "APPaymentVoucherHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherStatusHistory" ADD CONSTRAINT "APPaymentVoucherStatusHistory_paymentVoucherId_fkey" FOREIGN KEY ("paymentVoucherId") REFERENCES "APPaymentVoucherHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentVoucherPaymentEvent" ADD CONSTRAINT "APPaymentVoucherPaymentEvent_paymentVoucherId_fkey" FOREIGN KEY ("paymentVoucherId") REFERENCES "APPaymentVoucherHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentTemplate" ADD CONSTRAINT "APPaymentTemplate_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentTemplate" ADD CONSTRAINT "APPaymentTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentTemplate" ADD CONSTRAINT "APPaymentTemplate_defaultAccountId_fkey" FOREIGN KEY ("defaultAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentGatewayLog" ADD CONSTRAINT "APPaymentGatewayLog_paymentVoucherId_fkey" FOREIGN KEY ("paymentVoucherId") REFERENCES "APPaymentVoucherHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APPaymentGatewayLog" ADD CONSTRAINT "APPaymentGatewayLog_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptHeader" ADD CONSTRAINT "CustomerReceiptHeader_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptHeader" ADD CONSTRAINT "CustomerReceiptHeader_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptHeader" ADD CONSTRAINT "CustomerReceiptHeader_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptHeader" ADD CONSTRAINT "CustomerReceiptHeader_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptHeader" ADD CONSTRAINT "CustomerReceiptHeader_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptHeader" ADD CONSTRAINT "CustomerReceiptHeader_receivableAccountId_fkey" FOREIGN KEY ("receivableAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptHeader" ADD CONSTRAINT "CustomerReceiptHeader_glJournalId_fkey" FOREIGN KEY ("glJournalId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptLine" ADD CONSTRAINT "CustomerReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "CustomerReceiptHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptLine" ADD CONSTRAINT "CustomerReceiptLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceItem" ADD CONSTRAINT "SalesInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceItem" ADD CONSTRAINT "SalesInvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseBillItem" ADD CONSTRAINT "PurchaseBillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseBillItem" ADD CONSTRAINT "PurchaseBillItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationLine" ADD CONSTRAINT "DepreciationLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DepreciationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationLine" ADD CONSTRAINT "DepreciationLine_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRate" ADD CONSTRAINT "LoanRate_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanSchedule" ADD CONSTRAINT "LoanSchedule_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "LoanSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
