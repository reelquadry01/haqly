import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AssignRoleDto,
  CreateFiscalYearDto,
  CreatePermissionDto,
  CreateRoleDto,
  UpdateAccountingPeriodStatusDto,
} from './admin.dto';

const monthYearFormatter = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async createPermission(dto: CreatePermissionDto) {
    try {
      return await this.prisma.permission.create({ data: dto });
    } catch {
      throw new ConflictException('Permission already exists');
    }
  }

  async createRole(dto: CreateRoleDto) {
    const exists = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Role exists');
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({ data: { name: dto.name, description: dto.description } });
      if (dto.permissions?.length) {
        const perms = await tx.permission.findMany({ where: { code: { in: dto.permissions } } });
        const data = perms.map((permission) => ({ roleId: role.id, permissionId: permission.id }));
        if (data.length) {
          await tx.rolePermission.createMany({ data, skipDuplicates: true });
        }
      }
      return role;
    });
  }

  async assignRoles(userId: number, dto: AssignRoleDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const roles = await this.prisma.role.findMany({ where: { name: { in: dto.roles } } });
    if (!roles.length) throw new NotFoundException('No matching roles');

    await this.prisma.userRole.deleteMany({ where: { userId } });
    await this.prisma.userRole.createMany({
      data: roles.map((role) => ({ userId, roleId: role.id })),
      skipDuplicates: true,
    });

    return { userId, roles: roles.map((role) => role.name) };
  }

  async listFiscalYears(companyId: number) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const fiscalYears = await this.prisma.fiscalYear.findMany({
      where: { companyId },
      include: {
        periods: {
          orderBy: { startDate: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    const now = new Date();

    return fiscalYears.map((fiscalYear) => ({
      ...fiscalYear,
      isCurrent: fiscalYear.startDate <= now && fiscalYear.endDate >= now,
      counts: {
        total: fiscalYear.periods.length,
        open: fiscalYear.periods.filter((period) => period.status === 'OPEN').length,
        closed: fiscalYear.periods.filter((period) => period.status === 'CLOSED').length,
        locked: fiscalYear.periods.filter((period) => period.status === 'LOCKED').length,
      },
    }));
  }

  async createFiscalYear(dto: CreateFiscalYearDto) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const startDate = this.toStartOfDay(dto.startDate);
    const endDate = this.toEndOfDay(dto.endDate);
    this.ensureDateRange(startDate, endDate);
    await this.ensureNoFiscalYearOverlap(dto.companyId, startDate, endDate);

    return this.prisma.$transaction(async (tx) => {
      const fiscalYear = await tx.fiscalYear.create({
        data: {
          companyId: dto.companyId,
          name: dto.name.trim(),
          startDate,
          endDate,
          status: 'OPEN',
        },
      });

      if (dto.generateMonthlyPeriods ?? true) {
        const periods = this.buildMonthlyPeriods(dto.companyId, fiscalYear.id, startDate, endDate);
        if (periods.length) {
          await tx.accountingPeriod.createMany({
            data: periods,
          });
        }
      }

      return tx.fiscalYear.findUnique({
        where: { id: fiscalYear.id },
        include: {
          periods: {
            orderBy: { startDate: 'asc' },
          },
        },
      });
    });
  }

  async closeFiscalYear(fiscalYearId: number, reason?: string) {
    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId },
      include: { periods: { orderBy: { startDate: 'asc' } } },
    });

    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');
    if (fiscalYear.status === 'LOCKED') throw new ConflictException('Locked fiscal years cannot be closed again');
    if (fiscalYear.periods.some((period) => period.status === 'OPEN')) {
      throw new ConflictException(`Close all open periods before closing ${fiscalYear.name}`);
    }

    await this.prisma.fiscalYear.update({
      where: { id: fiscalYearId },
      data: { status: 'CLOSED' },
    });

    return {
      status: 'CLOSED',
      fiscalYearId,
      reason: reason ?? null,
    };
  }

  async lockFiscalYear(fiscalYearId: number, reason?: string) {
    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId },
      include: { periods: true },
    });

    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');
    if (fiscalYear.periods.some((period) => period.status === 'OPEN')) {
      throw new ConflictException(`Close all open periods before locking ${fiscalYear.name}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.accountingPeriod.updateMany({
        where: { fiscalYearId },
        data: { status: 'LOCKED' },
      });

      await tx.fiscalYear.update({
        where: { id: fiscalYearId },
        data: { status: 'LOCKED' },
      });
    });

    return {
      status: 'LOCKED',
      fiscalYearId,
      reason: reason ?? null,
    };
  }

  async updateAccountingPeriodStatus(periodId: number, dto: UpdateAccountingPeriodStatusDto) {
    const period = await this.prisma.accountingPeriod.findUnique({
      where: { id: periodId },
      include: {
        fiscalYear: {
          include: {
            periods: true,
          },
        },
      },
    });

    if (!period) throw new NotFoundException('Accounting period not found');
    if (!period.fiscalYear) throw new BadRequestException('Accounting period is not linked to a fiscal year');
    if (period.fiscalYear.status === 'LOCKED') {
      throw new ConflictException(`Fiscal year ${period.fiscalYear.name} is locked and its periods cannot be changed`);
    }
    if (period.status === 'LOCKED' && dto.status !== 'LOCKED') {
      throw new ConflictException('Locked periods cannot be reopened from this control');
    }

    const updatedPeriod = await this.prisma.accountingPeriod.update({
      where: { id: periodId },
      data: { status: dto.status },
    });

    const periods = period.fiscalYear.periods.map((entry) =>
      entry.id === periodId
        ? {
            ...entry,
            status: dto.status,
          }
        : entry,
    );

    const nextFiscalYearStatus = this.deriveFiscalYearStatus(period.fiscalYear.status, periods.map((entry) => entry.status));
    if (nextFiscalYearStatus !== period.fiscalYear.status) {
      await this.prisma.fiscalYear.update({
        where: { id: period.fiscalYear.id },
        data: { status: nextFiscalYearStatus },
      });
    }

    return {
      ...updatedPeriod,
      fiscalYearStatus: nextFiscalYearStatus,
      reason: dto.reason ?? null,
    };
  }

  private toStartOfDay(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid start date');
    }
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private toEndOfDay(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid end date');
    }
    date.setUTCHours(23, 59, 59, 999);
    return date;
  }

  private ensureDateRange(startDate: Date, endDate: Date) {
    if (startDate >= endDate) {
      throw new BadRequestException('Fiscal year end date must be after the start date');
    }
  }

  private async ensureNoFiscalYearOverlap(companyId: number, startDate: Date, endDate: Date) {
    const overlap = await this.prisma.fiscalYear.findFirst({
      where: {
        companyId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlap) {
      throw new ConflictException(`Fiscal year overlaps with ${overlap.name}. Adjust the dates or close the existing range first.`);
    }
  }

  private buildMonthlyPeriods(companyId: number, fiscalYearId: number, startDate: Date, endDate: Date) {
    const periods: Array<{
      companyId: number;
      fiscalYearId: number;
      name: string;
      startDate: Date;
      endDate: Date;
      status: string;
    }> = [];

    let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    let isFirst = true;

    while (cursor <= endDate) {
      const periodStart = isFirst ? new Date(startDate) : new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
      const nextMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      const periodEnd = new Date(Math.min(new Date(endDate).getTime(), nextMonth.getTime() - 1));
      periods.push({
        companyId,
        fiscalYearId,
        name: monthYearFormatter.format(periodStart),
        startDate: periodStart,
        endDate: periodEnd,
        status: 'OPEN',
      });
      cursor = nextMonth;
      isFirst = false;
    }

    return periods;
  }

  private deriveFiscalYearStatus(currentStatus: string, periodStatuses: string[]) {
    if (periodStatuses.length && periodStatuses.every((status) => status === 'LOCKED')) {
      return 'LOCKED';
    }
    if (periodStatuses.length && periodStatuses.every((status) => status !== 'OPEN')) {
      return 'CLOSED';
    }
    if (currentStatus === 'LOCKED') {
      return 'LOCKED';
    }
    return 'OPEN';
  }

  async upsertSettings(companyId: number, data: {
    mfaAdmins?: boolean;
    mfaApprovers?: boolean;
    sessionTimeout?: number;
    failedAttempts?: number;
    emailApprovals?: boolean;
    failedLoginAlerts?: boolean;
  }) {
    return this.prisma.companySettings.upsert({
      where: { companyId },
      update: { ...data, updatedAt: new Date() },
      create: { companyId, ...data },
    });
  }

  async getSettings(companyId: number) {
    return this.prisma.companySettings.findUnique({ where: { companyId } });
  }

  async createApprovalRule(data: {
    companyId: number;
    module: string;
    transaction: string;
    approvers: string;
    range: string;
  }) {
    return this.prisma.approvalRule.create({ data });
  }

  async listApprovalRules(companyId: number) {
    return this.prisma.approvalRule.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }
}