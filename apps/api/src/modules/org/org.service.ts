import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchDto, CreateCompanyDto, CloneCompanyDto, UpdateCompanyDto } from './org.dto';

@Injectable()
export class OrgService {
  constructor(private prisma: PrismaService) {}

  private normalizeCode(input: string) {
    return input.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();
  }

  private async resolveCurrencyId(currencyCode?: string) {
    if (!currencyCode?.trim()) {
      return null;
    }

    const currency = await this.prisma.currency.findUnique({
      where: { code: currencyCode.trim().toUpperCase() },
    });

    if (!currency) {
      throw new BadRequestException(`Currency code ${currencyCode.trim().toUpperCase()} is not configured.`);
    }

    return currency.id;
  }

  private getFiscalYearWindow(startMonth: number) {
    const month = Math.min(Math.max(startMonth || 1, 1), 12);
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    const fiscalYearStartYear = currentMonth >= month ? currentYear : currentYear - 1;
    const startDate = new Date(Date.UTC(fiscalYearStartYear, month - 1, 1));
    const endDate = new Date(Date.UTC(fiscalYearStartYear + 1, month - 1, 0, 23, 59, 59, 999));
    const name = month === 1 ? `FY${fiscalYearStartYear}` : `FY${fiscalYearStartYear}/${fiscalYearStartYear + 1}`;

    return { name, startDate, endDate };
  }

