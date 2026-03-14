import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { LoansService } from './loans.service';
import { CreateLoanDto, CreateLoanPaymentDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'FINANCE')
@Controller({ path: 'loans', version: '1' })
export class LoansController {
  constructor(private readonly svc: LoansService) {}

  @Post()
  @RequirePermissions('loans:create')
  createLoan(@Body() dto: CreateLoanDto) {
    return this.svc.createLoan(dto);
  }

  @Get()
  @RequirePermissions('loans:view')
  listLoans() {
    return this.svc.listLoans();
  }

  @Post('payments')
  @RequirePermissions('loans:pay')
  recordPayment(@Body() dto: CreateLoanPaymentDto) {
    return this.svc.recordPayment(dto);
  }
}

