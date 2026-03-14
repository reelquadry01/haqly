import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export const reportFormats = ['json', 'csv', 'xlsx', 'pdf'] as const;
export type ReportFormat = (typeof reportFormats)[number];

export const financialStatementKinds = [
  'profit-or-loss',
  'financial-position',
  'cash-flow',
  'changes-in-equity',
  'notes',
] as const;
export type FinancialStatementKind = (typeof financialStatementKinds)[number];

export class ReportQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  companyId?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  branchId?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  fiscalYearId?: number;

  @IsOptional()
  @IsString()
  compareFrom?: string;

  @IsOptional()
  @IsString()
  compareTo?: string;

  @IsOptional()
  @IsIn(reportFormats)
  format?: ReportFormat;
}

export class AccountStatementQueryDto extends ReportQueryDto {
  @Type(() => Number)
  @IsInt()
  accountId!: number;
}
