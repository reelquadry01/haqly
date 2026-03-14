import { BadRequestException } from '@nestjs/common';
import { PaymentVouchersService } from '../../src/modules/payment-vouchers/payment-vouchers.service';

const txMock: any = {
  numberingSequence: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  aPPaymentVoucherHeader: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  journalEntry: {
    create: jest.fn(),
  },
  journalLine: {
    createMany: jest.fn(),
  },
};

const prismaMock: any = {
  $transaction: (fn: any) => fn(txMock),
  aPPaymentVoucherHeader: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
};

const gatewayMock: any = {
  validateBeneficiary: jest.fn(),
  initiatePayment: jest.fn(),
  checkPaymentStatus: jest.fn(),
  retryPayment: jest.fn(),
  reversePayment: jest.fn(),
};

describe('PaymentVouchersService', () => {
  let service: PaymentVouchersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentVouchersService(prismaMock, gatewayMock);
  });

  it('creates a draft payment voucher', async () => {
    jest.spyOn(service as any, 'prepareVoucher').mockResolvedValue({
      totalAmount: 16125,
      taxAmount: 1125,
      withholdingTaxAmount: 750,
      netPaymentAmount: 15375,
      lines: [{ lineNumber: 1 }],
      auditLines: [{ lineNumber: 1 }],
      attachmentCount: 0,
      template: {
        id: 1,
        requiresAttachment: true,
        allowRecall: true,
        postAfterFinalApproval: true,
        allowPaymentExecution: true,
        enableGateway: false,
        templateKind: 'STANDARD_CORPORATE',
        defaultAccountId: 20,
      },
      approvalChain: [{ level: 1, label: 'Finance Review', role: 'FINANCE', status: 'PENDING' }],
      payableAccountId: 20,
    });
    jest.spyOn(service as any, 'nextVoucherNumber').mockResolvedValue('PV-000001');
    txMock.aPPaymentVoucherHeader.create.mockImplementation(async ({ data }: any) => ({
      id: 91,
      ...data,
      lines: data.lines.create,
      attachments: [],
      comments: [],
      approvalHistory: [],
      auditLogs: [],
      statusHistory: [],
      paymentEvents: [],
      gatewayLogs: [],
    }));

    const result = await service.createDraft(
      {
        voucherType: 'VENDOR_PAYMENT',
        legalEntityId: 1,
        branchId: 1,
        beneficiaryType: 'VENDOR',
        beneficiaryName: 'Metro Packaging',
        paymentMethod: 'BANK_TRANSFER',
        bankAccountId: 2,
        currencyCode: 'NGN',
        voucherDate: '2026-03-14',
        requestedPaymentDate: '2026-03-15',
        postingDate: '2026-03-14',
        accountingPeriodId: 1,
        narration: 'Payment voucher draft',
        purposeOfPayment: 'Supplier settlement',
        lines: [{ lineType: 'EXPENSE', accountId: 20, description: 'Service fee', grossAmount: 15000, netAmount: 15000 }],
      } as any,
      { userId: 7, email: 'admin@example.com' },
    );

    expect(txMock.aPPaymentVoucherHeader.create).toHaveBeenCalled();
    expect(result.voucherNumber).toBe('PV-000001');
  });

  it('submits a valid voucher into approval workflow', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 91,
      status: 'DRAFT',
      workflowStatus: 'AWAITING_SUBMISSION',
      createdBy: 7,
      approvalChain: [{ level: 1, label: 'Finance Review', role: 'FINANCE', status: 'PENDING' }],
      accountingPeriod: { status: 'OPEN' },
      lines: [{ grossAmount: 100, taxAmount: 0, withholdingTaxAmount: 0, netAmount: 100, account: { isActive: true, allowsPosting: true } }],
      branchId: 1,
      accountingPeriodId: 1,
      bankAccountId: 2,
      cashAccountId: null,
      bankAccount: { isActive: true },
      narration: 'Draft',
      purposeOfPayment: 'Pay vendor',
      requiresAttachment: false,
      attachmentCount: 0,
      voucherNumber: 'PV-000001',
      paymentStatus: 'NOT_PAID',
    } as any);
    jest.spyOn(service as any, 'validatePersistedVoucher').mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
      totals: { gross: 100, tax: 0, withholding: 0, total: 100, net: 100 },
    });
    prismaMock.aPPaymentVoucherHeader.update.mockResolvedValue({ id: 91, status: 'PENDING_APPROVAL' });

    const result = await service.submit(91, { userId: 7, email: 'admin@example.com' });

    expect(prismaMock.aPPaymentVoucherHeader.update).toHaveBeenCalled();
    expect(result.status).toBe('PENDING_APPROVAL');
  });

  it('blocks posting before final approval', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 91,
      isPostedToGL: false,
      glJournalId: null,
      status: 'PENDING_APPROVAL',
      accountingPeriod: { status: 'OPEN' },
    } as any);

    await expect(service.postToGl(91, { userId: 7, email: 'admin@example.com' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('posts an approved voucher to the general ledger', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 91,
      voucherNumber: 'PV-000001',
      beneficiaryName: 'Metro Packaging',
      isPostedToGL: false,
      glJournalId: null,
      status: 'APPROVED',
      paymentStatus: 'NOT_PAID',
      approvalLevel: 2,
      workflowStatus: 'APPROVED',
      postingDate: new Date('2026-03-14'),
      branchId: 1,
      accountingPeriod: { status: 'OPEN' },
    } as any);
    jest.spyOn(service as any, 'buildPostingLines').mockReturnValue([
      { accountId: 20, debit: '15000.00', credit: '0.00', memo: 'Expense' },
      { accountId: 10, debit: '0.00', credit: '15000.00', memo: 'Bank' },
    ]);
    jest.spyOn(service as any, 'ensureBalancedPosting').mockImplementation(() => undefined);
    txMock.journalEntry.create.mockResolvedValue({ id: 300, reference: 'PV-PV-000001' });
    txMock.journalLine.createMany.mockResolvedValue({ count: 2 });
    txMock.aPPaymentVoucherHeader.update.mockResolvedValue(undefined);
    txMock.aPPaymentVoucherHeader.findUnique.mockResolvedValue({ id: 91, status: 'POSTED', glJournalId: 300 });

    const result = await service.postToGl(91, { userId: 7, email: 'admin@example.com' });

    expect(txMock.journalEntry.create).toHaveBeenCalled();
    expect(txMock.journalLine.createMany).toHaveBeenCalled();
    expect(result?.glJournalId).toBe(300);
  });
});
