import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { $Enums } from '@prisma/client';

export class PaymentVoucherAttachmentDto {
  @IsString()
  fileName!: string;

  @IsString()
  fileUrl!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class PaymentVoucherLineDto {
  @IsEnum($Enums.PaymentLineType)
  lineType!: $Enums.PaymentLineType;

  @IsNumber()
  accountId!: number;

  @IsOptional()
  @IsString()
  subledgerType?: string;

  @IsOptional()
  @IsString()
  subledgerId?: string;

  @IsOptional()
  @IsString()
  sourceInvoiceId?: string;

  @IsOptional()
  @IsString()
  sourceInvoiceNumber?: string;

  @IsOptional()
  @IsString()
  sourceExpenseClaimId?: string;

  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  grossAmount!: number;

  @IsOptional()
  @IsNumber()
  taxCodeId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  withholdingTaxCodeId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  withholdingTaxAmount?: number;

  @IsNumber()
  @Min(0)
  netAmount!: number;

  @IsOptional()
  @IsNumber()
  branchId?: number;

  @IsOptional()
  @IsNumber()
  departmentId?: number;

  @IsOptional()
  @IsNumber()
  costCenterId?: number;

  @IsOptional()
  @IsNumber()
  projectId?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CreatePaymentVoucherDto {
  @IsEnum($Enums.PaymentVoucherType)
  voucherType!: $Enums.PaymentVoucherType;

  @IsOptional()
  @IsEnum($Enums.PaymentVoucherSourceType)
  sourceType?: $Enums.PaymentVoucherSourceType;

  @IsOptional()
  @IsString()
  sourceModule?: string;

  @IsOptional()
  @IsString()
  sourceDocumentId?: string;

  @IsOptional()
  @IsString()
  sourceDocumentNumber?: string;

  @IsNumber()
  legalEntityId!: number;

  @IsNumber()
  branchId!: number;

  @IsOptional()
  @IsNumber()
  departmentId?: number;

  @IsOptional()
  @IsNumber()
  costCenterId?: number;

  @IsOptional()
  @IsNumber()
  projectId?: number;

  @IsEnum($Enums.PaymentBeneficiaryType)
  beneficiaryType!: $Enums.PaymentBeneficiaryType;

  @IsOptional()
  @IsString()
  beneficiaryId?: string;

  @IsString()
  beneficiaryName!: string;

  @IsOptional()
  @IsString()
  beneficiaryCode?: string;

  @IsOptional()
  @IsNumber()
  supplierId?: number;

  @IsOptional()
  @IsNumber()
  payableAccountId?: number;

  @IsOptional()
  @IsNumber()
  bankAccountId?: number;

  @IsOptional()
  @IsNumber()
  cashAccountId?: number;

  @IsEnum($Enums.PaymentMethod)
  paymentMethod!: $Enums.PaymentMethod;

  @IsOptional()
  @IsString()
  paymentChannel?: string;

  @IsString()
  currencyCode!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @IsDateString()
  voucherDate!: string;

  @IsDateString()
  requestedPaymentDate!: string;

  @IsDateString()
  postingDate!: string;

  @IsNumber()
  accountingPeriodId!: number;

  @IsOptional()
  @IsNumber()
  fiscalYearId?: number;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  invoiceReference?: string;

  @IsString()
  narration!: string;

  @IsString()
  purposeOfPayment!: string;

  @IsOptional()
  @IsBoolean()
  requiresAttachment?: boolean;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsNumber()
  templateId?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentVoucherAttachmentDto)
  attachments?: PaymentVoucherAttachmentDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentVoucherLineDto)
  lines!: PaymentVoucherLineDto[];
}

export class UpdatePaymentVoucherDto {
  @IsOptional()
  @IsEnum($Enums.PaymentVoucherType)
  voucherType?: $Enums.PaymentVoucherType;

  @IsOptional()
  @IsNumber()
  legalEntityId?: number;

  @IsOptional()
  @IsNumber()
  branchId?: number;

  @IsOptional()
  @IsNumber()
  departmentId?: number;

  @IsOptional()
  @IsNumber()
  costCenterId?: number;

  @IsOptional()
  @IsNumber()
  projectId?: number;

  @IsOptional()
  @IsEnum($Enums.PaymentBeneficiaryType)
  beneficiaryType?: $Enums.PaymentBeneficiaryType;

  @IsOptional()
  @IsString()
  beneficiaryId?: string;

