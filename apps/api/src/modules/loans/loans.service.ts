import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PostingService } from '../posting/posting.service';
import { CreateLoanDto, CreateLoanPaymentDto } from './dto';

const MONEY_EPSILON = 0.005;

export const LOAN_POSTING_MODULE = 'TREASURY';
export const LOAN_REPAYMENT_TYPE = 'LOAN_REPAYMENT';
export const LOAN_DISBURSEMENT_TYPE = 'LOAN_DISBURSEMENT';

type ScheduleRow = {
  installment: number;
  dueDate: Date;
  principalDue: number;
  interestDue: number;
  feesDue: number;
};

@Injectable()
export class LoansService {
  constructor(
    private prisma: PrismaService,
    private posting: PostingService,
  ) {}

  async createLoan(dto: CreateLoanDto) {
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('endDate must fall after startDate.');
    }
    if (dto.principal <= 0) {
      throw new BadRequestException('Loan principal must be greater than zero.');
    }

    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.create({
        data: {
          code: dto.code,
          lender: dto.lender,
          type: dto.type,
          rateType: 'FIXED',
          principal: new Prisma.Decimal(dto.principal),
          startDate,
          endDate,
          baseRate: dto.baseRate ? new Prisma.Decimal(dto.baseRate) : null,
          spread: dto.spread ? new Prisma.Decimal(dto.spread) : null,
          scheduleType: dto.scheduleType,
        },
      });

      const schedule = this.buildSchedule(dto, startDate, endDate);
      if (schedule.length > 0) {
        await tx.loanSchedule.createMany({
          data: schedule.map((row) => ({
            loanId: loan.id,
            installment: row.installment,
            dueDate: row.dueDate,
            principalDue: new Prisma.Decimal(row.principalDue),
            interestDue: new Prisma.Decimal(row.interestDue),
            feesDue: new Prisma.Decimal(row.feesDue),
          })),
        });
      }

      // Recording a loan is not the same event as drawing it down, so the
      // disbursement only posts when the caller says money actually moved.
      if (dto.disbursementDate) {
        await this.posting.post(
          {
            context: {
              module: LOAN_POSTING_MODULE,
              transactionType: LOAN_DISBURSEMENT_TYPE,
              triggeringEvent: 'LOAN_DISBURSED',
              postingDate: new Date(dto.disbursementDate),
              sourceTable: 'loan',
              sourceDocumentId: String(loan.id),
              sourceDocumentNumber: loan.code,
              sourceStatus: 'POSTED',
              legalEntityId: dto.legalEntityId,
              branchId: dto.branchId,
              partyName: loan.lender,
              currencyCode: 'NGN',
              narration: `Drawdown of loan ${loan.code} from ${loan.lender}`,
              idempotencyKey: `loan-disbursement-${loan.id}`,
              descriptionTemplateData: { loanCode: loan.code },
            },
            pattern: 'LOAN_DISBURSEMENT',
            amounts: { baseAmount: dto.principal, totalAmount: dto.principal },
          },
          tx,
        );
      }

