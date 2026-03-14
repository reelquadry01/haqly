import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  AssignRoleDto,
  CreateFiscalYearDto,
  CreatePermissionDto,
  CreateRoleDto,
  FiscalYearTransitionDto,
  UpdateAccountingPeriodStatusDto,
} from './admin.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('permissions')
  @RequirePermissions('admin:roles')
  createPermission(@Body() dto: CreatePermissionDto) {
    return this.admin.createPermission(dto);
  }

  @Post('roles')
  @RequirePermissions('admin:roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.admin.createRole(dto);
  }

  @Post('users/:userId/roles')
  @RequirePermissions('admin:roles')
  assignRoles(@Param('userId', ParseIntPipe) userId: number, @Body() dto: AssignRoleDto) {
    return this.admin.assignRoles(userId, dto);
  }

  @Get('fiscal-years')
  @RequirePermissions('org:view')
  listFiscalYears(@Query('companyId', ParseIntPipe) companyId: number) {
    return this.admin.listFiscalYears(companyId);
  }

  @Post('fiscal-years')
  @RequirePermissions('org:create')
  createFiscalYear(@Body() dto: CreateFiscalYearDto) {
    return this.admin.createFiscalYear(dto);
  }

  @Post('fiscal-years/:fiscalYearId/close')
  @RequirePermissions('org:create')
  closeFiscalYear(@Param('fiscalYearId', ParseIntPipe) fiscalYearId: number, @Body() dto: FiscalYearTransitionDto) {
    return this.admin.closeFiscalYear(fiscalYearId, dto.reason);
  }

  @Post('fiscal-years/:fiscalYearId/lock')
  @RequirePermissions('org:create')
  lockFiscalYear(@Param('fiscalYearId', ParseIntPipe) fiscalYearId: number, @Body() dto: FiscalYearTransitionDto) {
    return this.admin.lockFiscalYear(fiscalYearId, dto.reason);
  }

  @Patch('accounting-periods/:periodId')
  @RequirePermissions('org:create')
  updateAccountingPeriodStatus(
    @Param('periodId', ParseIntPipe) periodId: number,
    @Body() dto: UpdateAccountingPeriodStatusDto,
  ) {
    return this.admin.updateAccountingPeriodStatus(periodId, dto);
  }
}

