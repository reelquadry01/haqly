import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListTaxConfigsDto {
  @Type(() => Number)
  @IsNumber()
  companyId!: number;
}

export class CreateTaxConfigDto {
  @Type(() => Number)
  @IsNumber()
  companyId!: number;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  taxType?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  rate!: number;

  @IsBoolean()
  isInclusive!: boolean;

  @IsOptional()
  @IsBoolean()
  recoverable?: boolean;

  @IsOptional()
  @IsString()
  filingFrequency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  outputAccountId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  inputAccountId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  liabilityAccountId?: number;
}

export class UpdateTaxConfigDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  taxType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  rate?: number;

  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean;

  @IsOptional()
  @IsBoolean()
  recoverable?: boolean;

  @IsOptional()
  @IsString()
  filingFrequency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  outputAccountId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  inputAccountId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  liabilityAccountId?: number;
}

export class TaxReportQueryDto {
  @Type(() => Number)
  @IsNumber()
  companyId!: number;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
