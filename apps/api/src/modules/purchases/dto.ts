import { IsDateString, IsNumber, IsOptional, IsString, Min, ValidateNested, ArrayMinSize, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplierDto {
  @Type(() => Number)
  @IsNumber()
  companyId!: number;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class PurchaseItemDto {
  @IsNumber()
  productId!: number;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsOptional()
  @IsNumber()
  taxRate?: number;
}

export class CreateBillDto {
  @Type(() => Number)
  @IsNumber()
  legalEntityId!: number;

  @IsNumber()
  supplierId!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  warehouseId?: number;

  @IsOptional()
  @IsNumber()
  apAccountId?: number;

  @IsOptional()
  @IsNumber()
  expenseAccountId?: number; // or inventory account

  @IsOptional()
  @IsNumber()
  taxAccountId?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}
