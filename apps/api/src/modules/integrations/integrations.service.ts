import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateIntegrationDto) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new BadRequestException('Company not found.');

    return this.prisma.integration.create({
      data: {
        companyId: dto.companyId,
        provider: dto.provider.toUpperCase(),
        label: dto.label,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async list(companyId?: number) {
    return this.prisma.integration.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: [{ companyId: 'asc' }, { provider: 'asc' }],
    });
  }

  async get(id: number) {
    const integration = await this.prisma.integration.findUnique({ where: { id } });
    if (!integration) throw new NotFoundException('Integration not found.');
    return integration;
  }

  async update(id: number, dto: UpdateIntegrationDto) {
    await this.get(id);
    return this.prisma.integration.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.config !== undefined && { config: dto.config as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async sync(id: number) {
    await this.get(id);
    return this.prisma.integration.update({
      where: { id },
      data: { lastSyncedAt: new Date() },
    });
  }

  async remove(id: number) {
    await this.get(id);
    return this.prisma.integration.delete({ where: { id } });
  }
}
