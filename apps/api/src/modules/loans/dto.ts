import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { LoanType, ScheduleType } from '@prisma/client';

export class CreateLoanDto {
  @IsString()
  code!: string;

  @IsString()
  lender!: string;

  @IsEnum(LoanType)
  type!: LoanType;

  @IsNumber()
  principal!: number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  baseRate?: number;

  @IsOptional()
  @IsNumber()
  spread?: number;

  @IsEnum(ScheduleType)
  scheduleType!: ScheduleType;

  /** Set only when the money has actually been drawn down; posts the disbursement. */
  @IsOptional()
  @IsDateString()
  disbursementDate?: string;

  @IsOptional()
  @IsNumber()
  legalEntityId?: number;

  @IsOptional()
  @IsNumber()
  branchId?: number;
}

export class CreateLoanPaymentDto {
  @IsNumber()
  loanId!: number;

  @IsDateString()
  paymentDate!: string;

  @IsNumber()
  @Min(0)
  principalPaid!: number;

  @IsNumber()
  @Min(0)
  interestPaid!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feesPaid?: number;

  /** Links the payment to a scheduled installment and marks it settled. */
  @IsOptional()
  @IsNumber()
  scheduleId?: number;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsOptional()
  @IsNumber()
  legalEntityId?: number;

  @IsOptional()
  @IsNumber()
  branchId?: number;
}
