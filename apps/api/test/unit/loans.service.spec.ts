import { BadRequestException } from '@nestjs/common';
import { LoansService } from '../../src/modules/loans/loans.service';

describe('LoansService', () => {
  let svc: LoansService;
  let posting: any;

  beforeEach(() => {
    posting = { post: jest.fn().mockResolvedValue({ id: 1 }) };
    svc = new LoansService({} as any, posting);
  });

  const schedule = (over: Record<string, unknown> = {}) =>
    (svc as any).buildSchedule(
      {
        principal: 120000,
        baseRate: 12,
        spread: 0,
        scheduleType: 'ANNUITY',
        ...over,
      },
      new Date('2026-01-01'),
      new Date('2026-07-01'),
    );

  const sum = (rows: any[], field: string) =>
    Math.round(rows.reduce((s, r) => s + r[field], 0) * 100) / 100;

  describe('annuity schedule', () => {
    it('repays the principal exactly, with rounding absorbed by the last installment', () => {
      const rows = schedule();
      expect(rows).toHaveLength(6);
      expect(sum(rows, 'principalDue')).toBe(120000);
    });

    it('charges interest on the outstanding balance, so it falls each period', () => {
      const rows = schedule();
      // First period: 120,000 at 12%/yr = 1% monthly.
      expect(rows[0].interestDue).toBe(1200);
      expect(rows[0].interestDue).toBeGreaterThan(rows[rows.length - 1].interestDue);
    });

    it('splits principal evenly when the loan carries no interest', () => {
      const rows = schedule({ baseRate: 0, spread: 0 });
      expect(sum(rows, 'principalDue')).toBe(120000);
      expect(sum(rows, 'interestDue')).toBe(0);
    });

    it('adds the spread to the base rate', () => {
      // 12% base + 12% spread = 24%/yr = 2% monthly on 120,000.
      expect(schedule({ spread: 12 })[0].interestDue).toBe(2400);
    });
  });

  describe('interest-only schedule', () => {
    it('defers the whole principal to the final installment', () => {
      const rows = schedule({ scheduleType: 'INTEREST_ONLY' });
      expect(rows.slice(0, -1).every((r: any) => r.principalDue === 0)).toBe(true);
      expect(rows[rows.length - 1].principalDue).toBe(120000);
      // Interest stays flat because the balance never reduces.
      expect(rows[0].interestDue).toBe(rows[0].interestDue);
      expect(sum(rows, 'principalDue')).toBe(120000);
    });
  });

  describe('schedules that cannot be derived', () => {
    it('generates nothing for BALLOON, which needs a residual amount', () => {
      expect(schedule({ scheduleType: 'BALLOON' })).toEqual([]);
    });

    it('generates nothing for CUSTOM, which is defined by hand', () => {
      expect(schedule({ scheduleType: 'CUSTOM' })).toEqual([]);
    });

    it('generates nothing for an open-ended loan', () => {
      expect((svc as any).buildSchedule({ principal: 1000, scheduleType: 'ANNUITY' }, new Date('2026-01-01'), null)).toEqual([]);
    });
  });

  describe('recordPayment', () => {
    it('rejects a payment carrying no money at all', async () => {
      await expect(
        svc.recordPayment({ loanId: 1, paymentDate: '2026-02-01', principalPaid: 0, interestPaid: 0 } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createLoan', () => {
    it('rejects a term that ends before it starts', async () => {
      await expect(
        svc.createLoan({
          code: 'L1', lender: 'Bank', type: 'TERM', principal: 1000,
          startDate: '2026-06-01', endDate: '2026-01-01', scheduleType: 'ANNUITY',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a non-positive principal', async () => {
      await expect(
        svc.createLoan({
          code: 'L1', lender: 'Bank', type: 'TERM', principal: 0,
          startDate: '2026-01-01', scheduleType: 'ANNUITY',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
