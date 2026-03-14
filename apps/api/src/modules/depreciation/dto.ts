import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { DepreciationMethod } from '@prisma/client';

export class CreateDepPolicyDto {
  @IsString()
  name!: string;

  @IsEnum(DepreciationMethod)
  method!: DepreciationMethod;

  @IsOptional()
  @IsNumber()
  companyId?: number;
}

export class RunDepreciationDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  book?: string;
}
