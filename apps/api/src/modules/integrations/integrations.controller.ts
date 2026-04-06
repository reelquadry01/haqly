import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN')
@Controller({ path: 'integrations', version: '1' })
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  @Post()
  @RequirePermissions('integrations:manage')
  create(@Body() dto: CreateIntegrationDto) {
    return this.svc.create(dto);
  }

  @Get()
  @RequirePermissions('integrations:view')
  list(@Query('companyId') companyId?: string) {
    return this.svc.list(companyId ? Number(companyId) : undefined);
  }

  @Get(':id')
  @RequirePermissions('integrations:view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.svc.get(id);
  }

  @Patch(':id')
  @RequirePermissions('integrations:manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIntegrationDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/sync')
  @RequirePermissions('integrations:manage')
  sync(@Param('id', ParseIntPipe) id: number) {
    return this.svc.sync(id);
  }

  @Delete(':id')
  @RequirePermissions('integrations:manage')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
