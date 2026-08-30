import { PurchasesService } from '../../src/modules/purchases/purchases.service';
import { BadRequestException } from '@nestjs/common';

const COMPANY_ID = 2;

const tx = {
  company: { findUnique: jest.fn() },
  supplier: { findUnique: jest.fn() },
  product: { findMany: jest.fn() },
  warehouse: { findUnique: jest.fn() },
  purchaseBill: { create: jest.fn(), findUnique: jest.fn() },
  purchaseBillItem: { createMany: jest.fn() },
  stockMovement: { create: jest.fn() },
};
const prismaMock: any = { $transaction: (fn: any) => fn(tx) };
const postingMock = { post: jest.fn() };

const baseDto = {
  legalEntityId: COMPANY_ID,
  supplierId: 1,
  date: new Date().toISOString(),
  warehouseId: 7,
  items: [{ productId: 1, quantity: 2, unitCost: 50, taxRate: 5 }],
};

describe('PurchasesService', () => {
  let svc: PurchasesService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.company.findUnique.mockResolvedValue({ id: COMPANY_ID, name: 'Test Co' });
    tx.supplier.findUnique.mockResolvedValue({ id: 1, companyId: COMPANY_ID });
    tx.product.findMany.mockResolvedValue([{ id: 1, categoryId: 12, companyId: COMPANY_ID }]);
    tx.warehouse.findUnique.mockResolvedValue({
      id: 7,
      branchId: 5,
      branch: { id: 5, companyId: COMPANY_ID },
    });
    tx.purchaseBill.create.mockResolvedValue({ id: 11, number: 'BILL-1' });
    tx.purchaseBillItem.createMany.mockResolvedValue({});
    tx.stockMovement.create.mockResolvedValue({});
    postingMock.post.mockResolvedValue({ id: 21 });
    tx.purchaseBill.findUnique.mockResolvedValue({ id: 11, items: [] });
    svc = new PurchasesService(prismaMock as any, postingMock as any);
  });

  it('rejects zero total', async () => {
    await expect(
      svc.createBill({ ...baseDto, items: [{ productId: 1, quantity: 0, unitCost: 0 }] } as any),
    ).rejects.toThrow('Total must be > 0');
  });

  it('creates bill with stock and posting engine', async () => {
    await svc.createBill(baseDto as any);
    expect(tx.purchaseBill.create).toHaveBeenCalled();
    expect(tx.stockMovement.create).toHaveBeenCalled();
    expect(postingMock.post).toHaveBeenCalled();
  });

  // A bill must never be raised against another tenant's supplier.
  it('rejects a supplier belonging to a different company', async () => {
    tx.supplier.findUnique.mockResolvedValue({ id: 1, companyId: 999 });

    await expect(svc.createBill(baseDto as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.purchaseBill.create).not.toHaveBeenCalled();
  });

  it('rejects a warehouse belonging to a different company', async () => {
    tx.warehouse.findUnique.mockResolvedValue({
      id: 7,
      branchId: 5,
      branch: { id: 5, companyId: 999 },
    });

    await expect(svc.createBill(baseDto as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.purchaseBill.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown company', async () => {
    tx.company.findUnique.mockResolvedValue(null);

    await expect(svc.createBill(baseDto as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.purchaseBill.create).not.toHaveBeenCalled();
  });
});
