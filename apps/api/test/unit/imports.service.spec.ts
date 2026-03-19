import { ImportsService } from '../../src/modules/imports/imports.service';

describe('ImportsService', () => {
  let service: ImportsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn(), findFirst: jest.fn() },
      account: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      branch: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      department: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      warehouse: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      bankAccount: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      currency: { findUnique: jest.fn(), findFirst: jest.fn() },
      assetCategory: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      customer: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      supplier: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      product: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      productCategory: { findFirst: jest.fn(), create: jest.fn() },
      unitOfMeasure: { findFirst: jest.fn(), create: jest.fn() },
      taxConfig: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };

    prisma.account.findMany.mockResolvedValue([]);
    service = new ImportsService(prisma);
  });

  it('imports chart of accounts and normalizes control sources used by posting', async () => {
    prisma.account.findMany.mockResolvedValue([{ id: 10, code: '1000' }]);
    prisma.account.create.mockResolvedValue({ id: 11 });

    const result = await service.importAccounts({
      rows: [
        {
          code: '1100',
          name: 'Accounts Receivable',
          type: 'asset',
          parentCode: '1000',
          isControlAccount: true,
          controlSource: 'customer',
          allowsPosting: false,
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        created: 1,
        updated: 0,
        failed: 0,
      }),
    );
    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: '1100',
          type: 'ASSET',
          parentId: 10,
          isControlAccount: true,
          controlSource: 'SALES',
          allowsPosting: false,
        }),
      }),
    );
  });

  it('imports customers with buyer metadata needed for e-invoicing readiness', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 7 });
    prisma.customer.findFirst.mockResolvedValue(null);
    prisma.customer.create.mockResolvedValue({ id: 21 });

    const result = await service.importCustomers({
      companyId: 7,
      rows: [
        {
          name: 'Atlantic Retail Ltd',
          email: 'ap@atlanticretail.com',
          phone: '+2348011111111',
          customerType: 'business',
          taxId: '12345678-0001',
          line1: '14 Akin Adesola Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
          postalCode: '100001',
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        created: 1,
        updated: 0,
        failed: 0,
      }),
    );
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 7,
          customerType: 'BUSINESS',
          taxId: '12345678-0001',
          addresses: {
            create: expect.objectContaining({
              line1: '14 Akin Adesola Street',
              city: 'Lagos',
            }),
          },
        }),
      }),
    );
  });

  it('imports products and resolves category and unit of measure references', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 5 });
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.productCategory.findFirst.mockResolvedValue({ id: 31, name: 'Finished Goods' });
    prisma.unitOfMeasure.findFirst.mockResolvedValue({ id: 41, name: 'Unit' });
    prisma.product.create.mockResolvedValue({ id: 51 });

    const result = await service.importProducts({
      companyId: 5,
      rows: [
        {
          sku: 'FG-400',
          name: 'Industrial Solvent 20L',
          category: 'Finished Goods',
          uom: 'Unit',
          isActive: true,
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        created: 1,
        updated: 0,
        failed: 0,
      }),
    );
    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 5,
          sku: 'FG-400',
          categoryId: 31,
          uomId: 41,
          isActive: true,
        }),
      }),
    );
  });

  it('imports tax configs by resolving account codes into tax account ids', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 9 });
    prisma.taxConfig.findFirst.mockResolvedValue(null);
    prisma.account.findMany.mockResolvedValue([
      { id: 101, code: '2300' },
      { id: 102, code: '1400' },
    ]);
    prisma.taxConfig.create.mockResolvedValue({ id: 61 });

    const result = await service.importTaxConfigs({
      rows: [
        {
          companyId: 9,
          code: 'vat',
          name: 'Value Added Tax',
          taxType: 'vat',
          rate: 7.5,
          isInclusive: false,
          recoverable: true,
          filingFrequency: 'monthly',
          outputAccountCode: '2300',
          inputAccountCode: '1400',
          liabilityAccountCode: '2300',
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        created: 1,
        updated: 0,
        failed: 0,
      }),
    );
    expect(prisma.taxConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 9,
          code: 'VAT',
          taxType: 'VAT',
          filingFrequency: 'MONTHLY',
          outputAccountId: 101,
          inputAccountId: 102,
          liabilityAccountId: 101,
        }),
      }),
    );
  });

  it('imports departments against the target company code', async () => {
    prisma.company.findFirst.mockResolvedValue({ id: 13, code: 'HQY' });
    prisma.department.findFirst.mockResolvedValue(null);
    prisma.department.create.mockResolvedValue({ id: 71 });

    const result = await service.importDepartments({
      rows: [
        {
          companyCode: 'HQY',
          departmentName: 'Finance',
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        created: 1,
        updated: 0,
        failed: 0,
      }),
    );
    expect(prisma.department.create).toHaveBeenCalledWith({
      data: {
        companyId: 13,
        name: 'Finance',
      },
    });
  });

  it('imports warehouses by resolving the branch code', async () => {
    prisma.branch.findUnique.mockResolvedValue({ id: 22, code: 'HQ' });
    prisma.warehouse.findFirst.mockResolvedValue(null);
    prisma.warehouse.create.mockResolvedValue({ id: 81 });

    const result = await service.importWarehouses({
      rows: [
        {
          branchCode: 'HQ',
          warehouseName: 'Main Warehouse',
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        created: 1,
        updated: 0,
        failed: 0,
      }),
    );
    expect(prisma.warehouse.create).toHaveBeenCalledWith({
      data: {
        branchId: 22,
        name: 'Main Warehouse',
      },
    });
  });

  it('imports bank accounts by resolving company, branch, currency, and gl account references', async () => {
    prisma.company.findFirst.mockResolvedValue({ id: 9, code: 'HQY' });
    prisma.branch.findUnique.mockResolvedValue({ id: 4, code: 'HQ', companyId: 9 });
    prisma.currency.findUnique.mockResolvedValue({ id: 3, code: 'NGN' });
    prisma.account.findFirst.mockResolvedValue({ id: 101, code: '1000' });
    prisma.bankAccount.findFirst.mockResolvedValue(null);
    prisma.bankAccount.create.mockResolvedValue({ id: 91 });

    const result = await service.importBankAccounts({
      rows: [
        {
          companyCode: 'HQY',
          branchCode: 'HQ',
          bankName: 'Access Bank',
          accountName: 'HAQLY Operations',
          accountNumber: '0123456789',
          currencyCode: 'NGN',
          glAccountCode: '1000',
          isActive: true,
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        created: 1,
        updated: 0,
        failed: 0,
      }),
    );
    expect(prisma.bankAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'HAQLY Operations',
        accountName: 'HAQLY Operations',
        number: '0123456789',
        bankName: 'Access Bank',
        companyId: 9,
        branchId: 4,
        currencyId: 3,
        glAccountId: 101,
        isActive: true,
      }),
    });
  });

  it('imports asset categories with normalized depreciation method values', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue(null);
    prisma.assetCategory.create.mockResolvedValue({ id: 111 });

    const result = await service.importAssetCategories({
      rows: [
        {
          name: 'Computer Equipment',
          usefulLifeMonths: 36,
          residualRate: 5,
          depreciationMethod: 'straight_line',
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        created: 1,
        updated: 0,
        failed: 0,
      }),
    );
    expect(prisma.assetCategory.create).toHaveBeenCalledWith({
      data: {
        name: 'Computer Equipment',
        usefulLifeMonths: 36,
        residualRate: '5.00',
        depreciationMethod: 'STRAIGHT_LINE',
      },
    });
  });
});
