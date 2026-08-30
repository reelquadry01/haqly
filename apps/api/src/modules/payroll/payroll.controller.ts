import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import {
  AddPayrollLineDto,
  ApprovePayrollRunDto,
  CreateEmployeeDto,
  CreatePayrollRunDto,
  UpdateEmployeeDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'HR')
@Controller({ path: 'payroll', version: '1' })
export class PayrollController {
  constructor(private readonly svc: PayrollService) {}

  // ── Employees ──────────────────────────────────────────────────────────────

  @Post('employees')
  @RequirePermissions('payroll:manage')
  createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.svc.createEmployee(dto);
  }

  @Get('employees')
  @RequirePermissions('payroll:view')
  listEmployees(@Query('companyId') companyId?: string) {
    return this.svc.listEmployees(companyId ? Number(companyId) : undefined);
  }

  @Get('employees/:id')
  @RequirePermissions('payroll:view')
  getEmployee(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getEmployee(id);
  }

  @Patch('employees/:id')
  @RequirePermissions('payroll:manage')
  updateEmployee(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto) {
    return this.svc.updateEmployee(id, dto);
  }

  // ── Payroll Runs ───────────────────────────────────────────────────────────

  @Post('runs')
  @RequirePermissions('payroll:manage')
  createRun(@Body() dto: CreatePayrollRunDto) {
    return this.svc.createRun(dto);
  }

  @Get('runs')
  @RequirePermissions('payroll:view')
  listRuns(@Query('companyId') companyId?: string) {
    return this.svc.listRuns(companyId ? Number(companyId) : undefined);
  }

  @Get('runs/:id')
  @RequirePermissions('payroll:view')
  getRun(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getRun(id);
  }

  @Post('runs/:id/lines')
  @RequirePermissions('payroll:manage')
  addLine(@Param('id', ParseIntPipe) id: number, @Body() dto: AddPayrollLineDto) {
    return this.svc.addLine(id, dto);
  }

  @Patch('runs/:id/submit')
  @RequirePermissions('payroll:manage')
  submitRun(@Param('id', ParseIntPipe) id: number) {
    return this.svc.submitRun(id);
  }

  @Patch('runs/:id/approve')
  @RequirePermissions('payroll:approve')
  approveRun(@Param('id', ParseIntPipe) id: number, @Body() dto: ApprovePayrollRunDto) {
    return this.svc.approveRun(id, dto);
  }

  @Patch('runs/:id/post')
  @RequirePermissions('payroll:approve')
  postRun(@Param('id', ParseIntPipe) id: number) {
    return this.svc.postRun(id);
  }
}
