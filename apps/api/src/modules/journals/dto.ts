import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { $Enums } from '@prisma/client';

export class JournalAttachmentDto {
  @IsString()
  fileName!: string;

  @IsString()
  fileUrl!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class JournalLineDto {
  @IsNumber()
  accountId!: number;

  @IsOptional()
  @IsEnum($Enums.GLSubledgerType)
  subledgerType?: $Enums.GLSubledgerType;

  @IsOptional()
  @IsString()
  subledgerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  debitAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditAmount?: number;

  @IsOptional()
  @IsString()
  transactionCurrencyCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @IsOptional()
  @IsNumber()
  taxCodeId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

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
  @IsNumber()
  productId?: number;

  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsNumber()
  warehouseId?: number;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @IsString()
  lineNarration?: string;

  @IsOptional()
  @IsString()
  reference1?: string;

  @IsOptional()
  @IsString()
  reference2?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  partnerName?: string;

  @IsOptional()
  @IsString()
  partnerCode?: string;
}

export class CreateJournalDto {
  @IsEnum($Enums.GLJournalType)
  journalType!: $Enums.GLJournalType;

  @IsOptional()
  @IsEnum($Enums.GLJournalSourceType)
  sourceType?: $Enums.GLJournalSourceType;

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

  @IsDateString()
  journalDate!: string;

  @IsDateString()
  postingDate!: string;

  @IsNumber()
  accountingPeriodId!: number;

  @IsOptional()
  @IsNumber()
  fiscalYearId?: number;

  @IsString()
  currencyCode!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsString()
  narration!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isAutoReversing?: boolean;

  @IsOptional()
  @IsDateString()
  autoReverseDate?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsNumber()
  recurringTemplateId?: number;

  @IsOptional()
  @IsBoolean()
  isIntercompany?: boolean;

  @IsOptional()
  @IsString()
  intercompanyReference?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalAttachmentDto)
  attachments?: JournalAttachmentDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class UpdateJournalDto {
  @IsOptional()
  @IsEnum($Enums.GLJournalType)
  journalType?: $Enums.GLJournalType;

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
  @IsDateString()
  journalDate?: string;

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
  currencyCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isAutoReversing?: boolean;

  @IsOptional()
  @IsDateString()
  autoReverseDate?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsBoolean()
  isIntercompany?: boolean;

  @IsOptional()
  @IsString()
  intercompanyReference?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalAttachmentDto)
  attachments?: JournalAttachmentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines?: JournalLineDto[];
}

export class ListJournalsQueryDto {
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
  @IsEnum($Enums.GLJournalStatus)
  status?: $Enums.GLJournalStatus;

  @IsOptional()
  @IsEnum($Enums.GLJournalType)
  journalType?: $Enums.GLJournalType;

  @IsOptional()
  @IsString()
  sourceModule?: string;

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
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;
}

export class ValidateJournalDto {
  @IsOptional()
  @IsBoolean()
  strict?: boolean;
}

export class ApproveJournalDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

export class RejectJournalDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class ReverseJournalDto {
  @IsDateString()
  reversalDate!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsBoolean()
  fullReversal?: boolean;
}

export class CancelJournalDto {
  @IsString()
  reason!: string;
}

export class CreateRecurringJournalTemplateDto {
  @IsString()
  templateName!: string;

  @IsEnum($Enums.GLJournalType)
  journalType!: $Enums.GLJournalType;

  @IsEnum($Enums.RecurringFrequency)
  frequency!: $Enums.RecurringFrequency;

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

  @IsString()
  currencyCode!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsString()
  narrationTemplate!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  nextRunDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class GenerateRecurringJournalDto {
  @IsDateString()
  journalDate!: string;

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
}

export class AuditMetaDto {
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  deviceInfo?: string;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
