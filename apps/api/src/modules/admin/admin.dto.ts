import { IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  permissions?: string[];
}

export class CreatePermissionDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AssignRoleDto {
  @IsArray()
  roles!: string[];
}

export class CreateFiscalYearDto {
  @IsInt()
  @Min(1)
  companyId!: number;

  @IsString()
  name!: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  generateMonthlyPeriods?: boolean;
}

export class UpdateAccountingPeriodStatusDto {
  @IsIn(['OPEN', 'CLOSED', 'LOCKED'])
  status!: 'OPEN' | 'CLOSED' | 'LOCKED';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class FiscalYearTransitionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
