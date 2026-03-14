import { AccountingService } from '../../src/modules/accounting/accounting.service';
import { BadRequestException } from '@nestjs/common';

// Minimal Prisma mock
const tx = {
  journalEntry: { create: jest.fn(), findUnique: jest.fn() },
  journalLine: { createMany: jest.fn() },
};
const prismaMock: any = {
  $transaction: (fn: any) => fn(tx),
  journalEntry: { findMany: jest.fn() },
};

const sampleDto = {
  date: new Date().toISOString(),
  lines: [
    { accountId: 1, debit: 100, credit: 0 },
    { accountId: 2, debit: 0, credit: 100 },
  ],
};

describe('AccountingService', () => {
  let svc: AccountingService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.journalEntry.create.mockResolvedValue({ id: 10 });
    tx.journalEntry.findUnique.mockResolvedValue({ id: 10, lines: [] });
    tx.journalLine.createMany.mockResolvedValue({});
    svc = new AccountingService(prismaMock as any);
  });

  it('rejects unbalanced journal', async () => {
    await expect(
      svc.postJournal({ ...sampleDto, lines: [{ accountId: 1, debit: 50, credit: 0 }] as any })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates balanced journal', async () => {
    await svc.postJournal(sampleDto as any);
    expect(tx.journalEntry.create).toHaveBeenCalled();
    expect(tx.journalLine.createMany).toHaveBeenCalled();
    expect(tx.journalEntry.findUnique).toHaveBeenCalled();
  });
});
