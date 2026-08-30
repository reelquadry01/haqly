import { BadRequestException } from '@nestjs/common';
import { DepreciationService } from '../../src/modules/depreciation/depreciation.service';

describe('DepreciationService', () => {
  let svc: DepreciationService;
  let prisma: any;
  let posting: any;

  const asset = (over: Record<string, unknown> = {}) => ({
    id: 1,
    tag: 'VEH-1',
    status: 'ACTIVE',
    acquisitionDate: new Date('2026-01-01'),
    depreciationStart: new Date('2026-01-01'),
    acquisitionCost: 120000,
    residualValue: 20000,
    branch: { id: 5, companyId: 2 },
    category: { name: 'Vehicles', usefulLifeMonths: 10, depreciationMethod: 'STRAIGHT_LINE' },
    ...over,
  });

  beforeEach(() => {
    prisma = {
      depreciationRun: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    posting = { post: jest.fn().mockResolvedValue({ id: 77 }) };
    svc = new DepreciationService(prisma, posting);
  });

  const charge = (tx: any, a: any) =>
    (svc as any).chargeAsset(tx, a, 1, new Date('2026-02-01'), new Date('2026-02-28'));

  /** Latest accumulated figure the asset already carries, or none. */
  const txWith = (accumulated: number | null) => ({
    depreciationLine: {
      findFirst: jest.fn().mockResolvedValue(accumulated === null ? null : { accumulated }),
      create: jest.fn().mockResolvedValue({}),
    },
  });

  it('charges cost less residual over the useful life', async () => {
    const tx = txWith(null);
    // (120000 - 20000) / 10 months
    await expect(charge(tx, asset())).resolves.toEqual({ amount: 10000 });
  });

  it('carries the accumulated total forward instead of restating one period', async () => {
    // This is the bug the old implementation had: it wrote the period amount into
    // `accumulated` every run, so the figure never grew past a single month.
    const tx = txWith(30000);
    await charge(tx, asset());

    const written = tx.depreciationLine.create.mock.calls[0][0].data;
    expect(Number(written.amount)).toBe(10000);
    expect(Number(written.accumulated)).toBe(40000);
  });

  it('never depreciates below the residual value', async () => {
    // 95,000 of the 100,000 depreciable base is already gone, so only 5,000 is
    // left even though a full period would otherwise charge 10,000.
    const tx = txWith(95000);
    await expect(charge(tx, asset())).resolves.toEqual({ amount: 5000 });
  });

  it('stops once the asset is fully depreciated', async () => {
    const tx = txWith(100000);
    await expect(charge(tx, asset())).resolves.toEqual({
      reason: 'Asset is already fully depreciated',
    });
    expect(tx.depreciationLine.create).not.toHaveBeenCalled();
  });

  it('applies declining balance to the carrying amount, not to cost', async () => {
    const tx = txWith(24000);
    // (120000 - 24000) * (2 / 10)
    await expect(
      charge(tx, asset({ category: { name: 'Kit', usefulLifeMonths: 10, depreciationMethod: 'DECLINING_BALANCE' } })),
    ).resolves.toEqual({ amount: 19200 });
  });

  it('reports rather than silently skipping an unsupported method', async () => {
    const tx = txWith(null);
    const result = await charge(
      tx,
      asset({ category: { name: 'Press', usefulLifeMonths: 10, depreciationMethod: 'UNITS_OF_PRODUCTION' } }),
    );
    expect(result).toEqual({ reason: expect.stringContaining('UNITS_OF_PRODUCTION') });
  });

  it('skips assets that are not active', async () => {
    const tx = txWith(null);
    await expect(charge(tx, asset({ status: 'DISPOSED' }))).resolves.toEqual({
      reason: 'Asset is disposed, not active',
    });
  });

  it('skips assets whose depreciation has not started', async () => {
    const tx = txWith(null);
    const result = await charge(tx, asset({ depreciationStart: new Date('2027-06-01') }));
    expect(result).toEqual({ reason: expect.stringContaining('2027-06-01') });
  });

  it('refuses to charge the same period twice', async () => {
    prisma.depreciationRun.findFirst.mockResolvedValue({ id: 9 });
    await expect(
      svc.run({ periodStart: '2026-02-01', periodEnd: '2026-02-28' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a period that ends before it starts', async () => {
    await expect(
      svc.run({ periodStart: '2026-03-01', periodEnd: '2026-02-01' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
