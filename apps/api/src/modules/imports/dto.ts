import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class ImportAccountRowDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  allowsPosting?: boolean;

  @IsOptional()
  @IsBoolean()
  isControlAccount?: boolean;

  @IsOptional()
  @IsString()
  controlSource?: string;
}

class ImportPartyRowDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  line1?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

class ImportProductRowDto {
  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  uom?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class ImportTaxConfigRowDto {
  @Type(() => Number)
  @IsInt()
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
  rate!: number;

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
  @IsString()
  outputAccountCode?: string;

  @IsOptional()
  @IsString()
  inputAccountCode?: string;

  @IsOptional()
  @IsString()
  liabilityAccountCode?: string;
}

export class BulkImportAccountsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportAccountRowDto)
  rows!: ImportAccountRowDto[];
}

export class BulkImportCustomersDto {
  @Type(() => Number)
  @IsInt()
  companyId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportPartyRowDto)
  rows!: ImportPartyRowDto[];
}

export class BulkImportSuppliersDto {
  @Type(() => Number)
  @IsInt()
  companyId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportPartyRowDto)
  rows!: ImportPartyRowDto[];
}

export class BulkImportProductsDto {
  @Type(() => Number)
  @IsInt()
  companyId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportProductRowDto)
  rows!: ImportProductRowDto[];
}

export class BulkImportTaxConfigsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTaxConfigRowDto)
  rows!: ImportTaxConfigRowDto[];
}

export type BulkImportResult = {
  dataset: string;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};
