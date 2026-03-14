import { PurchasesService } from '../../src/modules/purchases/purchases.service';
import { BadRequestException } from '@nestjs/common';

const tx = {
  product: { findMany: jest.fn() },
  warehouse: { findUnique: jest.fn() },
  purchaseBill: { create: jest.fn(), findUnique: jest.fn() },
  purchaseBillItem: { createMany: jest.fn() },
  stockMovement: { create: jest.fn() },
};
const prismaMock: any = { $transaction: (fn: any) => fn(tx) };
const postingMock = { post: jest.fn() };

const baseDto = {
  supplierId: 1,
  date: new Date().toISOString(),
  warehouseId: 7,
  items: [{ productId: 1, quantity: 2, unitCost: 50, taxRate: 5 }],
};

describe('PurchasesService', () => {
  let svc: PurchasesService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.product.findMany.mockResolvedValue([{ id: 1, categoryId: 12 }]);
    tx.warehouse.findUnique.mockResolvedValue({ id: 7, branchId: 5, branch: { id: 5, companyId: 2 } });
    tx.purchaseBill.create.mockResolvedValue({ id: 11, number: 'BILL-1' });
    tx.purchaseBillItem.createMany.mockResolvedValue({});
    tx.stockMovement.create.mockResolvedValue({});
    postingMock.post.mockResolvedValue({ id: 21 });
    tx.purchaseBill.findUnique.mockResolvedValue({ id: 11, items: [] });
    svc = new PurchasesService(prismaMock as any, postingMock as any);
  });

  it('rejects zero total', async () => {
    await expect(
      svc.createBill({ ...baseDto, items: [{ productId: 1, quantity: 0, unitCost: 0 }] } as any)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates bill with stock and posting engine', async () => {
    await svc.createBill(baseDto as any);
    expect(tx.purchaseBill.create).toHaveBeenCalled();
    expect(tx.stockMovement.create).toHaveBeenCalled();
    expect(postingMock.post).toHaveBeenCalled();
  });
});
