import { SalesService } from '../../src/modules/sales/sales.service';
import { BadRequestException } from '@nestjs/common';

const COMPANY_ID = 2;

const tx = {
  company: { findUnique: jest.fn() },
  customer: { findUnique: jest.fn() },
  product: { findMany: jest.fn() },
  warehouse: { findUnique: jest.fn() },
  salesInvoice: { create: jest.fn(), findUnique: jest.fn() },
  salesInvoiceItem: { createMany: jest.fn() },
  stockMovement: { create: jest.fn() },
};
const prismaMock: any = {
  $transaction: (fn: any) => fn(tx),
};
const postingMock = { post: jest.fn() };

const baseDto = {
  legalEntityId: COMPANY_ID,
  customerId: 1,
  date: new Date().toISOString(),
  warehouseId: 3,
  items: [{ productId: 1, quantity: 1, unitPrice: 100, taxRate: 10 }],
};

describe('SalesService', () => {
  let svc: SalesService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.company.findUnique.mockResolvedValue({ id: COMPANY_ID, name: 'Test Co' });
    tx.customer.findUnique.mockResolvedValue({ id: 1, companyId: COMPANY_ID });
    tx.product.findMany.mockResolvedValue([{ id: 1, categoryId: 10, companyId: COMPANY_ID }]);
    tx.warehouse.findUnique.mockResolvedValue({
      id: 3,
      branchId: 5,
      branch: { id: 5, companyId: COMPANY_ID },
    });
    tx.salesInvoice.create.mockResolvedValue({ id: 10, number: 'INV-1' });
    tx.salesInvoiceItem.createMany.mockResolvedValue({});
    tx.stockMovement.create.mockResolvedValue({});
    postingMock.post.mockResolvedValue({ id: 20 });
    tx.salesInvoice.findUnique.mockResolvedValue({ id: 10, items: [] });
    svc = new SalesService(prismaMock as any, postingMock as any);
  });

  it('rejects zero total', async () => {
    await expect(
      svc.createInvoice({
        ...baseDto,
        items: [{ productId: 1, quantity: 0, unitPrice: 0 }],
      } as any),
    ).rejects.toThrow('Total must be > 0');
  });

  it('creates invoice with stock and posting engine', async () => {
    await svc.createInvoice(baseDto as any);
    expect(tx.salesInvoice.create).toHaveBeenCalled();
    expect(tx.stockMovement.create).toHaveBeenCalled();
    expect(postingMock.post).toHaveBeenCalled();
  });

  // An invoice must never be raised against another tenant's customer.
  it('rejects a customer belonging to a different company', async () => {
    tx.customer.findUnique.mockResolvedValue({ id: 1, companyId: 999 });

    await expect(svc.createInvoice(baseDto as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.salesInvoice.create).not.toHaveBeenCalled();
  });

  it('rejects a warehouse belonging to a different company', async () => {
    tx.warehouse.findUnique.mockResolvedValue({
      id: 3,
      branchId: 5,
      branch: { id: 5, companyId: 999 },
    });

    await expect(svc.createInvoice(baseDto as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.salesInvoice.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown company', async () => {
    tx.company.findUnique.mockResolvedValue(null);

    await expect(svc.createInvoice(baseDto as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.salesInvoice.create).not.toHaveBeenCalled();
  });
});