  @IsOptional()
  @IsString()
  beneficiaryName?: string;

  @IsOptional()
  @IsString()
  beneficiaryCode?: string;

  @IsOptional()
  @IsNumber()
  supplierId?: number;

  @IsOptional()
  @IsNumber()
  payableAccountId?: number;

  @IsOptional()
  @IsNumber()
  bankAccountId?: number;

  @IsOptional()
  @IsNumber()
  cashAccountId?: number;

  @IsOptional()
  @IsEnum($Enums.PaymentMethod)
  paymentMethod?: $Enums.PaymentMethod;

  @IsOptional()
  @IsString()
  paymentChannel?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @IsOptional()
  @IsDateString()
  voucherDate?: string;

  @IsOptional()
  @IsDateString()
  requestedPaymentDate?: string;

  @IsOptional()
  @IsDateString()
  postingDate?: string;

  @IsOptional()
  @IsNumber()
  accountingPeriodId?: number;

  @IsOptional()
  @IsNumber()
  fiscalYearId?: number;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  invoiceReference?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsString()
  purposeOfPayment?: string;

  @IsOptional()
  @IsBoolean()
  requiresAttachment?: boolean;

  @IsOptional()
  @IsNumber()
  templateId?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentVoucherAttachmentDto)
  attachments?: PaymentVoucherAttachmentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentVoucherLineDto)
  lines?: PaymentVoucherLineDto[];
}

export class ListPaymentVouchersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum($Enums.PaymentVoucherStatus)
  status?: $Enums.PaymentVoucherStatus;

  @IsOptional()
  @IsEnum($Enums.PaymentExecutionStatus)
  paymentStatus?: $Enums.PaymentExecutionStatus;

  @IsOptional()
  @IsEnum($Enums.PaymentVoucherType)
  voucherType?: $Enums.PaymentVoucherType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  branchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  createdBy?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentApproverId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;
}

export class VoucherCommentDto {
  @IsString()
  body!: string;

  @IsOptional()
  @IsEnum($Enums.PaymentCommentType)
  commentType?: $Enums.PaymentCommentType;
}

export class ApprovePaymentVoucherDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

export class RejectPaymentVoucherDto {
  @IsString()
  rejectionReason!: string;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class ReturnPaymentVoucherDto {
  @IsString()
  reason!: string;
}

export class CancelPaymentVoucherDto {
  @IsString()
  reason!: string;
}

export class RecallPaymentVoucherDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class InitiatePaymentDto {
  @IsOptional()
  @IsString()
  paymentChannel?: string;

  @IsOptional()
  @IsString()
  providerName?: string;

  @IsOptional()
  @IsString()
  providerReference?: string;
}

export class MarkVoucherPaidDto {
  @IsOptional()
  @IsString()
  bankReference?: string;

  @IsOptional()
  @IsString()
  proofFileUrl?: string;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class ValidatePaymentVoucherDto {
  @IsOptional()
  @IsBoolean()
  requireAttachments?: boolean;
}

export class CreatePaymentTemplateDto {
  @IsString()
  name!: string;

  @IsEnum($Enums.PaymentVoucherType)
  voucherType!: $Enums.PaymentVoucherType;

  @IsOptional()
  @IsEnum($Enums.PaymentTemplateKind)
  templateKind?: $Enums.PaymentTemplateKind;

  @IsOptional()
  @IsNumber()
  legalEntityId?: number;

  @IsOptional()
  @IsNumber()
  branchId?: number;

  @IsOptional()
  @IsEnum($Enums.PaymentMethod)
  paymentMethod?: $Enums.PaymentMethod;

  @IsOptional()
  @IsNumber()
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  maxAmount?: number;

  @IsOptional()
  @IsBoolean()
  requiresAttachment?: boolean;

  @IsOptional()
  @IsBoolean()
  allowRecall?: boolean;

  @IsOptional()
  @IsBoolean()
  postAfterFinalApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPaymentExecution?: boolean;

  @IsOptional()
  @IsBoolean()
  enableGateway?: boolean;

  @IsOptional()
  @IsNumber()
  defaultAccountId?: number;

  @IsOptional()
  @IsString()
  defaultNarration?: string;

  @IsOptional()
  @IsString()
  purposeTemplate?: string;

  @IsOptional()
  approvalMatrix?: unknown;
}

export class PaymentVoucherAuditMetaDto {
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  deviceInfo?: string;
}
