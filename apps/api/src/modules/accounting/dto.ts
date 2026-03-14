import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, ValidateNested, Min, MinLength, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export enum VoucherKind {
  PAYMENT = 'PAYMENT',
  RECEIPT = 'RECEIPT',
  CONTRA = 'CONTRA',
}

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  type!: string; // ASSET, LIABILITY, EQUITY, INCOME, EXPENSE

  @IsOptional()
  @IsNumber()
  parentId?: number;
}

export class JournalLineDto {
  @IsNumber()
  accountId!: number;

  @IsOptional()
  @IsNumber()
  branchId?: number;

  @IsNumber()
  @Min(0)
  debit: number = 0;

  @IsNumber()
  @Min(0)
  credit: number = 0;

  @IsOptional()
  @IsString()
  memo?: string;
}

export class CreateJournalDto {
  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  type?: string; // JournalType enum as string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  @ArrayMinSize(2)
  lines!: JournalLineDto[];
}

export class CreateVoucherDto {
  @IsEnum(VoucherKind)
  type!: VoucherKind;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsDateString()
  date!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  payee?: string;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines?: JournalLineDto[];
}

