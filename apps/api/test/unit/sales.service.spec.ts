import { SalesService } from '../../src/modules/sales/sales.service';
import { BadRequestException } from '@nestjs/common';

const tx = {
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
  customerId: 1,
  date: new Date().toISOString(),
  warehouseId: 3,
  items: [{ productId: 1, quantity: 1, unitPrice: 100, taxRate: 10 }],
};

describe('SalesService', () => {
  let svc: SalesService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.product.findMany.mockResolvedValue([{ id: 1, categoryId: 10 }]);
    tx.warehouse.findUnique.mockResolvedValue({ id: 3, branchId: 5, branch: { id: 5, companyId: 2 } });
    tx.salesInvoice.create.mockResolvedValue({ id: 10, number: 'INV-1' });
    tx.salesInvoiceItem.createMany.mockResolvedValue({});
    tx.stockMovement.create.mockResolvedValue({});
    postingMock.post.mockResolvedValue({ id: 20 });
    tx.salesInvoice.findUnique = jest.fn().mockResolvedValue({ id: 10, items: [] });
    svc = new SalesService(prismaMock as any, postingMock as any);
  });

  it('rejects zero total', async () => {
    await expect(
      svc.createInvoice({ ...baseDto, items: [{ productId: 1, quantity: 0, unitPrice: 0 }] } as any)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates invoice with stock and posting engine', async () => {
    await svc.createInvoice(baseDto as any);
    expect(tx.salesInvoice.create).toHaveBeenCalled();
    expect(tx.stockMovement.create).toHaveBeenCalled();
    expect(postingMock.post).toHaveBeenCalled();
  });
});
