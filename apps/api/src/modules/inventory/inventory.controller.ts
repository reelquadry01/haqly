import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateProductDto, CreateWarehouseDto, StockMoveDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'FINANCE', 'WAREHOUSE')
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Post('products')
  @RequirePermissions('inventory:view')
  createProduct(@Body() dto: CreateProductDto) {
    return this.svc.createProduct(dto);
  }

  @Get('products')
  @RequirePermissions('inventory:view')
  listProducts(@Query('companyId') companyId?: string) {
    return this.svc.listProducts(companyId ? Number(companyId) : undefined);
  }

  @Post('warehouses')
  @RequirePermissions('inventory:view')
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.svc.createWarehouse(dto);
  }

  @Get('warehouses')
  @RequirePermissions('inventory:view')
  listWarehouses(@Query('companyId') companyId?: string) {
    return this.svc.listWarehouses(companyId ? Number(companyId) : undefined);
  }

  @Post('stock-movements')
  @RequirePermissions('inventory:view')
  moveStock(@Body() dto: StockMoveDto) {
    return this.svc.moveStock(dto);
  }

  @Get('stock-levels')
  @RequirePermissions('inventory:view')
  stockLevels(@Query('productId') productId?: string, @Query('companyId') companyId?: string) {
    const pid = productId ? parseInt(productId, 10) : undefined;
    const cid = companyId ? parseInt(companyId, 10) : undefined;
    return this.svc.stockLevels(pid, cid);
  }

  @Get('stock-movements')
  @RequirePermissions('inventory:view')
  listStockMovements(@Query('companyId') companyId?: string) {
    return this.svc.listStockMovements(companyId ? Number(companyId) : undefined);
  }
}
