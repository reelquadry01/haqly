import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OrgService } from './org.service';
import { CreateBranchDto, CreateCompanyDto, CloneCompanyDto, UpdateCompanyDto } from './org.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN')
@Controller({ path: 'org', version: '1' })
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @Post('companies')
  @RequirePermissions('org:create')
  createCompany(@Body() dto: CreateCompanyDto) {
    return this.org.createCompany(dto);
  }

  @Get('companies')
  @RequirePermissions('org:view')
  listCompanies(@Query('includeInactive') includeInactive?: string) {
    return this.org.listCompanies(includeInactive === 'true');
  }

  @Patch('companies/:companyId')
  @RequirePermissions('org:create')
  updateCompany(@Param('companyId', ParseIntPipe) companyId: number, @Body() dto: UpdateCompanyDto) {
    return this.org.updateCompany(companyId, dto);
  }

  @Post('companies/:companyId/branches')
  @RequirePermissions('org:create')
  createBranch(@Param('companyId', ParseIntPipe) companyId: number, @Body() dto: CreateBranchDto) {
    return this.org.createBranch(companyId, dto);
  }

  @Post('companies/:companyId/clone')
  @RequirePermissions('org:create')
  cloneCompany(@Param('companyId', ParseIntPipe) companyId: number, @Body() dto: CloneCompanyDto) {
    return this.org.cloneCompany(companyId, dto);
  }
}

