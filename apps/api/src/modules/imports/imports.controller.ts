import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

import {
  BulkImportAccountsDto,
  BulkImportAPOpeningBalancesDto,
  BulkImportAROpeningBalancesDto,
  BulkImportCustomerReceiptsDto,
  BulkImportCustomersDto,
  BulkImportFixedAssetsDto,
  BulkImportGLOpeningBalancesDto,
  BulkImportProductsDto,
  BulkImportStockOpeningBalancesDto,
  BulkImportSupplierPaymentsDto,
  BulkImportSuppliersDto,
  BulkImportTaxConfigsDto,
  BulkImportBranchesDto,
  BulkImportDepartmentsDto,
  BulkImportWarehousesDto,
  BulkImportBankAccountsDto,
  BulkImportAssetCategoriesDto
} from './dto';

import { ImportsService } from './imports.service';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'FINANCE', 'WAREHOUSE')
@Controller({ path: 'imports', version: '1' })
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('chart-of-accounts')
  @RequirePermissions('accounting:coa')
  importChartOfAccounts(@Body() dto: BulkImportAccountsDto) {
    return this.imports.importAccounts(dto);
  }

  @Post('customers')
  @RequirePermissions('sales:view')
  importCustomers(@Body() dto: BulkImportCustomersDto) {
    return this.imports.importCustomers(dto);
  }

  @Post('suppliers')
  @RequirePermissions('purchases:view')
  importSuppliers(@Body() dto: BulkImportSuppliersDto) {
    return this.imports.importSuppliers(dto);
  }

  @Post('products')
  @RequirePermissions('inventory:view')
  importProducts(@Body() dto: BulkImportProductsDto) {
    return this.imports.importProducts(dto);
  }

  @Post('tax-configs')
  @RequirePermissions('org:create')
  importTaxConfigs(@Body() dto: BulkImportTaxConfigsDto) {
    return this.imports.importTaxConfigs(dto);
  }

  @Post('branches')
  @RequirePermissions('org:create')
  importBranches(@Body() dto: BulkImportBranchesDto) {
    return this.imports.importBranches(dto);
  }

  @Post('departments')
  @RequirePermissions('org:create')
  importDepartments(@Body() dto: BulkImportDepartmentsDto) {
    return this.imports.importDepartments(dto);
  }

  @Post('warehouses')
  @RequirePermissions('inventory:view')
  importWarehouses(@Body() dto: BulkImportWarehousesDto) {
    return this.imports.importWarehouses(dto);
  }

  @Post('bank-accounts')
  @RequirePermissions('finance:view')
  importBankAccounts(@Body() dto: BulkImportBankAccountsDto) {
    return this.imports.importBankAccounts(dto);
  }

  @Post('asset-categories')
  @RequirePermissions('finance:view')
  importAssetCategories(@Body() dto: BulkImportAssetCategoriesDto) {
    return this.imports.importAssetCategories(dto);
  }


  // ─── Accounting Migration Endpoints ──────────────────────────────────────

  @Post('gl-opening-balances')
  @RequirePermissions('accounting:journal')
  importGLOpeningBalances(@Body() dto: BulkImportGLOpeningBalancesDto) {
    return this.imports.importGLOpeningBalances(dto);
  }

  @Post('ar-opening-balances')
  @RequirePermissions('sales:view')
  importAROpeningBalances(@Body() dto: BulkImportAROpeningBalancesDto) {
    return this.imports.importAROpeningBalances(dto);
  }

  @Post('ap-opening-balances')
  @RequirePermissions('purchases:view')
  importAPOpeningBalances(@Body() dto: BulkImportAPOpeningBalancesDto) {
    return this.imports.importAPOpeningBalances(dto);
  }

  @Post('customer-receipts')
  @RequirePermissions('sales:view')
  importCustomerReceipts(@Body() dto: BulkImportCustomerReceiptsDto) {
    return this.imports.importCustomerReceipts(dto);
  }

  @Post('supplier-payments')
  @RequirePermissions('purchases:view')
  importSupplierPayments(@Body() dto: BulkImportSupplierPaymentsDto) {
    return this.imports.importSupplierPayments(dto);
  }

  @Post('fixed-assets')
  @RequirePermissions('fixed_assets:create')
  importFixedAssets(@Body() dto: BulkImportFixedAssetsDto) {
    return this.imports.importFixedAssets(dto);
  }

  @Post('stock-opening-balances')
  @RequirePermissions('inventory:view')
  importStockOpeningBalances(@Body() dto: BulkImportStockOpeningBalancesDto) {
    return this.imports.importStockOpeningBalances(dto);
  }
}