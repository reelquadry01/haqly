import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { DepreciationMethod } from '@prisma/client';

export class CreateAssetCategoryDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(1)
  usefulLifeMonths!: number;

  @IsOptional()
  @IsNumber()
  residualRate?: number;

  @IsEnum(DepreciationMethod)
  depreciationMethod!: DepreciationMethod;

  @IsOptional()
  @IsNumber()
  glAssetAccountId?: number;

  @IsOptional()
  @IsNumber()
  glAccumDepAccountId?: number;

  @IsOptional()
  @IsNumber()
  glExpenseAccountId?: number;
}

export class CreateAssetDto {
  @IsString()
  name!: string;

  @IsString()
  tag!: string;

  @IsNumber()
  categoryId!: number;

  @IsOptional()
  @IsNumber()
  branchId?: number;

  @IsDateString()
  acquisitionDate!: string;

  @IsNumber()
  acquisitionCost!: number;

  @IsOptional()
  @IsNumber()
  residualValue?: number;
}
