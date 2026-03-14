import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto, CreateWarehouseDto, StockMoveDto } from './dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async createProduct(dto: CreateProductDto) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) {
      throw new BadRequestException('Company does not exist.');
    }
    return this.prisma.product.create({ data: dto });
  }

  async listProducts(companyId?: number) {
    return this.prisma.product.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { id: 'desc' },
    });
  }

  async createWarehouse(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: dto });
  }

  async listWarehouses(companyId?: number) {
    return this.prisma.warehouse.findMany({
      where: companyId ? { branch: { companyId } } : undefined,
      include: { branch: true },
    });
  }

  async listStockMovements(companyId?: number) {
    return this.prisma.stockMovement.findMany({
      where: companyId ? { warehouse: { branch: { companyId } } } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        product: true,
        warehouse: {
          include: {
            branch: true,
          },
        },
      },
    });
  }

  async moveStock(dto: StockMoveDto) {
    if (dto.quantity <= 0) throw new BadRequestException('Quantity must be positive');
    return this.prisma.$transaction(async (tx) => {
      const [product, warehouse] = await Promise.all([
        tx.product.findUnique({ where: { id: dto.productId } }),
        tx.warehouse.findUnique({ where: { id: dto.warehouseId }, include: { branch: true } }),
      ]);

      if (!product) {
        throw new BadRequestException('Product does not exist.');
      }
      if (!warehouse) {
        throw new BadRequestException('Warehouse does not exist.');
      }
      if (product.companyId !== warehouse.branch.companyId) {
        throw new BadRequestException('Product does not belong to the selected company or warehouse.');
      }

      let movementId: number;
      if (dto.direction === 'OUT') {
        const balance = await tx.stockMovement.aggregate({
          where: { productId: dto.productId, warehouseId: dto.warehouseId },
          _sum: { quantity: true },
        });
        const current = Number(balance._sum.quantity || 0);
        if (current < dto.quantity) throw new BadRequestException('Insufficient stock');
        const movement = await tx.stockMovement.create({
          data: { ...dto, quantity: new Prisma.Decimal(-dto.quantity) },
        });
        movementId = movement.id;
      } else {
        const movement = await tx.stockMovement.create({ data: { ...dto, quantity: new Prisma.Decimal(dto.quantity) } });
        movementId = movement.id;
      }
      return tx.stockMovement.findUniqueOrThrow({
        where: { id: movementId },
        include: {
          product: true,
          warehouse: {
            include: {
              branch: true,
            },
          },
        },
      });
    });
  }

  async stockLevels(productId?: number, companyId?: number) {
    return this.prisma.stockMovement.groupBy({
      by: ['productId', 'warehouseId'],
      where: {
        ...(productId ? { productId } : {}),
        ...(companyId ? { warehouse: { branch: { companyId } } } : {}),
      },
      _sum: { quantity: true },
    });
  }
}
