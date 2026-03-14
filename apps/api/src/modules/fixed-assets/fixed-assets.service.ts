import { Injectable } from '@nestjs/common';
import { Prisma, DepreciationMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssetCategoryDto, CreateAssetDto } from './dto';

@Injectable()
export class FixedAssetsService {
  constructor(private prisma: PrismaService) {}

  async createCategory(dto: CreateAssetCategoryDto) {
    return this.prisma.assetCategory.create({ data: dto });
  }

  async listCategories() {
    return this.prisma.assetCategory.findMany();
  }

  async createAsset(dto: CreateAssetDto) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          name: dto.name,
          tag: dto.tag,
          categoryId: dto.categoryId,
          branchId: dto.branchId,
          acquisitionDate: new Date(dto.acquisitionDate),
          acquisitionCost: new Prisma.Decimal(dto.acquisitionCost),
          residualValue: new Prisma.Decimal(dto.residualValue ?? 0),
          depreciationStart: new Date(dto.acquisitionDate),
        },
      });
      return asset;
    });
  }

  async listAssets() {
    return this.prisma.asset.findMany({ include: { category: true, depreciationLines: true } });
  }
}
