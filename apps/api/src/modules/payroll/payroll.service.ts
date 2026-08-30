import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AddPayrollLineDto,
  ApprovePayrollRunDto,
  CreateEmployeeDto,
  CreatePayrollRunDto,
  UpdateEmployeeDto,
} from './dto';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  // ── Employees ──────────────────────────────────────────────────────────────

  async createEmployee(dto: CreateEmployeeDto) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new BadRequestException('Company not found.');

    return this.prisma.employee.create({
      data: {
        companyId: dto.companyId,
        employeeNo: dto.employeeNo,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        jobTitle: dto.jobTitle,
        departmentId: dto.departmentId,
        branchId: dto.branchId,
        grossSalary: new Prisma.Decimal(dto.grossSalary),
        currency: dto.currency ?? 'NGN',
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async listEmployees(companyId?: number) {
    return this.prisma.employee.findMany({
      where: companyId ? { companyId } : undefined,
      include: {
        department: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ companyId: 'asc' }, { employeeNo: 'asc' }],
    });
  }

  async getEmployee(id: number) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        branch: true,
        payrollLines: {
          include: { run: true },
          orderBy: { id: 'desc' },
          take: 12,
        },
      },
    });
    if (!emp) throw new NotFoundException('Employee not found.');
    return emp;
  }

  async updateEmployee(id: number, dto: UpdateEmployeeDto) {
    await this.getEmployee(id);
    return this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.branchId !== undefined && { branchId: dto.branchId }),
        ...(dto.grossSalary !== undefined && { grossSalary: new Prisma.Decimal(dto.grossSalary) }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  // ── Payroll Runs ───────────────────────────────────────────────────────────

  async createRun(dto: CreatePayrollRunDto) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new BadRequestException('Company not found.');

    return this.prisma.payrollRun.create({
      data: {
        companyId: dto.companyId,
        period: dto.period,
        payDate: new Date(dto.payDate),
        note: dto.note,
      },
    });
  }

  async listRuns(companyId?: number) {
    return this.prisma.payrollRun.findMany({
      where: companyId ? { companyId } : undefined,
      include: {
        _count: { select: { lines: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  async getRun(id: number) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            employee: {
              select: { id: true, employeeNo: true, firstName: true, lastName: true, jobTitle: true },
            },
          },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found.');
    return run;
  }

  async addLine(runId: number, dto: AddPayrollLineDto) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('Payroll run not found.');
    if (run.status !== 'DRAFT') throw new BadRequestException('Only DRAFT runs can be edited.');

    const taxDeduction = dto.taxDeduction ?? 0;
    const otherDeductions = dto.otherDeductions ?? 0;
    const netPay = dto.grossPay - taxDeduction - otherDeductions;
    if (netPay < 0) throw new BadRequestException('Net pay cannot be negative.');

    return this.prisma.payrollRunLine.upsert({
      where: { runId_employeeId: { runId, employeeId: dto.employeeId } },
      create: {
        runId,
        employeeId: dto.employeeId,
        grossPay: new Prisma.Decimal(dto.grossPay),
        taxDeduction: new Prisma.Decimal(taxDeduction),
        otherDeductions: new Prisma.Decimal(otherDeductions),
        netPay: new Prisma.Decimal(netPay),
      },
      update: {
        grossPay: new Prisma.Decimal(dto.grossPay),
        taxDeduction: new Prisma.Decimal(taxDeduction),
        otherDeductions: new Prisma.Decimal(otherDeductions),
        netPay: new Prisma.Decimal(netPay),
      },
    });
  }

  async submitRun(id: number) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Payroll run not found.');
    if (run.status !== 'DRAFT') throw new BadRequestException('Only DRAFT runs can be submitted.');
    return this.prisma.payrollRun.update({ where: { id }, data: { status: 'SUBMITTED' } });
  }

  async approveRun(id: number, dto: ApprovePayrollRunDto) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Payroll run not found.');
    if (run.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED runs can be approved.');
    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: dto.approvedBy },
    });
  }

  async postRun(id: number) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Payroll run not found.');
    if (run.status !== 'APPROVED') throw new BadRequestException('Only APPROVED runs can be posted.');
    return this.prisma.payrollRun.update({ where: { id }, data: { status: 'POSTED' } });
  }
}
