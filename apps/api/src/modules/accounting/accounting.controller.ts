import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { CreateAccountDto, CreateJournalDto, CreateVoucherDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'FINANCE')
@Controller({ path: 'accounting', version: '1' })
export class AccountingController {
  constructor(private readonly svc: AccountingService) {}

  @Post('accounts')
  @RequirePermissions('accounting:coa')
  createAccount(@Body() dto: CreateAccountDto) {
    return this.svc.createAccount(dto);
  }

  @Get('accounts')
  @RequirePermissions('accounting:coa')
  listAccounts() {
    return this.svc.listAccounts();
  }

  @Post('journals')
  @RequirePermissions('accounting:journal')
  postJournal(@Body() dto: CreateJournalDto) {
    return this.svc.postJournal(dto);
  }

  @Get('journals')
  @RequirePermissions('accounting:journal')
  listJournals() {
    return this.svc.listJournals();
  }

  @Post('vouchers')
  @RequirePermissions('accounting:voucher')
  postVoucher(@Body() dto: CreateVoucherDto) {
    return this.svc.postVoucher(dto);
  }

  @Get('vouchers')
  @RequirePermissions('accounting:voucher')
  listVouchers() {
    return this.svc.listVouchers();
  }
}


