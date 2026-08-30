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
  /** Scopes the run to one company. Omit to depreciate every asset on file. */
  @IsOptional()
  @IsNumber()
  legalEntityId?: number;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  book?: string;
}