      return tx.loan.findUnique({
        where: { id: loan.id },
        include: { schedules: { orderBy: { installment: 'asc' } } },
      });
    });
  }

  async listLoans() {
    return this.prisma.loan.findMany({
      include: {
        schedules: { orderBy: { installment: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
      orderBy: { id: 'desc' },
    });
  }

  /**
   * Records a repayment and posts it to the ledger in the same transaction, so
   * a payment can never sit in the loan register without a matching journal.
   */
  async recordPayment(dto: CreateLoanPaymentDto) {
    const principal = dto.principalPaid ?? 0;
    const interest = dto.interestPaid ?? 0;
    const fees = dto.feesPaid ?? 0;
    const total = principal + interest + fees;

    if (total <= MONEY_EPSILON) {
      throw new BadRequestException('A payment must carry principal, interest or fees.');
    }

    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { id: dto.loanId },
        include: { payments: true },
      });
      if (!loan) {
        throw new NotFoundException(`Loan ${dto.loanId} was not found.`);
      }

      const principalRepaid = loan.payments.reduce((sum, p) => sum + Number(p.principalPaid), 0);
      const outstanding = Number(loan.principal) - principalRepaid;
      if (principal - outstanding > MONEY_EPSILON) {
        throw new BadRequestException(
          `Principal of ${principal.toFixed(2)} exceeds the ${outstanding.toFixed(2)} still outstanding on loan ${loan.code}.`,
        );
      }

      if (dto.scheduleId) {
        const scheduled = await tx.loanSchedule.findFirst({
          where: { id: dto.scheduleId, loanId: loan.id },
        });
        if (!scheduled) {
          throw new BadRequestException('That installment does not belong to this loan.');
        }
      }

      const payment = await tx.loanPayment.create({
        data: {
          loanId: dto.loanId,
          scheduleId: dto.scheduleId ?? null,
          paymentDate: new Date(dto.paymentDate),
          principalPaid: new Prisma.Decimal(principal),
          interestPaid: new Prisma.Decimal(interest),
          feesPaid: new Prisma.Decimal(fees),
          memo: dto.memo ?? null,
        },
      });

      if (dto.scheduleId) {
        await tx.loanSchedule.update({
          where: { id: dto.scheduleId },
          data: { status: 'PAID' },
        });
      }

      await this.posting.post(
        {
          context: {
            module: LOAN_POSTING_MODULE,
            transactionType: LOAN_REPAYMENT_TYPE,
            triggeringEvent: 'LOAN_REPAYMENT_POSTED',
            postingDate: new Date(dto.paymentDate),
            sourceTable: 'loanPayment',
            sourceDocumentId: String(payment.id),
            sourceDocumentNumber: `${loan.code}-P${payment.id}`,
            sourceStatus: 'POSTED',
            legalEntityId: dto.legalEntityId,
            branchId: dto.branchId,
            partyName: loan.lender,
            currencyCode: 'NGN',
            narration: `Repayment on loan ${loan.code}`,
            idempotencyKey: `loan-repayment-${payment.id}`,
            descriptionTemplateData: { loanCode: loan.code },
          },
          pattern: 'LOAN_REPAYMENT',
          amounts: {
            baseAmount: principal,
            totalAmount: total,
            principalAmount: principal,
            interestAmount: interest,
            feeAmount: fees,
          },
        },
        tx,
      );

      return tx.loanPayment.findUnique({
        where: { id: payment.id },
        include: { loan: true, schedule: true },
      });
    });
  }

  /**
   * Builds the repayment schedule. BALLOON needs a residual amount and CUSTOM is
   * defined by hand, so neither is generated here rather than inventing figures
   * the borrower never agreed to.
   */
  private buildSchedule(dto: CreateLoanDto, startDate: Date, endDate: Date | null): ScheduleRow[] {
    if (!endDate) return [];

    const months = this.monthsBetween(startDate, endDate);
    if (months < 1) return [];

    const principal = dto.principal;
    const annualRate = (dto.baseRate ?? 0) + (dto.spread ?? 0);
    const monthlyRate = annualRate / 100 / 12;

    const rows: ScheduleRow[] = [];

    if (dto.scheduleType === 'ANNUITY') {
      const payment =
        monthlyRate > 0
          ? (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
          : principal / months;

      let balance = principal;
      for (let i = 1; i <= months; i += 1) {
        const interestDue = this.round(balance * monthlyRate);
        // The final installment clears whatever rounding has left behind.
        const principalDue = i === months ? this.round(balance) : this.round(payment - interestDue);
        balance = this.round(balance - principalDue);
        rows.push({
          installment: i,
          dueDate: this.addMonths(startDate, i),
          principalDue,
          interestDue,
          feesDue: 0,
        });
      }
      return rows;
    }

    if (dto.scheduleType === 'INTEREST_ONLY') {
      for (let i = 1; i <= months; i += 1) {
        rows.push({
          installment: i,
          dueDate: this.addMonths(startDate, i),
          principalDue: i === months ? this.round(principal) : 0,
          interestDue: this.round(principal * monthlyRate),
          feesDue: 0,
        });
      }
      return rows;
    }

    return [];
  }

  private monthsBetween(start: Date, end: Date): number {
    return (
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    );
  }

  private addMonths(date: Date, months: number): Date {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
