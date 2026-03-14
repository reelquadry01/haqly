import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import {
  CreateCustomerDto,
  CreateCustomerReceiptDto,
  CreateInvoiceDto,
  PostCustomerReceiptDto,
  UpdateCustomerDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'FINANCE')
@Controller({ path: 'sales', version: '1' })
export class SalesController {
  constructor(private readonly svc: SalesService) {}

  @Post('customers')
  @RequirePermissions('sales:view')
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.svc.createCustomer(dto);
  }

  @Get('customers')
  @RequirePermissions('sales:view')
  listCustomers(@Query('companyId') companyId?: string) {
    return this.svc.listCustomers(companyId ? Number(companyId) : undefined);
  }

  @Patch('customers/:id')
  @RequirePermissions('sales:view')
  updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @Query('companyId') companyId?: string) {
    return this.svc.updateCustomer(Number(id), dto, companyId ? Number(companyId) : undefined);
  }

  @Post('invoices')
  @RequirePermissions('sales:view')
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.svc.createInvoice(dto);
  }

  @Get('invoices')
  @RequirePermissions('sales:view')
  listInvoices(@Query('companyId') companyId?: string) {
    return this.svc.listInvoices(companyId ? Number(companyId) : undefined);
  }

  @Get('receipts/metadata/options/:legalEntityId')
  @RequirePermissions('sales:view')
  getReceiptMetadata(@Param('legalEntityId') legalEntityId: string) {
    return this.svc.getReceiptMetadata(Number(legalEntityId));
  }

  @Post('receipts')
  @RequirePermissions('sales:view')
  createReceipt(@Body() dto: CreateCustomerReceiptDto, @Req() req: { user?: { userId?: number; email?: string } }) {
    return this.svc.createReceipt(dto, { userId: req.user?.userId, email: req.user?.email });
  }

  @Get('receipts')
  @RequirePermissions('sales:view')
  listReceipts(@Query('companyId') companyId?: string, @Query('branchId') branchId?: string) {
    return this.svc.listReceipts(companyId ? Number(companyId) : undefined, branchId ? Number(branchId) : undefined);
  }

  @Get('receipts/:id')
  @RequirePermissions('sales:view')
  getReceipt(@Param('id') id: string, @Query('companyId') companyId?: string) {
    return this.svc.getReceipt(Number(id), companyId ? Number(companyId) : undefined);
  }

  @Post('receipts/:id/post')
  @RequirePermissions('sales:view')
  postReceipt(
    @Param('id') id: string,
    @Body() dto: PostCustomerReceiptDto,
    @Req() req: { user?: { userId?: number; email?: string } },
  ) {
    return this.svc.postReceipt(Number(id), dto, { userId: req.user?.userId, email: req.user?.email });
  }
}
