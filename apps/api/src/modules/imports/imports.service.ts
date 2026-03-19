import { Injectable, NotFoundException } from '@nestjs/common';
import { DepreciationMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface BulkImportResult {
  dataset: string;
  created: number;
  updated?: number;
  failed: number;
  errors: { row: number; message: string }[];
}

type ImportRow = Record<string, unknown>;

@Injectable()
export class ImportsService {
  constructor(private prisma: PrismaService) {}

  private scaffoldResult(dataset: string): BulkImportResult {
    return {
      dataset,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };
  }

  async importAccounts(dto: { rows?: Array<unknown> }): Promise<BulkImportResult> {
    const rows = Array.isArray(dto?.rows) ? dto.rows : [];
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    let updated = 0;

    const lookupCodes = [...new Set(rows.flatMap((rawRow) => {
      const row = rawRow as ImportRow;
      const accountCode = this.text(row.code);
      const parentCode = this.text(row.parentCode);
      return [accountCode, parentCode].filter((value): value is string => !!value).map((value) => value.toUpperCase());
    }))];

    const existingAccounts = lookupCodes.length
      ? await this.prisma.account.findMany({
          where: { code: { in: lookupCodes } },
          select: { id: true, code: true },
        })
      : [];

    const accountMap = new Map((existingAccounts ?? []).map((account) => [account.code.toUpperCase(), account]));

    for (const [index, rawRow] of rows.entries()) {
      try {
        const row = rawRow as ImportRow;
        const code = this.requiredText(row.code, 'code').toUpperCase();
        const name = this.requiredText(row.name, 'name');
        const type = this.requiredText(row.type, 'type').toUpperCase();
        const parentCode = this.text(row.parentCode)?.toUpperCase();
        const parent = parentCode ? accountMap.get(parentCode) : undefined;

        if (parentCode && !parent) {
          throw new Error(`Parent account code "${parentCode}" not found. Import parent rows before children.`);
        }

        const existing = accountMap.get(code);
        const isControlAccount = this.booleanValue(row.isControlAccount, false);
        const data = {
          code,
          name,
          type,
          description: this.text(row.description) ?? null,
          parentId: parent?.id ?? null,
          isActive: this.booleanValue(row.isActive, true),
          allowsPosting: this.booleanValue(row.allowsPosting, true),
          isControlAccount,
          controlSource: this.normalizeControlSource(row.controlSource, isControlAccount),
        };

        if (existing) {
          await this.prisma.account.update({
            where: { id: existing.id },
            data,
          });
          updated++;
        } else {
          const createdAccount = await this.prisma.account.create({ data });
          accountMap.set(code, { id: createdAccount.id, code: createdAccount.code });
          created++;
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : 'Could not import account row',
        });
      }
    }

    return {
      dataset: 'chart-of-accounts',
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  async importCustomers(dto: { companyId?: number; rows?: Array<unknown> }): Promise<BulkImportResult> {
    if (!dto?.companyId) {
      return this.missingCompanyResult('customers', dto?.rows);
    }

    await this.ensureCompanyExists(dto.companyId);

    const rows = Array.isArray(dto?.rows) ? dto.rows : [];
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    let updated = 0;

    for (const [index, rawRow] of rows.entries()) {
      try {
        const row = rawRow as ImportRow;
        const name = this.requiredText(row.name, 'name');
        const email = this.emailValue(row.email);
        const existing = await this.prisma.customer.findFirst({
          where: email
            ? { companyId: dto.companyId, OR: [{ email }, { name }] }
            : { companyId: dto.companyId, name },
          include: { addresses: true },
        });

        const data = {
          companyId: dto.companyId,
          name,
          email: email ?? null,
          phone: this.text(row.phone) ?? null,
          customerType: (this.text(row.customerType) ?? 'BUSINESS').toUpperCase(),
          contactPerson: this.text(row.contactPerson) ?? null,
          taxId: this.text(row.taxId) ?? null,
          addresses: this.buildAddressWrite(row, existing?.addresses),
        };

        if (existing) {
          await this.prisma.customer.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await this.prisma.customer.create({ data });
          created++;
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : 'Could not import customer row',
        });
      }
    }

    return {
      dataset: 'customers',
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  async importSuppliers(dto: { companyId?: number; rows?: Array<unknown> }): Promise<BulkImportResult> {
    if (!dto?.companyId) {
      return this.missingCompanyResult('suppliers', dto?.rows);
    }

    await this.ensureCompanyExists(dto.companyId);

    const rows = Array.isArray(dto?.rows) ? dto.rows : [];
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    let updated = 0;

    for (const [index, rawRow] of rows.entries()) {
      try {
        const row = rawRow as ImportRow;
        const name = this.requiredText(row.name, 'name');
        const email = this.emailValue(row.email);
        const existing = await this.prisma.supplier.findFirst({
          where: email
            ? { companyId: dto.companyId, OR: [{ email }, { name }] }
            : { companyId: dto.companyId, name },
          include: { addresses: true },
        });

        const data = {
          companyId: dto.companyId,
          name,
          email: email ?? null,
          phone: this.text(row.phone) ?? null,
          addresses: this.buildAddressWrite(row, existing?.addresses),
        };

        if (existing) {
          await this.prisma.supplier.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await this.prisma.supplier.create({ data });
          created++;
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : 'Could not import supplier row',
        });
      }
    }

    return {
      dataset: 'suppliers',
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  async importProducts(dto: { companyId?: number; rows?: Array<unknown> }): Promise<BulkImportResult> {
    if (!dto?.companyId) {
      return this.missingCompanyResult('products', dto?.rows);
    }

    await this.ensureCompanyExists(dto.companyId);

    const rows = Array.isArray(dto?.rows) ? dto.rows : [];
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    let updated = 0;

    for (const [index, rawRow] of rows.entries()) {
      try {
        const row = rawRow as ImportRow;
        const sku = this.requiredText(row.sku, 'sku').toUpperCase();
        const name = this.requiredText(row.name, 'name');
        const categoryId = await this.resolveProductCategoryId(this.text(row.category));
        const uomId = await this.resolveUnitOfMeasureId(this.text(row.uom));
        const existing = await this.prisma.product.findFirst({
          where: { companyId: dto.companyId, sku },
        });

        const data = {
          companyId: dto.companyId,
          sku,
          name,
          categoryId,
          uomId,
          isActive: this.booleanValue(row.isActive, true),
        };

        if (existing) {
          await this.prisma.product.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await this.prisma.product.create({ data });
          created++;
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : 'Could not import product row',
        });
      }
    }

    return {
      dataset: 'products',
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  async importTaxConfigs(dto: { rows?: Array<unknown> }): Promise<BulkImportResult> {
    const rows = Array.isArray(dto?.rows) ? dto.rows : [];
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    let updated = 0;

    for (const [index, rawRow] of rows.entries()) {
      try {
        const row = rawRow as ImportRow;
        const companyId = this.numberValue(row.companyId, 'companyId');
        await this.ensureCompanyExists(companyId);

        const code = this.requiredText(row.code, 'code').toUpperCase();
        const name = this.requiredText(row.name, 'name');
        const taxType = (this.text(row.taxType) ?? 'VAT').toUpperCase();
        const filingFrequency = (this.text(row.filingFrequency) ?? 'MONTHLY').toUpperCase();
        const outputAccountCode = this.text(row.outputAccountCode)?.toUpperCase();
        const inputAccountCode = this.text(row.inputAccountCode)?.toUpperCase();
        const liabilityAccountCode = this.text(row.liabilityAccountCode)?.toUpperCase();

        const accountCodes = [outputAccountCode, inputAccountCode, liabilityAccountCode].filter(
          (value): value is string => !!value,
        );

        const accounts = accountCodes.length
          ? await this.prisma.account.findMany({
              where: { code: { in: [...new Set(accountCodes)] } },
              select: { id: true, code: true },
            })
          : [];

        const accountMap = new Map(accounts.map((account) => [account.code.toUpperCase(), account.id]));
        for (const accountCode of accountCodes) {
          if (!accountMap.has(accountCode)) {
            throw new Error(`Account code "${accountCode}" not found for tax mapping`);
          }
        }

        const existing = await this.prisma.taxConfig.findFirst({
          where: { companyId, code },
        });

        const data = {
          companyId,
          code,
          name,
          taxType,
          rate: Number(row.rate ?? 0).toFixed(4),
          isInclusive: this.booleanValue(row.isInclusive, false),
          recoverable: this.booleanValue(row.recoverable, false),
          filingFrequency,
          outputAccountId: outputAccountCode ? accountMap.get(outputAccountCode) ?? null : null,
          inputAccountId: inputAccountCode ? accountMap.get(inputAccountCode) ?? null : null,
          liabilityAccountId: liabilityAccountCode ? accountMap.get(liabilityAccountCode) ?? null : null,
        };

        if (existing) {
          await this.prisma.taxConfig.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await this.prisma.taxConfig.create({ data });
          created++;
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : 'Could not import tax config row',
        });
      }
    }

    return {
      dataset: 'tax-configs',
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  async importBranches(dto: any): Promise<BulkImportResult> {
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    let updated = 0;

    for (const [index, row] of dto.rows.entries()) {
      try {
        const company = await this.prisma.company.findFirst({
          where: { code: row.companyCode?.trim() },
        });

        if (!company) {
          throw new NotFoundException(`Company ${row.companyCode} not found`);
        }

        const existing = await this.prisma.branch.findUnique({
          where: { code: row.branchCode },
        });

        if (existing) {
          await this.prisma.branch.update({
            where: { id: existing.id },
            data: {
              name: row.branchName,
              companyId: company.id,
            },
          });
          updated++;
        } else {
          await this.prisma.branch.create({
            data: {
              code: row.branchCode,
              name: row.branchName,
              companyId: company.id,
            },
          });
          created++;
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : 'Could not import branch row',
        });
      }
    }

    return {
      dataset: 'branches',
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  async importDepartments(_dto: unknown): Promise<BulkImportResult> {
    const dto = (_dto ?? {}) as { rows?: Array<unknown> };
    const rows = Array.isArray(dto.rows) ? dto.rows : [];
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    let updated = 0;

    for (const [index, rawRow] of rows.entries()) {
      try {
        const row = rawRow as ImportRow;
        const companyCode = this.requiredText(row.companyCode, 'companyCode').toUpperCase();
        const departmentName = this.requiredText(row.departmentName, 'departmentName');
        const company = await this.prisma.company.findFirst({
          where: { code: companyCode },
        });

        if (!company) {
          throw new NotFoundException(`Company ${companyCode} not found`);
        }

        const existing = await this.prisma.department.findFirst({
          where: { companyId: company.id, name: departmentName },
        });

        const data = {
          companyId: company.id,
          name: departmentName,
        };

        if (existing) {
          await this.prisma.department.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await this.prisma.department.create({ data });
          created++;
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : 'Could not import department row',
        });
      }
    }

    return {
      dataset: 'departments',
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  async importWarehouses(_dto: unknown): Promise<BulkImportResult> {
    const dto = (_dto ?? {}) as { rows?: Array<unknown> };
    const rows = Array.isArray(dto.rows) ? dto.rows : [];
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    let updated = 0;

    for (const [index, rawRow] of rows.entries()) {
      try {
        const row = rawRow as ImportRow;
        const branchCode = this.requiredText(row.branchCode, 'branchCode').toUpperCase();
        const warehouseName = this.requiredText(row.warehouseName, 'warehouseName');
        const branch = await this.prisma.branch.findUnique({
          where: { code: branchCode },
        });

        if (!branch) {
          throw new NotFoundException(`Branch ${branchCode} not found`);
        }

        const existing = await this.prisma.warehouse.findFirst({
          where: { branchId: branch.id, name: warehouseName },
        });

        const data = {
          branchId: branch.id,
          name: warehouseName,
        };

        if (existing) {
          await this.prisma.warehouse.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await this.prisma.warehouse.create({ data });
          created++;
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : 'Could not import warehouse row',
        });
      }
    }

    return {
      dataset: 'warehouses',
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  async importBankAccounts(_dto: unknown): Promise<BulkImportResult> {
    const dto = (_dto ?? {}) as { rows?: Array<unknown> };
    const rows = Array.isArray(dto.rows) ? dto.rows : [];
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    let updated = 0;

    for (const [index, rawRow] of rows.entries()) {
      try {
        const row = rawRow as ImportRow;
        const companyCode = this.requiredText(row.companyCode, 'companyCode').toUpperCase();
        const branchCode = this.requiredText(row.branchCode, 'branchCode').toUpperCase();
        const bankName = this.requiredText(row.bankName, 'bankName');
        const accountName = this.requiredText(row.accountName, 'accountName');
        const accountNumber = this.requiredText(row.accountNumber, 'accountNumber');
        const currencyCode = this.requiredText(row.currencyCode, 'currencyCode').toUpperCase();
        const glAccountCode = this.requiredText(row.glAccountCode, 'glAccountCode').toUpperCase();

        const company = await this.prisma.company.findFirst({
          where: { code: companyCode },
        });
        if (!company) {
          throw new NotFoundException(`Company ${companyCode} not found`);
        }

        const branch = await this.prisma.branch.findUnique({
          where: { code: branchCode },
        });
        if (!branch) {
          throw new NotFoundException(`Branch ${branchCode} not found`);
        }
        if (branch.companyId && branch.companyId !== company.id) {
          throw new Error(`Branch ${branchCode} does not belong to company ${companyCode}`);
        }

        const currency = (await this.prisma.currency.findUnique({
          where: { code: currencyCode },
        })) ?? (await this.prisma.currency.findFirst({ where: { code: currencyCode } }));
        if (!currency) {
          throw new NotFoundException(`Currency ${currencyCode} not found`);
        }

        const glAccount = await this.prisma.account.findFirst({
          where: { code: glAccountCode },
        });
        if (!glAccount) {
          throw new NotFoundException(`GL account ${glAccountCode} not found`);
        }

        const existing = await this.prisma.bankAccount.findFirst({
          where: { branchId: branch.id, number: accountNumber },
        });

        const data = {
          name: accountName,
          accountName,
          number: accountNumber,
          bankName,
          companyId: company.id,
          branchId: branch.id,
          currencyId: currency.id,
          glAccountId: glAccount.id,
          isActive: this.booleanValue(row.isActive, true),
        };

        if (existing) {
          await this.prisma.bankAccount.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await this.prisma.bankAccount.create({ data });
          created++;
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : 'Could not import bank account row',
        });
      }
    }

    return {
      dataset: 'bank-accounts',
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  async importAssetCategories(_dto: unknown): Promise<BulkImportResult> {
    const dto = (_dto ?? {}) as { rows?: Array<unknown> };
    const rows = Array.isArray(dto.rows) ? dto.rows : [];
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    let updated = 0;

    for (const [index, rawRow] of rows.entries()) {
      try {
        const row = rawRow as ImportRow;
        const name = this.requiredText(row.name, 'name');
        const usefulLifeMonths = this.numberValue(row.usefulLifeMonths, 'usefulLifeMonths');
        const residualRate = this.decimalValue(row.residualRate, 'residualRate', 0);
        const depreciationMethod = this.normalizeDepreciationMethod(row.depreciationMethod);

        const existing = await this.prisma.assetCategory.findFirst({
          where: { name },
        });

        const data = {
          name,
          usefulLifeMonths,
          residualRate: residualRate.toFixed(2),
          depreciationMethod,
        };

        if (existing) {
          await this.prisma.assetCategory.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await this.prisma.assetCategory.create({ data });
          created++;
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : 'Could not import asset category row',
        });
      }
    }

    return {
      dataset: 'asset-categories',
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  async importGLOpeningBalances(_dto: unknown): Promise<BulkImportResult> {
    return this.scaffoldResult('gl-opening-balances');
  }

  async importAROpeningBalances(_dto: unknown): Promise<BulkImportResult> {
    return this.scaffoldResult('ar-opening-balances');
  }

  async importAPOpeningBalances(_dto: unknown): Promise<BulkImportResult> {
    return this.scaffoldResult('ap-opening-balances');
  }

  async importCustomerReceipts(_dto: unknown): Promise<BulkImportResult> {
    return this.scaffoldResult('customer-receipts');
  }

  async importSupplierPayments(_dto: unknown): Promise<BulkImportResult> {
    return this.scaffoldResult('supplier-payments');
  }

  async importFixedAssets(_dto: unknown): Promise<BulkImportResult> {
    return this.scaffoldResult('fixed-assets');
  }

  async importStockOpeningBalances(_dto: unknown): Promise<BulkImportResult> {
    return this.scaffoldResult('stock-opening-balances');
  }

  async importGLJournalDump(dto: {
    companyId: number;
    defaultNarration?: string;
    rows: Array<unknown>;
  }): Promise<BulkImportResult> {
    const rows = Array.isArray(dto?.rows) ? dto.rows : [];
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    const updated = 0;

    const norm = (value: unknown): string => String(value ?? '').trim().toUpperCase();
    const required = (row: Record<string, unknown>, field: string): string => {
      const value = row[field];
      if (value === null || value === undefined) throw new Error(`Missing required field "${field}"`);
      const text = String(value).trim();
      if (!text) throw new Error(`Missing required field "${field}"`);
      return text;
    };
    const optional = (row: Record<string, unknown>, field: string): string | undefined => {
      const value = row[field];
      if (value === null || value === undefined) return undefined;
      const text = String(value).trim();
      return text ? text : undefined;
    };
    const numberValue = (row: Record<string, unknown>, field: string): number => {
      const value = row[field];
      if (value === null || value === undefined || value === '') return 0;
      const parsed = Number(value);
      if (Number.isNaN(parsed)) throw new Error(`Field "${field}" must be a valid number`);
      return parsed;
    };
    const parseDate = (value: string, field: string): Date => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new Error(`Field "${field}" must be a valid date`);
      return date;
    };

    if (!dto?.companyId || Number(dto.companyId) <= 0) {
      return {
        dataset: 'gl-journal-dump',
        created: 0,
        updated: 0,
        failed: rows.length || 1,
        errors: [{ row: 0, message: 'companyId is required' }],
      };
    }

    const company = await this.prisma.company.findUnique({
      where: { id: Number(dto.companyId) },
      select: { id: true, code: true, name: true },
    });

    if (!company) {
      return {
        dataset: 'gl-journal-dump',
        created: 0,
        updated: 0,
        failed: rows.length || 1,
        errors: [{ row: 0, message: `Company ${dto.companyId} not found` }],
      };
    }

    const [accounts, branches, departments, costCenters, projects, currencies, periods, fiscalYears] = await Promise.all([
      this.prisma.account.findMany({ select: { id: true, code: true, name: true, type: true } }),
      this.prisma.branch.findMany({ where: { companyId: company.id }, select: { id: true, code: true, name: true, companyId: true } }),
      this.prisma.department.findMany({ where: { companyId: company.id }, select: { id: true, name: true, companyId: true } }),
      this.prisma.costCenter.findMany({ where: { companyId: company.id }, select: { id: true, code: true, name: true, companyId: true } }),
      this.prisma.project.findMany({ where: { companyId: company.id }, select: { id: true, code: true, name: true, companyId: true } }),
      this.prisma.currency.findMany({ select: { id: true, code: true } }),
      this.prisma.accountingPeriod.findMany({ where: { companyId: company.id }, select: { id: true, name: true, startDate: true, endDate: true, status: true, fiscalYearId: true } }),
      this.prisma.fiscalYear.findMany({ where: { companyId: company.id }, select: { id: true, name: true, startDate: true, endDate: true, status: true } }),
    ]);

    const accountMap = new Map(accounts.filter((item) => !!item.code).map((item) => [norm(item.code), item]));
    const branchMap = new Map(branches.filter((item) => !!item.code).map((item) => [norm(item.code), item]));
    const departmentMap = new Map(departments.filter((item) => !!item.name).map((item) => [norm(item.name), item]));

    const costCenterMap = new Map<string, { id: number; code: string; name: string; companyId: number }>();
    for (const item of costCenters) {
      if (item.code) costCenterMap.set(norm(item.code), item);
      costCenterMap.set(norm(item.name), item);
    }

    const projectMap = new Map<string, { id: number; code: string; name: string; companyId: number }>();
    for (const item of projects) {
      if (item.code) projectMap.set(norm(item.code), item);
      projectMap.set(norm(item.name), item);
    }

    const currencyMap = new Map(currencies.filter((item) => !!item.code).map((item) => [norm(item.code), item]));
    const validRows: Array<{ rowNumber: number; row: Record<string, unknown> }> = [];

    for (const [index, rawRow] of rows.entries()) {
      const rowNumber = index + 1;
      try {
        if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
          throw new Error('Each row must be an object');
        }

        const row = rawRow as Record<string, unknown>;
        const journalNumber = required(row, 'journalNumber');
        const postingDate = required(row, 'postingDate');
        const accountCode = required(row, 'accountCode');
        const branchCode = required(row, 'branchCode');
        const debit = numberValue(row, 'debit');
        const credit = numberValue(row, 'credit');

        parseDate(postingDate, 'postingDate');
        if (!journalNumber) throw new Error('Missing required field "journalNumber"');
        if (debit < 0 || credit < 0) throw new Error('Debit and credit cannot be negative');
        if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
          throw new Error('Each row must have either debit or credit populated, but not both');
        }
        if (!accountMap.has(norm(accountCode))) throw new Error(`Account code "${accountCode}" not found`);
        if (!branchMap.has(norm(branchCode))) throw new Error(`Branch code "${branchCode}" not found`);

        const departmentCode = optional(row, 'departmentCode');
        if (departmentCode && !departmentMap.has(norm(departmentCode))) {
          throw new Error(`Department code "${departmentCode}" not found`);
        }
        const costCenterCode = optional(row, 'costCenterCode');
        if (costCenterCode && !costCenterMap.has(norm(costCenterCode))) {
          throw new Error(`Cost center code "${costCenterCode}" not found`);
        }
        const projectCode = optional(row, 'projectCode');
        if (projectCode && !projectMap.has(norm(projectCode))) {
          throw new Error(`Project code "${projectCode}" not found`);
        }
        const currencyCode = optional(row, 'currencyCode');
        if (currencyCode && !currencyMap.has(norm(currencyCode))) {
          throw new Error(`Currency code "${currencyCode}" not found`);
        }

        validRows.push({ rowNumber, row });
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Could not validate GL journal dump row',
        });
      }
    }

    const grouped = new Map<string, Array<{ rowNumber: number; row: Record<string, unknown> }>>();
    for (const item of validRows) {
      const journalNumber = required(item.row, 'journalNumber');
      const bucket = grouped.get(journalNumber) ?? [];
      bucket.push(item);
      grouped.set(journalNumber, bucket);
    }

    for (const [journalNumber, journalRows] of grouped.entries()) {
      try {
        const existingJournal = await this.prisma.gLJournalHeader.findUnique({ where: { journalNumber }, select: { id: true } });
        if (existingJournal) {
          for (const item of journalRows) {
            errors.push({ row: item.rowNumber, message: `Journal "${journalNumber}" already exists` });
          }
          continue;
        }

        const totalDebit = journalRows.reduce((sum, item) => sum + numberValue(item.row, 'debit'), 0);
        const totalCredit = journalRows.reduce((sum, item) => sum + numberValue(item.row, 'credit'), 0);
        if (Math.abs(totalDebit - totalCredit) > 0.000001) {
          for (const item of journalRows) {
            errors.push({ row: item.rowNumber, message: `Journal "${journalNumber}" is not balanced. Debit=${totalDebit}, Credit=${totalCredit}` });
          }
          continue;
        }

        const firstRow = journalRows[0].row;
        const postingDate = parseDate(required(firstRow, 'postingDate'), 'postingDate');
        const journalDate = postingDate;
        const headerBranchCode = required(firstRow, 'branchCode');
        const headerBranch = branchMap.get(norm(headerBranchCode));
        if (!headerBranch) throw new Error(`Branch code "${headerBranchCode}" not found`);

        for (const item of journalRows) {
          const rowBranchCode = required(item.row, 'branchCode');
          if (norm(rowBranchCode) !== norm(headerBranchCode)) {
            throw new Error(`Journal "${journalNumber}" contains multiple branch codes. One journal must belong to one branch`);
          }
        }

        const headerCurrencyCode = optional(firstRow, 'currencyCode') ?? 'NGN';
        for (const item of journalRows) {
          const rowCurrencyCode = optional(item.row, 'currencyCode') ?? 'NGN';
          if (norm(rowCurrencyCode) !== norm(headerCurrencyCode)) {
            throw new Error(`Journal "${journalNumber}" contains multiple currency codes. One journal must use one currency`);
          }
        }

        const period = periods.find((item) => {
          const status = String(item.status ?? '').toUpperCase();
          return postingDate >= new Date(item.startDate) && postingDate <= new Date(item.endDate) && status === 'OPEN';
        });
        if (!period) throw new Error(`No open accounting period found for ${postingDate.toISOString().slice(0, 10)}`);

        const fiscalYear = fiscalYears.find((item) => postingDate >= new Date(item.startDate) && postingDate <= new Date(item.endDate));
        const headerDepartmentCode = optional(firstRow, 'departmentCode');
        const headerDepartment = headerDepartmentCode ? departmentMap.get(norm(headerDepartmentCode)) : undefined;
        const headerCostCenterCode = optional(firstRow, 'costCenterCode');
        const headerCostCenter = headerCostCenterCode ? costCenterMap.get(norm(headerCostCenterCode)) : undefined;
        const headerProjectCode = optional(firstRow, 'projectCode');
        const headerProject = headerProjectCode ? projectMap.get(norm(headerProjectCode)) : undefined;
        const headerNarration = optional(firstRow, 'narration') ?? dto.defaultNarration ?? `Imported GL journal ${journalNumber}`;
        const referenceNumber = optional(firstRow, 'reference');
        const externalReference = optional(firstRow, 'sourceDocument');

        await this.prisma.$transaction(async (tx) => {
          const header = await tx.gLJournalHeader.create({
            data: {
              journalNumber,
              journalType: 'MANUAL',
              sourceType: 'SYSTEM',
              sourceModule: 'GL_IMPORT',
              sourceDocumentId: journalNumber,
              sourceDocumentNumber: externalReference ?? referenceNumber ?? journalNumber,
              legalEntityId: company.id,
              branchId: headerBranch.id,
              departmentId: headerDepartment?.id ?? null,
              costCenterId: headerCostCenter?.id ?? null,
              projectId: headerProject?.id ?? null,
              journalDate,
              postingDate,
              accountingPeriodId: period.id,
              fiscalYearId: fiscalYear?.id ?? period.fiscalYearId ?? null,
              currencyCode: headerCurrencyCode,
              exchangeRate: 1,
              referenceNumber: referenceNumber ?? null,
              externalReference: externalReference ?? null,
              narration: headerNarration,
              description: 'Imported from GL journal dump',
              status: 'DRAFT',
              workflowStatus: 'DRAFT',
              approvalLevel: 0,
              isSystemGenerated: true,
              isRecurring: false,
              isIntercompany: false,
              totalDebit,
              totalCredit,
            },
          });

          for (let i = 0; i < journalRows.length; i++) {
            const item = journalRows[i];
            const row = item.row;
            const accountCode = required(row, 'accountCode');
            const account = accountMap.get(norm(accountCode));
            if (!account) throw new Error(`Account code "${accountCode}" not found`);

            const branchCode = required(row, 'branchCode');
            const lineBranch = branchMap.get(norm(branchCode));
            const departmentCode = optional(row, 'departmentCode');
            const lineDepartment = departmentCode ? departmentMap.get(norm(departmentCode)) : undefined;
            const costCenterCode = optional(row, 'costCenterCode');
            const lineCostCenter = costCenterCode ? costCenterMap.get(norm(costCenterCode)) : undefined;
            const projectCode = optional(row, 'projectCode');
            const lineProject = projectCode ? projectMap.get(norm(projectCode)) : undefined;
            const currencyCode = optional(row, 'currencyCode') ?? headerCurrencyCode;
            const debit = numberValue(row, 'debit');
            const credit = numberValue(row, 'credit');
            const lineNarration = optional(row, 'narration') ?? headerNarration;
            const reference1 = optional(row, 'reference');
            const reference2 = optional(row, 'sourceDocument');

            await tx.gLJournalLine.create({
              data: {
                journalId: header.id,
                lineNumber: i + 1,
                accountId: account.id,
                accountCode: account.code,
                accountName: account.name,
                accountType: account.type,
                debitAmount: debit,
                creditAmount: credit,
                baseCurrencyDebit: debit,
                baseCurrencyCredit: credit,
                transactionCurrencyCode: currencyCode,
                exchangeRate: 1,
                branchId: lineBranch?.id ?? null,
                departmentId: lineDepartment?.id ?? null,
                costCenterId: lineCostCenter?.id ?? null,
                projectId: lineProject?.id ?? null,
                lineNarration: lineNarration ?? null,
                reference1: reference1 ?? null,
                reference2: reference2 ?? null,
              },
            });
          }
        });

        created++;
      } catch (error) {
        for (const item of journalRows) {
          errors.push({
            row: item.rowNumber,
            message: error instanceof Error ? error.message : `Could not import journal "${journalNumber}"`,
          });
        }
      }
    }

    return {
      dataset: 'gl-journal-dump',
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  private async ensureCompanyExists(companyId: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }

    return company;
  }

  private async resolveProductCategoryId(categoryName?: string) {
    if (!categoryName) {
      return null;
    }

    const normalized = categoryName.trim();
    const existing = await this.prisma.productCategory.findFirst({
      where: { name: normalized },
    });

    if (existing) {
      return existing.id;
    }

    const created = await this.prisma.productCategory.create({
      data: { name: normalized },
    });

    return created.id;
  }

  private async resolveUnitOfMeasureId(uomName?: string) {
    if (!uomName) {
      return null;
    }

    const normalized = uomName.trim();
    const existing = await this.prisma.unitOfMeasure.findFirst({
      where: {
        OR: [{ name: normalized }, { symbol: normalized }],
      },
    });

    if (existing) {
      return existing.id;
    }

    const created = await this.prisma.unitOfMeasure.create({
      data: { name: normalized, symbol: normalized },
    });

    return created.id;
  }

  private buildAddressWrite(row: ImportRow, existingAddresses?: Array<{ id: number }>) {
    if (!this.hasAddress(row)) {
      return undefined;
    }

    const addressData = {
      line1: this.requiredText(row.line1, 'line1'),
      line2: this.text(row.line2) ?? null,
      city: this.text(row.city) ?? null,
      state: this.text(row.state) ?? null,
      country: this.text(row.country) ?? null,
      postalCode: this.text(row.postalCode) ?? null,
    };

    const existingAddress = existingAddresses?.[0];
    if (existingAddress) {
      return {
        update: {
          where: { id: existingAddress.id },
          data: addressData,
        },
      };
    }

    return {
      create: addressData,
    };
  }

  private hasAddress(row: ImportRow) {
    return !!this.text(row.line1);
  }

  private missingCompanyResult(dataset: string, rows?: Array<unknown>): BulkImportResult {
    return {
      dataset,
      created: 0,
      updated: 0,
      failed: rows?.length || 1,
      errors: [{ row: 0, message: 'companyId is required' }],
    };
  }

  private normalizeControlSource(value: unknown, isControlAccount: boolean) {
    if (!isControlAccount) {
      return null;
    }

    const normalized = this.text(value)?.toUpperCase();
    if (!normalized) {
      return null;
    }

    const aliases: Record<string, string> = {
      CUSTOMER: 'SALES',
      CUSTOMERS: 'SALES',
      AR: 'SALES',
      RECEIVABLE: 'SALES',
      RECEIVABLES: 'SALES',
      SALES: 'SALES',
      SUPPLIER: 'PROCUREMENT',
      SUPPLIERS: 'PROCUREMENT',
      PURCHASE: 'PROCUREMENT',
      PURCHASES: 'PROCUREMENT',
      AP: 'PROCUREMENT',
      PAYABLE: 'PROCUREMENT',
      PAYABLES: 'PROCUREMENT',
      PROCUREMENT: 'PROCUREMENT',
      STOCK: 'INVENTORY',
      INVENTORY: 'INVENTORY',
    };

    return aliases[normalized] ?? normalized;
  }

  private requiredText(value: unknown, field: string) {
    const text = this.text(value);
    if (!text) {
      throw new Error(`Missing required field "${field}"`);
    }
    return text;
  }

  private text(value: unknown) {
    if (value === null || value === undefined) {
      return undefined;
    }
    const text = String(value).trim();
    return text ? text : undefined;
  }

  private emailValue(value: unknown) {
    const email = this.text(value);
    return email ? email.toLowerCase() : undefined;
  }

  private booleanValue(value: unknown, fallback: boolean) {
    if (typeof value === 'boolean') {
      return value;
    }

    const text = this.text(value);
    if (!text) {
      return fallback;
    }

    return text.toLowerCase() === 'true';
  }

  private decimalValue(value: unknown, field: string, minimum = Number.NEGATIVE_INFINITY) {
    const number = Number(value ?? 0);
    if (Number.isNaN(number) || number < minimum) {
      throw new Error(`Field "${field}" must be a valid number`);
    }
    return number;
  }

  private numberValue(value: unknown, field: string) {
    const number = Number(value);
    if (Number.isNaN(number) || number <= 0) {
      throw new Error(`Field "${field}" must be a valid positive number`);
    }
    return number;
  }

  private normalizeDepreciationMethod(value: unknown): DepreciationMethod {
    const normalized = this.requiredText(value, 'depreciationMethod').toUpperCase() as DepreciationMethod;
    const methods = new Set<DepreciationMethod>([
      DepreciationMethod.STRAIGHT_LINE,
      DepreciationMethod.DECLINING_BALANCE,
      DepreciationMethod.UNITS_OF_PRODUCTION,
    ]);
    if (!methods.has(normalized)) {
      throw new Error(`Unsupported depreciation method "${normalized}"`);
    }
    return normalized as DepreciationMethod;
  }
}
