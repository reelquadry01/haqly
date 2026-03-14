import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDepPolicyDto, RunDepreciationDto } from './dto';

@Injectable()
export class DepreciationService {
  constructor(private prisma: PrismaService) {}

  async createPolicy(dto: CreateDepPolicyDto) {
    return this.prisma.depreciationPolicy.create({ data: dto });
  }

  async listPolicies() {
    return this.prisma.depreciationPolicy.findMany();
  }

  async run(dto: RunDepreciationDto) {
    const book = dto.book || 'book';
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.depreciationRun.create({
        data: {
          periodStart: new Date(dto.periodStart),
          periodEnd: new Date(dto.periodEnd),
          book,
          status: 'POSTED',
        },
      });

      const assets = await tx.asset.findMany({ include: { category: true } });
      for (const asset of assets) {
        const lifeMonths = asset.category.usefulLifeMonths;
        const method = asset.category.depreciationMethod;
        // simple straight-line only for now
        if (method !== 'STRAIGHT_LINE') continue;
        const monthly = Number(asset.acquisitionCost) / lifeMonths;
        await tx.depreciationLine.create({
          data: {
            runId: run.id,
            assetId: asset.id,
            amount: new Prisma.Decimal(monthly),
            accumulated: new Prisma.Decimal(monthly),
            periodStart: new Date(dto.periodStart),
            periodEnd: new Date(dto.periodEnd),
          },
        });
      }
      return tx.depreciationRun.findUnique({ where: { id: run.id }, include: { lines: true } });
    });
  }
}
