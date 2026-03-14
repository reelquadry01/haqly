import { BadRequestException } from '@nestjs/common';
import { PostingService } from '../../src/modules/posting/posting.service';

describe('PostingService', () => {
  let service: PostingService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      postingRule: { findMany: jest.fn() },
      postingAudit: { findUnique: jest.fn(), create: jest.fn() },
      branch: { findUnique: jest.fn() },
      accountingPeriod: { findFirst: jest.fn() },
      journalEntry: { create: jest.fn(), findUnique: jest.fn() },
      journalLine: { createMany: jest.fn() },
    };
    service = new PostingService(prismaMock);
  });

  const baseRule = {
    id: 1,
    module: 'SALES',
    transactionType: 'INVOICE',
    transactionSubtype: 'STANDARD',
    legalEntityId: null,
    branchId: 5,
    departmentId: null,
    productCategoryId: 10,
    customerGroup: null,
    vendorGroup: null,
    taxCode: 'OUTPUT_TAX',
    currencyCode: 'NGN',
    conditionExpression: null,
    debitAccountId: 100,
    creditAccountId: 200,
    taxAccountId: 300,
    roundingAccountId: null,
    exchangeGainAccountId: null,
    exchangeLossAccountId: null,
    suspenseAccountId: null,
    postingDescriptionTemplate: 'Invoice {{sourceDocumentNumber}}',
    requiresSubledger: true,
    requiresCostCenter: false,
    requiresProject: false,
    requiresBranch: true,
    requiresTax: false,
    effectiveStartDate: new Date('2026-01-01'),
    effectiveEndDate: null,
    status: 'ACTIVE',
    debitAccount: { id: 100, code: '1100', isActive: true, allowsPosting: true, isControlAccount: true, controlSource: 'SALES' },
    creditAccount: { id: 200, code: '4000', isActive: true, allowsPosting: true, isControlAccount: false, controlSource: null },
    taxAccount: { id: 300, code: '2300', isActive: true, allowsPosting: true, isControlAccount: false, controlSource: null },
    roundingAccount: null,
    exchangeGainAccount: null,
    exchangeLossAccount: null,
    suspenseAccount: null,
  };

  const request = {
    context: {
      module: 'SALES',
      transactionType: 'INVOICE',
      transactionSubtype: 'STANDARD',
      triggeringEvent: 'INVOICE_POSTED',
      postingDate: new Date('2026-03-13'),
      sourceTable: 'salesInvoice',
      sourceDocumentId: '10',
      sourceDocumentNumber: 'INV-10',
      sourceStatus: 'OPEN',
      legalEntityId: 2,
      branchId: 5,
      productCategoryId: 10,
      taxCode: 'OUTPUT_TAX',
      currencyCode: 'NGN',
      subledgerPartyId: 44,
      idempotencyKey: 'sales-invoice-10',
    },
    pattern: 'SALES_INVOICE' as const,
    amounts: {
      baseAmount: 100,
      taxAmount: 10,
      totalAmount: 110,
    },
  };

  it('blocks posting when no rule matches', async () => {
    prismaMock.postingRule.findMany.mockResolvedValue([]);
    await expect(service.post(request as any, prismaMock)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks duplicate postings by idempotency key', async () => {
    prismaMock.postingRule.findMany.mockResolvedValue([baseRule]);
    prismaMock.branch.findUnique.mockResolvedValue({ id: 5 });
    prismaMock.accountingPeriod.findFirst.mockResolvedValue({ id: 1, name: 'Mar 2026', status: 'OPEN' });
    prismaMock.postingAudit.findUnique.mockResolvedValue({ id: 1, idempotencyKey: 'sales-invoice-10' });

    await expect(service.post(request as any, prismaMock)).rejects.toThrow(/already exists/i);
  });

  it('posts a balanced journal and audit record when rule and context are valid', async () => {
    prismaMock.postingRule.findMany.mockResolvedValue([baseRule]);
    prismaMock.branch.findUnique.mockResolvedValue({ id: 5 });
    prismaMock.accountingPeriod.findFirst.mockResolvedValue({ id: 1, name: 'Mar 2026', status: 'OPEN' });
    prismaMock.postingAudit.findUnique.mockResolvedValue(null);
    prismaMock.journalEntry.create.mockResolvedValue({ id: 77, reference: 'JR-TEST' });
    prismaMock.journalLine.createMany.mockResolvedValue({});
    prismaMock.postingAudit.create.mockResolvedValue({ id: 99 });
    prismaMock.journalEntry.findUnique.mockResolvedValue({ id: 77, lines: [], postingAudit: { id: 99 } });

    const result = await service.post(request as any, prismaMock);

    expect(prismaMock.journalEntry.create).toHaveBeenCalled();
    expect(prismaMock.journalLine.createMany).toHaveBeenCalled();
    expect(prismaMock.postingAudit.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 77, lines: [], postingAudit: { id: 99 } });
  });

  it('blocks control account misuse from the wrong module', async () => {
    prismaMock.postingRule.findMany.mockResolvedValue([
      {
        ...baseRule,
        debitAccount: { ...baseRule.debitAccount, controlSource: 'PROCUREMENT' },
      },
    ]);
    prismaMock.branch.findUnique.mockResolvedValue({ id: 5 });
    prismaMock.accountingPeriod.findFirst.mockResolvedValue({ id: 1, name: 'Mar 2026', status: 'OPEN' });
    prismaMock.postingAudit.findUnique.mockResolvedValue(null);

    await expect(service.post(request as any, prismaMock)).rejects.toThrow(/reserved for PROCUREMENT/i);
  });
});
