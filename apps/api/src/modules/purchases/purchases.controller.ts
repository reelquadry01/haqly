import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreateBillDto, CreateSupplierDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'FINANCE', 'WAREHOUSE')
@Controller({ path: 'purchases', version: '1' })
export class PurchasesController {
  constructor(private readonly svc: PurchasesService) {}

  @Post('suppliers')
  @RequirePermissions('purchases:view')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.svc.createSupplier(dto);
  }

  @Get('suppliers')
  @RequirePermissions('purchases:view')
  listSuppliers(@Query('companyId') companyId?: string) {
    return this.svc.listSuppliers(companyId ? Number(companyId) : undefined);
  }

  @Post('bills')
  @RequirePermissions('purchases:view')
  createBill(@Body() dto: CreateBillDto) {
    return this.svc.createBill(dto);
  }

  @Get('bills')
  @RequirePermissions('purchases:view')
  listBills(@Query('companyId') companyId?: string) {
    return this.svc.listBills(companyId ? Number(companyId) : undefined);
  }
}
