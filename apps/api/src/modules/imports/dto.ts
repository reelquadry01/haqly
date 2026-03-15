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

class ImportBranchRowDto {
  @IsString()
  companyCode!: string;

  @IsString()
  branchCode!: string;

  @IsString()
  branchName!: string;
}

class ImportDepartmentRowDto {
  @IsString()
  companyCode!: string;

  @IsString()
  departmentName!: string;
}

class ImportWarehouseRowDto {
  @IsString()
  branchCode!: string;

  @IsString()
  warehouseName!: string;
}

class ImportBankAccountRowDto {
  @IsString()
  companyCode!: string;

  @IsString()
  branchCode!: string;

  @IsString()
  bankName!: string;

  @IsString()
  accountName!: string;

  @IsString()
  accountNumber!: string;

  @IsString()
  currencyCode!: string;

  @IsString()
  glAccountCode!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class ImportAssetCategoryRowDto {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsInt()
  usefulLifeMonths!: number;

  @Type(() => Number)
  @IsNumber()
  residualRate!: number;

  @IsString()
  depreciationMethod!: string;
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

export class BulkImportBranchesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportBranchRowDto)
  rows!: ImportBranchRowDto[];
}

export class BulkImportDepartmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportDepartmentRowDto)
  rows!: ImportDepartmentRowDto[];
}

export class BulkImportWarehousesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportWarehouseRowDto)
  rows!: ImportWarehouseRowDto[];
}

export class BulkImportBankAccountsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportBankAccountRowDto)
  rows!: ImportBankAccountRowDto[];
}

export class BulkImportAssetCategoriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportAssetCategoryRowDto)
  rows!: ImportAssetCategoryRowDto[];
}

export type BulkImportResult = {
  dataset: string;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

// ─── Accounting Migration DTOs ────────────────────────────────────────────────

// GL Opening Balance — one row per account with opening debit or credit
class ImportGLOpeningBalanceRowDto {
  @IsString()
  accountCode!: string;         // Must match existing account in COA

  @IsString()
  accountName!: string;         // For reference/validation only

  @IsOptional()
  @IsString()
  type?: string;                // ASSET, LIABILITY, EQUITY, INCOME, EXPENSE

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  debit!: number;               // Opening debit balance (0 if credit side)

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  credit!: number;              // Opening credit balance (0 if debit side)

  @IsOptional()
  @IsString()
  branchCode?: string;          // Optional branch allocation

  @IsOptional()
  @IsString()
  narration?: string;           // e.g. "Opening balance as at 31 Dec 2025"
}

export class BulkImportGLOpeningBalancesDto {
  @Type(() => Number)
  @IsInt()
  companyId!: number;

  @IsString()
  openingDate!: string;         // ISO date: "2026-01-01"

  @IsString()
  reference!: string;           // e.g. "OB-2026-001"

  @IsOptional()
  @IsString()
  narration?: string;           // e.g. "Opening balances migrated from legacy ERP"

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportGLOpeningBalanceRowDto)
  rows!: ImportGLOpeningBalanceRowDto[];
}

// AR Opening Balance — outstanding customer invoices from previous system
class ImportAROpeningBalanceRowDto {
  @IsString()
  customerName!: string;        // Must match or create customer

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsString()
  invoiceNumber!: string;       // Legacy invoice number e.g. "INV-2025-0891"

  @IsString()
  invoiceDate!: string;         // ISO date "2025-12-15"

  @IsString()
  dueDate!: string;             // ISO date "2026-01-15"

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;              // Invoice total (gross)

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  outstanding!: number;         // Amount still unpaid (may be partial)

  @IsOptional()
  @IsString()
  currencyCode?: string;        // Defaults to NGN

  @IsOptional()
  @IsString()
  narration?: string;
}

export class BulkImportAROpeningBalancesDto {
  @Type(() => Number)
  @IsInt()
  companyId!: number;

  @IsString()
  openingDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportAROpeningBalanceRowDto)
  rows!: ImportAROpeningBalanceRowDto[];
}

// AP Opening Balance — outstanding supplier bills from previous system
class ImportAPOpeningBalanceRowDto {
  @IsString()
  supplierName!: string;        // Must match or create supplier

  @IsOptional()
  @IsString()
  supplierEmail?: string;

  @IsString()
  billNumber!: string;          // Legacy bill/invoice number e.g. "PO-2025-0441"

