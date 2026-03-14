import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { FixedAssetsService } from './fixed-assets.service';
import { CreateAssetCategoryDto, CreateAssetDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'FINANCE')
@Controller({ path: 'fixed-assets', version: '1' })
export class FixedAssetsController {
  constructor(private readonly svc: FixedAssetsService) {}

  @Post('categories')
  @RequirePermissions('fixed_assets:create')
  createCategory(@Body() dto: CreateAssetCategoryDto) {
    return this.svc.createCategory(dto);
  }

  @Get('categories')
  @RequirePermissions('fixed_assets:view')
  listCategories() {
    return this.svc.listCategories();
  }

  @Post('assets')
  @RequirePermissions('fixed_assets:create')
  createAsset(@Body() dto: CreateAssetDto) {
    return this.svc.createAsset(dto);
  }

  @Get('assets')
  @RequirePermissions('fixed_assets:view')
  listAssets() {
    return this.svc.listAssets();
  }
}

