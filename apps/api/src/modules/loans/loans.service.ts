import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLoanDto, CreateLoanPaymentDto } from './dto';

@Injectable()
export class LoansService {
  constructor(private prisma: PrismaService) {}

  async createLoan(dto: CreateLoanDto) {
    return this.prisma.loan.create({
      data: {
        code: dto.code,
        lender: dto.lender,
        type: dto.type,
        rateType: 'FIXED',
        principal: new Prisma.Decimal(dto.principal),
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        baseRate: dto.baseRate ? new Prisma.Decimal(dto.baseRate) : null,
        spread: dto.spread ? new Prisma.Decimal(dto.spread) : null,
        scheduleType: dto.scheduleType,
      },
    });
  }

  async listLoans() {
    return this.prisma.loan.findMany({
      include: {
        schedules: {
          orderBy: { installment: 'asc' },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async recordPayment(dto: CreateLoanPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const pay = await tx.loanPayment.create({
        data: {
          loanId: dto.loanId,
          paymentDate: new Date(dto.paymentDate),
          principalPaid: new Prisma.Decimal(dto.principalPaid),
          interestPaid: new Prisma.Decimal(dto.interestPaid),
          feesPaid: new Prisma.Decimal(dto.feesPaid ?? 0),
        },
      });

      return pay;
    });
  }
}
