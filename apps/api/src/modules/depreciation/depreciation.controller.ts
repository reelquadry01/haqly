import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DepreciationService } from './depreciation.service';
import { CreateDepPolicyDto, RunDepreciationDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'FINANCE')
@Controller({ path: 'depreciation', version: '1' })
export class DepreciationController {
  constructor(private readonly svc: DepreciationService) {}

  @Post('policies')
  @RequirePermissions('depreciation:policy')
  createPolicy(@Body() dto: CreateDepPolicyDto) {
    return this.svc.createPolicy(dto);
  }

  @Get('policies')
  @RequirePermissions('depreciation:policy')
  listPolicies() {
    return this.svc.listPolicies();
  }

  @Post('runs')
  @RequirePermissions('depreciation:run')
  run(@Body() dto: RunDepreciationDto) {
    return this.svc.run(dto);
  }
}

