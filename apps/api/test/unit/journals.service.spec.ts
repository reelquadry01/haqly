import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JournalsService } from '../../src/modules/journals/journals.service';

const txMock: any = {
  numberingSequence: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  gLJournalHeader: {
    create: jest.fn(),
    update: jest.fn(),
  },
  gLJournalLine: {
    deleteMany: jest.fn(),
  },
  gLJournalAttachment: {
    deleteMany: jest.fn(),
  },
  journalEntry: {
    create: jest.fn(),
  },
};

const prismaMock: any = {
  $transaction: (fn: any) => fn(txMock),
  account: { findMany: jest.fn() },
  gLJournalHeader: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  company: { findUnique: jest.fn() },
  gLRecurringJournalTemplate: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
};

const draftDto: any = {
  journalType: 'MANUAL',
  legalEntityId: 1,
  branchId: 1,
  journalDate: '2026-03-13',
  postingDate: '2026-03-13',
  accountingPeriodId: 1,
  currencyCode: 'NGN',
  narration: 'Month end accrual',
  lines: [
    { accountId: 1, debitAmount: 1000, creditAmount: 0 },
    { accountId: 2, debitAmount: 0, creditAmount: 1000 },
  ],
};

describe('JournalsService', () => {
  let service: JournalsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JournalsService(prismaMock);

    prismaMock.account.findMany.mockResolvedValue([
      { id: 1, code: '6100', name: 'Expense', type: 'EXPENSE', isActive: true, requiresSubledger: false },
      { id: 2, code: '2100', name: 'Accrued Payroll', type: 'LIABILITY', isActive: true, requiresSubledger: false },
    ]);

    txMock.numberingSequence.findFirst.mockResolvedValue(null);
    txMock.numberingSequence.create.mockResolvedValue({ id: 1, prefix: 'GLJ', nextNumber: 2 });
    txMock.gLJournalHeader.create.mockImplementation(async ({ data }: any) => ({
      id: 99,
      ...data,
      lines: data.lines.create,
      attachments: [],
      approvalHistory: [],
      auditLogs: [],
      statusHistory: [],
      reversalJournals: [],
    }));
  });

  it('creates a draft journal', async () => {
    const result = await service.createDraft(draftDto, { userId: 7, email: 'admin@example.com' });

    expect(txMock.gLJournalHeader.create).toHaveBeenCalled();
    expect(result.journalNumber).toBe('GLJ-000001');
    expect(result.totalDebit.toString()).toBe('1000');
  });

  it('blocks submission when the journal is unbalanced', async () => {
    prismaMock.gLJournalHeader.findUnique.mockResolvedValue({
      id: 88,
      status: 'DRAFT',
      sourceType: 'MANUAL',
      legalEntityId: 1,
      branchId: 1,
      departmentId: null,
      costCenterId: null,
      projectId: null,
      postingDate: new Date('2026-03-13'),
      accountingPeriod: {
        id: 1,
        status: 'OPEN',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
      },
      currencyCode: 'NGN',
      exchangeRate: null,
      lines: [
        {
          lineNumber: 1,
          accountCode: '6100',
          debitAmount: 1000,
          creditAmount: 0,
          departmentId: null,
          costCenterId: null,
          projectId: null,
          taxCodeId: null,
          subledgerId: null,
          account: {
            isActive: true,
            allowsPosting: true,
            allowsManualPosting: true,
            requiresSubledger: false,
            isControlAccount: false,
            requiresDepartment: false,
            requiresCostCenter: false,
            requiresProject: false,
            requiresTax: false,
          },
        },
      ],
      attachments: [],
      approvalHistory: [],
      auditLogs: [],
      statusHistory: [],
      reversalJournals: [],
    });
    prismaMock.company.findUnique.mockResolvedValue({ id: 1, currency: { code: 'NGN' } });

    await expect(service.submit(88, { userId: 7, email: 'admin@example.com' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('prevents maker from approving their own journal', async () => {
    prismaMock.gLJournalHeader.findUnique.mockResolvedValue({
      id: 77,
      status: 'PENDING_APPROVAL',
      createdBy: 7,
      sourceType: 'MANUAL',
      approvalLevel: 1,
      reversalJournals: [],
      lines: [],
      attachments: [],
      auditLogs: [],
      approvalHistory: [],
      statusHistory: [],
    });

    await expect(service.approve(77, {}, { userId: 7, email: 'admin@example.com' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
