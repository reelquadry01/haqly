import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class CreateEmployeeDto {
  @IsInt()
  companyId!: number;

  @IsString()
  @MinLength(1)
  employeeNo!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsInt()
  branchId?: number;

  @IsNumber()
  @Min(0)
  grossSalary!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsInt()
  branchId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  grossSalary?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;
}

export class CreatePayrollRunDto {
  @IsInt()
  companyId!: number;

  @IsString()
  @MinLength(1)
  period!: string;

  @IsDateString()
  payDate!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AddPayrollLineDto {
  @IsInt()
  employeeId!: number;

  @IsNumber()
  @Min(0)
  grossPay!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxDeduction?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherDeductions?: number;
}

export class ApprovePayrollRunDto {
  @IsOptional()
  @IsInt()
  approvedBy?: number;
}
