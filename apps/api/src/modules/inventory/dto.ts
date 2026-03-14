import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @Type(() => Number)
  @IsNumber()
  companyId!: number;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  sku!: string;

  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @IsOptional()
  @IsNumber()
  uomId?: number;
}

export class CreateWarehouseDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  branchId!: number;
}

export class StockMoveDto {
  @IsNumber()
  productId!: number;

  @IsNumber()
  warehouseId!: number;

  @IsNumber()
  quantity!: number;

  @IsString()
  direction!: 'IN' | 'OUT';

  @IsOptional()
  @IsString()
  reference?: string;
}
