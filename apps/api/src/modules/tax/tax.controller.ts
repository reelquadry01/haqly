import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';
import { CreateTaxConfigDto, ListTaxConfigsDto, TaxReportQueryDto, UpdateTaxConfigDto } from './dto';
import { TaxService } from './tax.service';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'FINANCE')
@Controller({ path: 'tax', version: '1' })
export class TaxController {
  constructor(private readonly tax: TaxService) {}

  @Get('configs')
  @RequirePermissions('org:view')
  listConfigs(@Query() query: ListTaxConfigsDto) {
    return this.tax.listConfigs(query.companyId);
  }

  @Post('configs')
  @RequirePermissions('org:create')
  createConfig(@Body() dto: CreateTaxConfigDto) {
    return this.tax.createConfig(dto);
  }

  @Patch('configs/:id')
  @RequirePermissions('org:create')
  updateConfig(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaxConfigDto) {
    return this.tax.updateConfig(id, dto);
  }

  @Get('dashboard')
  @RequirePermissions('org:view')
  dashboard(@Query() query: TaxReportQueryDto) {
    return this.tax.getDashboard(query);
  }

  @Get('activity')
  @RequirePermissions('org:view')
  activity(@Query() query: TaxReportQueryDto) {
    return this.tax.getActivity(query);
  }
}

