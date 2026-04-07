import { ImportsService } from '../../src/modules/imports/imports.service';

describe('ImportsService', () => {
  it('exposes the controller-backed import entry points', async () => {
    const service = new ImportsService({} as any);

    await expect(service.importAccounts({ rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'chart-of-accounts', created: 0, failed: 0 }),
    );
    await expect(service.importCustomers({ companyId: 1, rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'customers', created: 0, failed: 0 }),
    );
    await expect(service.importSuppliers({ companyId: 1, rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'suppliers', created: 0, failed: 0 }),
    );
    await expect(service.importProducts({ companyId: 1, rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'products', created: 0, failed: 0 }),
    );
    await expect(service.importTaxConfigs({ rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'tax-configs', created: 0, failed: 0 }),
    );
    await expect(service.importAssetCategories({ rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'asset-categories', created: 0, failed: 0 }),
    );
    await expect(service.importGLOpeningBalances({ companyId: 1, rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'gl-opening-balances', created: 0, failed: 0 }),
    );
    await expect(service.importAROpeningBalances({ companyId: 1, rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'ar-opening-balances', created: 0, failed: 0 }),
    );
    await expect(service.importAPOpeningBalances({ companyId: 1, rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'ap-opening-balances', created: 0, failed: 0 }),
    );
    await expect(service.importCustomerReceipts({ companyId: 1, rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'customer-receipts', created: 0, failed: 0 }),
    );
    await expect(service.importSupplierPayments({ companyId: 1, rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'supplier-payments', created: 0, failed: 0 }),
    );
    await expect(service.importFixedAssets({ companyId: 1, rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'fixed-assets', created: 0, failed: 0 }),
    );
    await expect(service.importStockOpeningBalances({ companyId: 1, rows: [] } as any)).resolves.toEqual(
      expect.objectContaining({ dataset: 'stock-opening-balances', created: 0, failed: 0 }),
    );
  });
});