  private buildMonthlyPeriods(companyId: number, fiscalYearId: number, startDate: Date) {
    return Array.from({ length: 12 }, (_, index) => {
      const periodStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + index, 1));
      const periodEnd = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + index + 1, 0, 23, 59, 59, 999));
      const name = periodStart.toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

      return {
        companyId,
        fiscalYearId,
        name,
        startDate: periodStart,
        endDate: periodEnd,
        status: 'OPEN',
      };
    });
  }

  private companyInclude = {
    branches: {
      orderBy: { name: 'asc' as const },
    },
    currency: true,
    fiscalYears: {
      orderBy: { startDate: 'desc' as const },
      take: 1,
    },
  };

  async createCompany(dto: CreateCompanyDto) {
    const code = this.normalizeCode(dto.code);
    if (!code) {
      throw new BadRequestException('Company code is required.');
    }

    const existingCompany = await this.prisma.company.findFirst({
      where: {
        OR: [{ code }, { name: dto.name.trim() }],
      },
    });
    if (existingCompany?.code === code) {
      throw new ConflictException(`Company code ${code} is already in use.`);
    }
    if (existingCompany?.name.toLowerCase() === dto.name.trim().toLowerCase()) {
      throw new ConflictException(`Company name ${dto.name.trim()} is already in use.`);
    }

    const currencyId = await this.resolveCurrencyId(dto.currencyCode ?? 'NGN');
    const fiscalYearStartMonth = dto.fiscalYearStartMonth ?? 1;
    const fiscalYearWindow = this.getFiscalYearWindow(fiscalYearStartMonth);

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.name.trim(),
          legalName: dto.legalName?.trim() || dto.name.trim(),
          code,
          registrationNumber: dto.registrationNumber?.trim() || null,
          taxId: dto.taxId?.trim() || null,
          email: dto.email?.trim() || null,
          phone: dto.phone?.trim() || null,
          addressLine1: dto.addressLine1?.trim() || null,
          addressLine2: dto.addressLine2?.trim() || null,
          city: dto.city?.trim() || null,
          state: dto.state?.trim() || null,
          country: dto.country?.trim() || null,
          logoUrl: dto.logoUrl?.trim() || null,
          currencyId: currencyId ?? undefined,
          timezone: dto.timezone?.trim() || 'Africa/Lagos',
          fiscalYearStartMonth,
          isActive: dto.isActive ?? true,
          useBranches: dto.useBranches ?? true,
          useInventory: dto.useInventory ?? true,
          usePayroll: dto.usePayroll ?? false,
          useDepartments: dto.useDepartments ?? true,
        },
      });

      const defaultBranchCode = this.normalizeCode(dto.defaultBranchCode?.trim() || `${code}-HQ`);
      const branch = await tx.branch.create({
        data: {
          companyId: company.id,
          name: dto.defaultBranchName?.trim() || 'Head Office',
          code: defaultBranchCode || `${code}-${company.id}`,
        },
      });

      if (dto.useInventory ?? true) {
        await tx.warehouse.create({
          data: {
            branchId: branch.id,
            name: 'Main Warehouse',
          },
        });
      }

      if (dto.useDepartments ?? true) {
        await tx.department.create({
          data: {
            companyId: company.id,
            name: 'Administration',
          },
        });
      }

      const fiscalYear = await tx.fiscalYear.create({
        data: {
          companyId: company.id,
          name: fiscalYearWindow.name,
          startDate: fiscalYearWindow.startDate,
          endDate: fiscalYearWindow.endDate,
          status: 'OPEN',
        },
      });

      await tx.accountingPeriod.createMany({
        data: this.buildMonthlyPeriods(company.id, fiscalYear.id, fiscalYearWindow.startDate),
      });

      await tx.numberingSequence.createMany({
        data: [
          { companyId: company.id, name: 'Invoice', prefix: `INV-${code}-`, nextNumber: 1 },
          { companyId: company.id, name: 'Voucher', prefix: `VCH-${code}-`, nextNumber: 1 },
          { companyId: company.id, name: 'Purchase Order', prefix: `PO-${code}-`, nextNumber: 1 },
        ],
      });

      return tx.company.findUniqueOrThrow({
        where: { id: company.id },
        include: this.companyInclude,
      });
    });
  }

  async listCompanies(includeInactive = false) {
    return this.prisma.company.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: this.companyInclude,
      orderBy: { name: 'asc' },
    });
  }

  async createBranch(companyId: number, dto: CreateBranchDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const branchCode = this.normalizeCode(dto.code);
    if (!branchCode) {
      throw new BadRequestException('Branch code is required.');
    }

    const exists = await this.prisma.branch.findUnique({ where: { code: branchCode } });
    if (exists) throw new ConflictException('Branch code in use');

    return this.prisma.branch.create({
      data: { name: dto.name.trim(), code: branchCode, companyId },
    });
  }

  async updateCompany(companyId: number, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const nextCode = dto.code ? this.normalizeCode(dto.code) : undefined;
    if (nextCode && nextCode !== company.code) {
      const existing = await this.prisma.company.findFirst({
        where: {
          code: nextCode,
          id: { not: companyId },
        },
      });
      if (existing) {
        throw new ConflictException(`Company code ${nextCode} is already in use.`);
      }
    }

    const currencyId = dto.currencyCode ? await this.resolveCurrencyId(dto.currencyCode) : undefined;

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: dto.name?.trim() ?? undefined,
        legalName: dto.legalName?.trim() ?? undefined,
        code: nextCode ?? undefined,
        registrationNumber: dto.registrationNumber?.trim() ?? undefined,
        taxId: dto.taxId?.trim() ?? undefined,
        email: dto.email?.trim() ?? undefined,
        phone: dto.phone?.trim() ?? undefined,
        addressLine1: dto.addressLine1?.trim() ?? undefined,
        addressLine2: dto.addressLine2?.trim() ?? undefined,
        city: dto.city?.trim() ?? undefined,
        state: dto.state?.trim() ?? undefined,
        country: dto.country?.trim() ?? undefined,
        logoUrl: dto.logoUrl?.trim() ?? undefined,
        timezone: dto.timezone?.trim() ?? undefined,
        fiscalYearStartMonth: dto.fiscalYearStartMonth ?? undefined,
        isActive: dto.isActive ?? undefined,
        useBranches: dto.useBranches ?? undefined,
        useInventory: dto.useInventory ?? undefined,
        usePayroll: dto.usePayroll ?? undefined,
        useDepartments: dto.useDepartments ?? undefined,
        currencyId,
      },
      include: this.companyInclude,
    });
  }

  async cloneCompany(sourceCompanyId: number, dto: CloneCompanyDto) {
    const source = await this.prisma.company.findUnique({
      where: { id: sourceCompanyId },
      include: { branches: true },
    });
    if (!source) throw new NotFoundException('Source company not found');

    const generatedCode = this.normalizeCode(dto.code || dto.name.slice(0, 10));
    if (!generatedCode) {
      throw new BadRequestException('A valid company code could not be generated for the clone.');
    }

    const duplicate = await this.prisma.company.findFirst({ where: { code: generatedCode } });
    if (duplicate) {
      throw new ConflictException(`Company code ${generatedCode} is already in use.`);
    }

    const newCompany = await this.createCompany({
      name: dto.name,
      code: generatedCode,
      legalName: source.legalName ?? source.name,
      registrationNumber: source.registrationNumber ?? undefined,
      taxId: source.taxId ?? undefined,
      email: source.email ?? undefined,
      phone: source.phone ?? undefined,
      addressLine1: source.addressLine1 ?? undefined,
      addressLine2: source.addressLine2 ?? undefined,
      city: source.city ?? undefined,
      state: source.state ?? undefined,
      country: source.country ?? undefined,
      currencyCode:
        source.currencyId != null
          ? (await this.prisma.currency.findUnique({ where: { id: source.currencyId } }))?.code
          : undefined,
      logoUrl: source.logoUrl ?? undefined,
      timezone: source.timezone ?? undefined,
      fiscalYearStartMonth: source.fiscalYearStartMonth ?? undefined,
      isActive: source.isActive,
      useBranches: source.useBranches,
      useInventory: source.useInventory,
      usePayroll: source.usePayroll,
      useDepartments: source.useDepartments,
      defaultBranchName: source.branches[0]?.name ?? 'Head Office',
      defaultBranchCode: dto.branchCodePrefix ? `${dto.branchCodePrefix}-HQ` : undefined,
    });

    const branchCodePrefix = this.normalizeCode(dto.branchCodePrefix || generatedCode);
    const existingTargetBranches = newCompany.branches;
    const branchMap: Record<number, number> = {};

    for (let index = 0; index < source.branches.length; index += 1) {
      const sourceBranch = source.branches[index];
      if (index === 0 && existingTargetBranches[0]) {
        branchMap[sourceBranch.id] = existingTargetBranches[0].id;
        continue;
      }

      const createdBranch = await this.prisma.branch.create({
        data: {
          name: sourceBranch.name,
          code: `${branchCodePrefix}-${sourceBranch.code}`,
          companyId: newCompany.id,
        },
      });
      branchMap[sourceBranch.id] = createdBranch.id;
    }

    const warehouses = await this.prisma.warehouse.findMany({
      where: { branchId: { in: source.branches.map((branch) => branch.id) } },
    });
    for (const warehouse of warehouses) {
      const nextBranchId = branchMap[warehouse.branchId];
      if (!nextBranchId) continue;
      const exists = await this.prisma.warehouse.findFirst({
        where: { branchId: nextBranchId, name: warehouse.name },
      });
      if (!exists) {
        await this.prisma.warehouse.create({
          data: {
            name: warehouse.name,
            branchId: nextBranchId,
          },
        });
      }
    }

    return {
      company: newCompany,
      branchesCloned: source.branches.length,
      productsCloned: 0,
      customersCloned: 0,
      suppliersCloned: 0,
    };
  }
}
