import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaxConfigDto, TaxReportQueryDto, UpdateTaxConfigDto } from './dto';

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  async listConfigs(companyId: number) {
    return this.prisma.taxConfig.findMany({
      where: { companyId },
      include: {
        company: true,
        outputAccount: true,
        inputAccount: true,
        liabilityAccount: true,
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createConfig(dto: CreateTaxConfigDto) {
    await this.ensureCompany(dto.companyId);
    await this.ensureUniqueCode(dto.companyId, dto.code);
    await this.validateAccountReferences(dto);

    return this.prisma.taxConfig.create({
      data: {
        companyId: dto.companyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        taxType: dto.taxType?.trim().toUpperCase() ?? 'VAT',
        rate: dto.rate.toFixed(4),
        isInclusive: dto.isInclusive,
        recoverable: dto.recoverable ?? false,
        filingFrequency: dto.filingFrequency?.trim().toUpperCase() ?? 'MONTHLY',
        outputAccountId: dto.outputAccountId,
        inputAccountId: dto.inputAccountId,
        liabilityAccountId: dto.liabilityAccountId,
      },
      include: {
        company: true,
        outputAccount: true,
        inputAccount: true,
        liabilityAccount: true,
      },
    });
  }

  async updateConfig(id: number, dto: UpdateTaxConfigDto) {
    const existing = await this.prisma.taxConfig.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Tax rule not found');
    }

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      await this.ensureUniqueCode(existing.companyId, dto.code, id);
    }

    await this.validateAccountReferences(dto);

    return this.prisma.taxConfig.update({
      where: { id },
      data: {
        code: dto.code?.trim().toUpperCase(),
        name: dto.name?.trim(),
        taxType: dto.taxType?.trim().toUpperCase(),
        rate: dto.rate !== undefined ? dto.rate.toFixed(4) : undefined,
        isInclusive: dto.isInclusive ?? undefined,
        recoverable: dto.recoverable ?? undefined,
        filingFrequency: dto.filingFrequency?.trim().toUpperCase(),
        outputAccountId: dto.outputAccountId ?? undefined,
        inputAccountId: dto.inputAccountId ?? undefined,
        liabilityAccountId: dto.liabilityAccountId ?? undefined,
      },
      include: {
        company: true,
        outputAccount: true,
        inputAccount: true,
        liabilityAccount: true,
      },
    });
  }

  async getDashboard(query: TaxReportQueryDto) {
    const configs = await this.prisma.taxConfig.findMany({
      where: { companyId: query.companyId },
      include: {
        outputAccount: true,
        inputAccount: true,
        liabilityAccount: true,
      },
      orderBy: [{ name: 'asc' }],
    });

    const dateFilter = this.buildDateFilter(query.from, query.to);
    const accountIds = [...new Set(
      configs.flatMap((config) => [config.outputAccountId, config.inputAccountId, config.liabilityAccountId].filter(Boolean) as number[]),
    )];

    const activity = accountIds.length
      ? await this.prisma.journalLine.findMany({
          where: {
            accountId: { in: accountIds },
            entry: dateFilter ? { date: dateFilter } : undefined,
          },
          include: {
            account: true,
            entry: true,
          },
          orderBy: [{ entry: { date: 'desc' } }, { id: 'desc' }],
        })
      : [];

    const rows = configs.map((config) => {
      const outputMovement = activity
        .filter((line) => line.accountId === config.outputAccountId)
        .reduce((sum, line) => sum + Number(line.credit) - Number(line.debit), 0);
      const inputMovement = activity
        .filter((line) => line.accountId === config.inputAccountId)
        .reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0);
      const liabilityMovement = activity
        .filter((line) => line.accountId === config.liabilityAccountId)
        .reduce((sum, line) => sum + Number(line.credit) - Number(line.debit), 0);

      return {
        id: config.id,
        code: config.code,
        name: config.name,
        taxType: config.taxType,
        rate: Number(config.rate),
        isInclusive: config.isInclusive,
        recoverable: config.recoverable,
        filingFrequency: config.filingFrequency,
        outputTax: outputMovement,
        inputTax: inputMovement,
        netTax: outputMovement - inputMovement,
        liabilityBalance: liabilityMovement || outputMovement - inputMovement,
      };
    });

    const totals = rows.reduce(
      (sum, row) => ({
        outputTax: sum.outputTax + row.outputTax,
        inputTax: sum.inputTax + row.inputTax,
        netTax: sum.netTax + row.netTax,
        liabilityBalance: sum.liabilityBalance + row.liabilityBalance,
      }),
      { outputTax: 0, inputTax: 0, netTax: 0, liabilityBalance: 0 },
    );

    return {
      companyId: query.companyId,
      from: query.from ?? null,
      to: query.to ?? null,
      configs: rows,
      totals,
      calendar: rows.map((row) => ({
        code: row.code,
        name: row.name,
        filingFrequency: row.filingFrequency,
        nextDueDate: this.calculateDueDate(query.to),
        status: row.netTax > 0 ? 'DUE' : 'IN_REVIEW',
      })),
    };
  }

  async getActivity(query: TaxReportQueryDto) {
    const configs = await this.prisma.taxConfig.findMany({
      where: { companyId: query.companyId },
      select: {
        code: true,
        name: true,
        outputAccountId: true,
        inputAccountId: true,
        liabilityAccountId: true,
      },
    });

    const accountToTax = new Map<number, { code: string; name: string; side: string }>();
    for (const config of configs) {
      if (config.outputAccountId) accountToTax.set(config.outputAccountId, { code: config.code, name: config.name, side: 'OUTPUT' });
      if (config.inputAccountId) accountToTax.set(config.inputAccountId, { code: config.code, name: config.name, side: 'INPUT' });
      if (config.liabilityAccountId) accountToTax.set(config.liabilityAccountId, { code: config.code, name: config.name, side: 'LIABILITY' });
    }

    const accountIds = [...accountToTax.keys()];
    if (!accountIds.length) {
      return [];
    }

    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: { in: accountIds },
        entry: this.buildDateFilter(query.from, query.to) ? { date: this.buildDateFilter(query.from, query.to) } : undefined,
      },
      include: {
        account: true,
        entry: true,
      },
      orderBy: [{ entry: { date: 'desc' } }, { id: 'desc' }],
      take: 100,
    });

    return lines.map((line) => {
      const mapping = accountToTax.get(line.accountId);
      return {
        id: line.id,
        date: line.entry.date.toISOString(),
        reference: line.entry.reference,
        description: line.entry.description ?? line.entry.type,
        taxCode: mapping?.code ?? 'UNMAPPED',
        taxName: mapping?.name ?? line.account.name,
        bucket: mapping?.side ?? 'UNCLASSIFIED',
        account: `${line.account.code} - ${line.account.name}`,
        debit: Number(line.debit),
        credit: Number(line.credit),
        net: Number(line.credit) - Number(line.debit),
        memo: line.memo ?? '',
      };
    });
  }

  private async ensureCompany(companyId: number) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
  }

  private async ensureUniqueCode(companyId: number, code: string, excludeId?: number) {
    const existing = await this.prisma.taxConfig.findFirst({
      where: {
        companyId,
        code: code.trim().toUpperCase(),
        id: excludeId ? { not: excludeId } : undefined,
      },
    });

    if (existing) {
      throw new ConflictException('Tax rule with this code already exists for the company');
    }
  }

  private async validateAccountReferences(dto: {
    outputAccountId?: number;
    inputAccountId?: number;
    liabilityAccountId?: number;
  }) {
    const accountIds = [dto.outputAccountId, dto.inputAccountId, dto.liabilityAccountId].filter(Boolean) as number[];
    if (!accountIds.length) {
      return;
    }

    const accounts = await this.prisma.account.findMany({ where: { id: { in: accountIds } } });
    if (accounts.length !== accountIds.length) {
      throw new NotFoundException('One or more tax accounts could not be found');
    }
  }

  private buildDateFilter(from?: string, to?: string) {
    const gte = from ? new Date(`${from}T00:00:00.000Z`) : undefined;
    const lte = to ? new Date(`${to}T23:59:59.999Z`) : undefined;

    if (!gte && !lte) {
      return undefined;
    }

    return {
      ...(gte ? { gte } : {}),
      ...(lte ? { lte } : {}),
    };
  }

  private calculateDueDate(to?: string) {
    const base = to ? new Date(`${to}T00:00:00.000Z`) : new Date();
    const due = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 21));
    return due.toISOString();
  }
}
