import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';
import {
  BulkImportAccountsDto,
  BulkImportCustomersDto,
  BulkImportProductsDto,
  BulkImportSuppliersDto,
  BulkImportTaxConfigsDto,
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
}

