import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';
import {
  IsArray,
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateCustomerDto {
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

  @IsOptional()
  @IsString()
  customerType?: string;

  @IsOptional()
  @IsString()
  onboardingStatus?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  customerType?: string;

  @IsOptional()
  @IsString()
  onboardingStatus?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class SalesItemDto {
  @IsNumber()
  productId!: number;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  taxRate?: number;
}

export class CreateInvoiceDto {
  @Type(() => Number)
  @IsNumber()
  legalEntityId!: number;

  @IsNumber()
  customerId!: number;

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
  arAccountId?: number;

  @IsOptional()
  @IsNumber()
  revenueAccountId?: number;

  @IsOptional()
  @IsNumber()
  taxAccountId?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesItemDto)
  items!: SalesItemDto[];
}

export class CustomerReceiptLineDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  invoiceId?: number;

  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  appliedAmount!: number;
}

export class CreateCustomerReceiptDto {
  @Type(() => Number)
  @IsNumber()
  legalEntityId!: number;

  @Type(() => Number)
  @IsNumber()
  branchId!: number;

  @Type(() => Number)
  @IsNumber()
  customerId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bankAccountId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cashAccountId?: number;

  @Type(() => Number)
  @IsNumber()
  receivableAccountId!: number;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsDateString()
  paymentDate!: string;

  @IsDateString()
  postingDate!: string;

  @IsString()
  currencyCode!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @IsOptional()
  @IsString()
  bankReference?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsString()
  narration!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomerReceiptLineDto)
  lines!: CustomerReceiptLineDto[];
}

export class PostCustomerReceiptDto {
  @IsOptional()
  @IsString()
  narration?: string;
}