  @IsString()
  billDate!: string;            // ISO date

  @IsString()
  dueDate!: string;             // ISO date

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;              // Bill total

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  outstanding!: number;         // Amount still unpaid

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  narration?: string;
}

export class BulkImportAPOpeningBalancesDto {
  @Type(() => Number)
  @IsInt()
  companyId!: number;

  @IsString()
  openingDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportAPOpeningBalanceRowDto)
  rows!: ImportAPOpeningBalanceRowDto[];
}

// Customer Receipts — historical payments received from customers
class ImportCustomerReceiptRowDto {
  @IsString()
  customerName!: string;

  @IsString()
  receiptNumber!: string;       // Legacy receipt reference

  @IsString()
  receiptDate!: string;         // ISO date

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;              // Amount received

  @IsOptional()
  @IsString()
  invoiceReference?: string;    // Invoice this receipt applies to

  @IsOptional()
  @IsString()
  paymentMethod?: string;       // CASH, BANK_TRANSFER, CHEQUE

  @IsOptional()
  @IsString()
  bankAccountCode?: string;     // GL account for the bank/cash receipt

  @IsOptional()
  @IsString()
  narration?: string;
}

export class BulkImportCustomerReceiptsDto {
  @Type(() => Number)
  @IsInt()
  companyId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportCustomerReceiptRowDto)
  rows!: ImportCustomerReceiptRowDto[];
}

// Supplier Payments — historical payments made to suppliers
class ImportSupplierPaymentRowDto {
  @IsString()
  supplierName!: string;

  @IsString()
  paymentReference!: string;    // Legacy payment reference

  @IsString()
  paymentDate!: string;         // ISO date

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  billReference?: string;       // Bill this payment applies to

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  bankAccountCode?: string;

  @IsOptional()
  @IsString()
  narration?: string;
}

export class BulkImportSupplierPaymentsDto {
  @Type(() => Number)
  @IsInt()
  companyId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportSupplierPaymentRowDto)
  rows!: ImportSupplierPaymentRowDto[];
}

// Fixed Asset Register — asset list with cost, depreciation, NBV
class ImportFixedAssetRowDto {
  @IsString()
  assetCode!: string;           // Unique asset identifier e.g. "VEH-001"

  @IsString()
  assetName!: string;           // e.g. "Toyota Hilux 2022"

  @IsString()
  category!: string;            // e.g. "Motor Vehicles", "Computer Equipment"

  @IsString()
  acquisitionDate!: string;     // ISO date

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice!: number;           // Original cost

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accumulatedDepreciation!: number; // Total depreciation to date

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netBookValue!: number;        // costPrice - accumulatedDepreciation

  @IsOptional()
  @IsString()
  depreciationMethod?: string;  // STRAIGHT_LINE (default), DECLINING_BALANCE

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  usefulLifeYears?: number;     // Useful life in years

  @IsOptional()
  @IsString()
  assetAccountCode?: string;    // GL account for asset (e.g. 1500)

  @IsOptional()
  @IsString()
  depreciationAccountCode?: string; // GL accumulated depreciation account

  @IsOptional()
  @IsString()
  location?: string;            // Branch or physical location

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  narration?: string;
}

export class BulkImportFixedAssetsDto {
  @Type(() => Number)
  @IsInt()
  companyId!: number;

  @IsString()
  asOfDate!: string;            // Opening balance date

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportFixedAssetRowDto)
  rows!: ImportFixedAssetRowDto[];
}

// Stock Opening Balances — inventory quantities and values
class ImportStockOpeningBalanceRowDto {
  @IsString()
  sku!: string;                 // Must match existing product

  @IsString()
  productName!: string;         // For reference

  @IsString()
  warehouseName!: string;       // Must match or create warehouse

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;            // Cost per unit

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalValue!: number;          // quantity * unitCost

  @IsOptional()
  @IsString()
  uom?: string;                 // Unit of measure

  @IsOptional()
  @IsString()
  inventoryAccountCode?: string; // GL account e.g. 1200

  @IsOptional()
  @IsString()
  narration?: string;
}

export class BulkImportStockOpeningBalancesDto {
  @Type(() => Number)
  @IsInt()
  companyId!: number;

  @IsString()
  openingDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportStockOpeningBalanceRowDto)
  rows!: ImportStockOpeningBalanceRowDto[];
}