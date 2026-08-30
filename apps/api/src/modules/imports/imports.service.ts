import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BulkImportAccountsDto,
  BulkImportAPOpeningBalancesDto,
  BulkImportAROpeningBalancesDto,
  BulkImportAssetCategoriesDto,
  BulkImportBankAccountsDto,
  BulkImportBranchesDto,
  BulkImportCustomerReceiptsDto,
  BulkImportCustomersDto,
  BulkImportDepartmentsDto,
  BulkImportFixedAssetsDto,
  BulkImportGLJournalDumpDto,
  BulkImportGLOpeningBalancesDto,
  BulkImportProductsDto,
  BulkImportResult,
  BulkImportStockOpeningBalancesDto,
  BulkImportSupplierPaymentsDto,
  BulkImportSuppliersDto,
  BulkImportTaxConfigsDto,
  BulkImportWarehousesDto,
} from './dto';

type RowError = BulkImportResult['errors'][number];

/** Amounts are compared as money, so anything under half a minor unit is equal. */
const MONEY_EPSILON = 0.005;

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Master data
  // ───────────────────────────────────────────────────────────────────────────

  async importAccounts(dto: BulkImportAccountsDto): Promise<BulkImportResult> {
    const errors: RowError[] = [];
    let created = 0;
    let updated = 0;

    for (const [index, row] of dto.rows.entries()) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const code = this.requireText(row.code, 'Account code is required');
          const name = this.requireText(row.name, 'Account name is required');
          const type = this.requireText(row.type, 'Account type is required').toUpperCase();

          const existing = await tx.account.findUnique({ where: { code } });
          const data = {
            name,
            type,
            description: row.description?.trim() || null,
            isActive: row.isActive ?? true,
            allowsPosting: row.allowsPosting ?? true,
            isControlAccount: row.isControlAccount ?? false,
            controlSource: row.controlSource?.trim().toUpperCase() || null,
          };

          const account = existing
            ? await tx.account.update({ where: { id: existing.id }, data })
            : await tx.account.create({ data: { code, ...data } });

          if (row.parentCode?.trim()) {
            const parent = await tx.account.findUnique({ where: { code: row.parentCode.trim() } });
            if (!parent) {
              throw new NotFoundException(`Parent account ${row.parentCode} was not found`);
            }
            if (parent.id === account.id) {
              throw new BadRequestException(`Account ${code} cannot be its own parent`);
            }
            await tx.account.update({ where: { id: account.id }, data: { parentId: parent.id } });
          }

          return existing ? 'updated' : 'created';
        });

        if (result === 'updated') updated += 1;
        else created += 1;
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import account row'));
      }
    }

    return { dataset: 'chart_of_accounts', created, updated, failed: errors.length, errors };
  }

  async importCustomers(dto: BulkImportCustomersDto): Promise<BulkImportResult> {
    return this.importCustomersOrSuppliers('customer', dto.companyId, dto.rows);
  }

  async importSuppliers(dto: BulkImportSuppliersDto): Promise<BulkImportResult> {
    return this.importCustomersOrSuppliers('supplier', dto.companyId, dto.rows);
  }

  async importProducts(dto: BulkImportProductsDto): Promise<BulkImportResult> {
    const errors: RowError[] = [];
    let created = 0;
    let updated = 0;

    await this.ensureCompanyExists(dto.companyId);

    for (const [index, row] of dto.rows.entries()) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const sku = this.requireText(row.sku, 'Product SKU is required');
          const name = this.requireText(row.name, 'Product name is required');

          let categoryId: number | undefined;
          let uomId: number | undefined;

          if (row.category?.trim()) {
            const label = row.category.trim();
            const category =
              (await tx.productCategory.findFirst({ where: { name: label } })) ??
              (await tx.productCategory.create({ data: { name: label } }));
            categoryId = category.id;
          }

          if (row.uom?.trim()) {
            const label = row.uom.trim();
            const uom =
              (await tx.unitOfMeasure.findFirst({ where: { name: label } })) ??
              (await tx.unitOfMeasure.create({
                data: { name: label, symbol: label.slice(0, 5).toLowerCase() },
              }));
            uomId = uom.id;
          }

          const existing = await tx.product.findFirst({ where: { companyId: dto.companyId, sku } });
          if (existing) {
            await tx.product.update({
              where: { id: existing.id },
              data: { name, categoryId, uomId, isActive: row.isActive ?? true },
            });
            return 'updated';
          }

          await tx.product.create({
            data: {
              companyId: dto.companyId,
              sku,
              name,
              categoryId,
              uomId,
              isActive: row.isActive ?? true,
            },
          });
          return 'created';
        });

        if (result === 'updated') updated += 1;
        else created += 1;
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import product row'));
      }
    }

    return { dataset: 'products', created, updated, failed: errors.length, errors };
  }

  async importTaxConfigs(dto: BulkImportTaxConfigsDto): Promise<BulkImportResult> {
    const errors: RowError[] = [];
    let created = 0;
    let updated = 0;

    for (const [index, row] of dto.rows.entries()) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const company = await tx.company.findUnique({ where: { id: row.companyId } });
          if (!company) {
            throw new NotFoundException(`Company ${row.companyId} was not found`);
          }

          const [outputAccountId, inputAccountId, liabilityAccountId] = await Promise.all([
            this.resolveAccountCode(tx, row.outputAccountCode),
            this.resolveAccountCode(tx, row.inputAccountCode),
            this.resolveAccountCode(tx, row.liabilityAccountCode),
          ]);

          const code = this.requireText(row.code, 'Tax code is required').toUpperCase();
          const name = this.requireText(row.name, 'Tax name is required');
          const existing = await tx.taxConfig.findFirst({ where: { companyId: row.companyId, code } });

          const payload = {
            code,
            name,
            taxType: row.taxType?.trim().toUpperCase() ?? 'VAT',
            rate: new Prisma.Decimal(row.rate),
            isInclusive: row.isInclusive ?? false,
            recoverable: row.recoverable ?? false,
            filingFrequency: row.filingFrequency?.trim().toUpperCase() ?? 'MONTHLY',
            outputAccountId,
            inputAccountId,
            liabilityAccountId,
            companyId: row.companyId,
          };

          if (existing) {
            await tx.taxConfig.update({ where: { id: existing.id }, data: payload });
            return 'updated';
          }

          await tx.taxConfig.create({ data: payload });
          return 'created';
        });

        if (result === 'updated') updated += 1;
        else created += 1;
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import tax config row'));
      }
    }

    return { dataset: 'tax_codes', created, updated, failed: errors.length, errors };
  }

  async importBranches(dto: BulkImportBranchesDto): Promise<BulkImportResult> {
    const errors: RowError[] = [];
    let created = 0;
    let updated = 0;

    for (const [index, row] of dto.rows.entries()) {
      try {
        const company = await this.requireCompanyByCode(row.companyCode);
        const code = this.requireText(row.branchCode, 'Branch code is required');
        const name = this.requireText(row.branchName, 'Branch name is required');

        const existing = await this.prisma.branch.findUnique({ where: { code } });
        if (existing) {
          await this.prisma.branch.update({
            where: { id: existing.id },
            data: { name, companyId: company.id },
          });
          updated += 1;
        } else {
          await this.prisma.branch.create({ data: { code, name, companyId: company.id } });
          created += 1;
        }
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import branch row'));
      }
    }

    return { dataset: 'branches', created, updated, failed: errors.length, errors };
  }

  async importDepartments(dto: BulkImportDepartmentsDto): Promise<BulkImportResult> {
    const errors: RowError[] = [];
    let created = 0;
    let updated = 0;

    for (const [index, row] of dto.rows.entries()) {
      try {
        const company = await this.requireCompanyByCode(row.companyCode);
        const name = this.requireText(row.departmentName, 'Department name is required');

        const existing = await this.prisma.department.findFirst({
          where: { companyId: company.id, name },
        });

        if (existing) {
          updated += 1;
        } else {
          await this.prisma.department.create({ data: { name, companyId: company.id } });
          created += 1;
        }
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import department row'));
      }
    }

    return { dataset: 'departments', created, updated, failed: errors.length, errors };
  }

  async importWarehouses(dto: BulkImportWarehousesDto): Promise<BulkImportResult> {
    const errors: RowError[] = [];
    let created = 0;
    let updated = 0;

    for (const [index, row] of dto.rows.entries()) {
      try {
        const branchCode = this.requireText(row.branchCode, 'Branch code is required');
        const name = this.requireText(row.warehouseName, 'Warehouse name is required');

        const branch = await this.prisma.branch.findUnique({ where: { code: branchCode } });
        if (!branch) {
          throw new NotFoundException(`Branch ${branchCode} was not found`);
        }

        const existing = await this.prisma.warehouse.findFirst({
          where: { branchId: branch.id, name },
        });

        if (existing) {
          updated += 1;
        } else {
          await this.prisma.warehouse.create({ data: { name, branchId: branch.id } });
          created += 1;
        }
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import warehouse row'));
      }
    }

    return { dataset: 'warehouses', created, updated, failed: errors.length, errors };
  }

  async importBankAccounts(dto: BulkImportBankAccountsDto): Promise<BulkImportResult> {
    const errors: RowError[] = [];
    let created = 0;
    let updated = 0;

    for (const [index, row] of dto.rows.entries()) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const company = await this.requireCompanyByCode(row.companyCode, tx);
          const branchCode = this.requireText(row.branchCode, 'Branch code is required');
          const branch = await tx.branch.findUnique({ where: { code: branchCode } });
          if (!branch) {
            throw new NotFoundException(`Branch ${branchCode} was not found`);
          }

          const accountNumber = this.requireText(row.accountNumber, 'Account number is required');
          const accountName = this.requireText(row.accountName, 'Account name is required');
          const bankName = this.requireText(row.bankName, 'Bank name is required');

          const currencyCode = row.currencyCode?.trim().toUpperCase();
          let currencyId: number | null = null;
          if (currencyCode) {
            const currency = await tx.currency.findFirst({ where: { code: currencyCode } });
            if (!currency) {
              throw new NotFoundException(`Currency ${currencyCode} was not found`);
            }
            currencyId = currency.id;
          }

          const glAccountId = await this.resolveAccountCode(tx, row.glAccountCode);

          const data = {
            name: accountName,
            accountName,
            number: accountNumber,
            bankName,
            companyId: company.id,
            branchId: branch.id,
            currencyId,
            glAccountId,
            isActive: row.isActive ?? true,
          };

          const existing = await tx.bankAccount.findFirst({
            where: { companyId: company.id, number: accountNumber },
          });

          if (existing) {
            await tx.bankAccount.update({ where: { id: existing.id }, data });
            return 'updated';
          }

          await tx.bankAccount.create({ data });
          return 'created';
        });

        if (result === 'updated') updated += 1;
        else created += 1;
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import bank account row'));
      }
    }

    return { dataset: 'bank_accounts', created, updated, failed: errors.length, errors };
  }

  async importAssetCategories(dto: BulkImportAssetCategoriesDto): Promise<BulkImportResult> {
    const errors: RowError[] = [];
    let created = 0;
    let updated = 0;

    for (const [index, row] of dto.rows.entries()) {
      try {
        const name = this.requireText(row.name, 'Asset category name is required');
        const usefulLifeMonths = Number(row.usefulLifeMonths);
        if (!Number.isFinite(usefulLifeMonths) || usefulLifeMonths <= 0) {
          throw new BadRequestException('Useful life (months) must be greater than zero');
        }

        const data = {
          usefulLifeMonths: Math.round(usefulLifeMonths),
          residualRate: new Prisma.Decimal(row.residualRate ?? 0),
          depreciationMethod: this.parseDepreciationMethod(row.depreciationMethod),
        };

        const existing = await this.prisma.assetCategory.findFirst({ where: { name } });
        if (existing) {
          await this.prisma.assetCategory.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await this.prisma.assetCategory.create({ data: { name, ...data } });
          created += 1;
        }
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import asset category row'));
      }
    }

    return { dataset: 'asset_categories', created, updated, failed: errors.length, errors };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Opening-balance migration
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Opening balances post as a single balanced journal. The batch is all-or-nothing:
   * a partially posted opening balance would leave the ledger out of balance.
   */
  async importGLOpeningBalances(dto: BulkImportGLOpeningBalancesDto): Promise<BulkImportResult> {
    const dataset = 'gl_opening_balances';
    const errors: RowError[] = [];

    const company = await this.ensureCompanyExists(dto.companyId);
    const reference = this.requireText(dto.reference, 'Opening balance reference is required');
    const openingDate = this.parseDate(dto.openingDate, 'openingDate');

    const existing = await this.prisma.journalEntry.findUnique({ where: { reference } });
    if (existing) {
      return this.batchFailure(dataset, dto.rows.length, `Opening balance "${reference}" has already been imported`);
    }

    const accounts = await this.prisma.account.findMany({ select: { id: true, code: true } });
    const accountMap = new Map(accounts.map((account) => [this.norm(account.code), account.id]));

    const branches = await this.prisma.branch.findMany({
      where: { companyId: company.id },
      select: { id: true, code: true },
    });
    const branchMap = new Map(branches.map((branch) => [this.norm(branch.code), branch.id]));

    const lines: Prisma.JournalLineCreateManyEntryInput[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const [index, row] of dto.rows.entries()) {
      try {
        const accountCode = this.requireText(row.accountCode, 'Account code is required');
        const accountId = accountMap.get(this.norm(accountCode));
        if (!accountId) {
          throw new NotFoundException(`Account code "${accountCode}" was not found`);
        }

        const debit = this.money(row.debit, 'debit');
        const credit = this.money(row.credit, 'credit');
        if (debit > 0 && credit > 0) {
          throw new BadRequestException('A row may carry either a debit or a credit, not both');
        }
        if (debit === 0 && credit === 0) {
          throw new BadRequestException('A row must carry either a debit or a credit');
        }

        let branchId: number | null = null;
        if (row.branchCode?.trim()) {
          const resolved = branchMap.get(this.norm(row.branchCode));
          if (!resolved) {
            throw new NotFoundException(`Branch code "${row.branchCode}" was not found`);
          }
          branchId = resolved;
        }

        totalDebit += debit;
        totalCredit += credit;

        lines.push({
          accountId,
          branchId,
          debit: new Prisma.Decimal(debit),
          credit: new Prisma.Decimal(credit),
          memo: row.narration?.trim() || dto.narration?.trim() || `Opening balance ${reference}`,
        });
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not validate opening balance row'));
      }
    }

    if (errors.length > 0) {
      return { dataset, created: 0, updated: 0, failed: errors.length, errors };
    }

    if (lines.length === 0) {
      return this.batchFailure(dataset, dto.rows.length, 'No opening balance rows to import');
    }

    if (Math.abs(totalDebit - totalCredit) > MONEY_EPSILON) {
      return this.batchFailure(
        dataset,
        dto.rows.length,
        `Opening balances are not balanced. Debit=${totalDebit.toFixed(2)}, Credit=${totalCredit.toFixed(2)}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          reference,
          type: 'GENERAL',
          date: openingDate,
          description: dto.narration?.trim() || `Opening balances for ${company.name}`,
        },
      });

      await tx.journalLine.createMany({
        data: lines.map((line) => ({ ...line, entryId: entry.id })),
      });
    });

    return { dataset, created: lines.length, updated: 0, failed: 0, errors: [] };
  }

  async importAROpeningBalances(dto: BulkImportAROpeningBalancesDto): Promise<BulkImportResult> {
    const dataset = 'ar_opening_balances';
    const errors: RowError[] = [];
    let created = 0;

    const company = await this.ensureCompanyExists(dto.companyId);
    this.parseDate(dto.openingDate, 'openingDate');

    for (const [index, row] of dto.rows.entries()) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const number = this.requireText(row.invoiceNumber, 'Invoice number is required');
          const amount = this.money(row.amount, 'amount');
          const outstanding = this.money(row.outstanding, 'outstanding');

          if (outstanding > amount + MONEY_EPSILON) {
            throw new BadRequestException('Outstanding amount cannot exceed the invoice amount');
          }
          if (outstanding <= 0) {
            throw new BadRequestException('Nothing outstanding to migrate — row skipped');
          }

          const duplicate = await tx.salesInvoice.findUnique({ where: { number } });
          if (duplicate) {
            throw new BadRequestException(`Invoice "${number}" has already been imported`);
          }

          const customer = await this.findOrCreateCustomer(
            tx,
            company.id,
            this.requireText(row.customerName, 'Customer name is required'),
            row.customerEmail,
          );

          await tx.salesInvoice.create({
            data: {
              number,
              legalEntityId: company.id,
              customerId: customer.id,
              date: this.parseDate(row.invoiceDate, 'invoiceDate'),
              dueDate: this.parseDate(row.dueDate, 'dueDate'),
              status: outstanding < amount - MONEY_EPSILON ? 'PARTIALLY_PAID' : 'OPEN',
              total: new Prisma.Decimal(outstanding),
            },
          });
        });

        created += 1;
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import AR opening balance row'));
      }
    }

    return { dataset, created, updated: 0, failed: errors.length, errors };
  }

  async importAPOpeningBalances(dto: BulkImportAPOpeningBalancesDto): Promise<BulkImportResult> {
    const dataset = 'ap_opening_balances';
    const errors: RowError[] = [];
    let created = 0;

    const company = await this.ensureCompanyExists(dto.companyId);
    this.parseDate(dto.openingDate, 'openingDate');

    for (const [index, row] of dto.rows.entries()) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const number = this.requireText(row.billNumber, 'Bill number is required');
          const amount = this.money(row.amount, 'amount');
          const outstanding = this.money(row.outstanding, 'outstanding');

          if (outstanding > amount + MONEY_EPSILON) {
            throw new BadRequestException('Outstanding amount cannot exceed the bill amount');
          }
          if (outstanding <= 0) {
            throw new BadRequestException('Nothing outstanding to migrate — row skipped');
          }

          const duplicate = await tx.purchaseBill.findUnique({ where: { number } });
          if (duplicate) {
            throw new BadRequestException(`Bill "${number}" has already been imported`);
          }

          const supplier = await this.findOrCreateSupplier(
            tx,
            company.id,
            this.requireText(row.supplierName, 'Supplier name is required'),
            row.supplierEmail,
          );

          await tx.purchaseBill.create({
            data: {
              number,
              legalEntityId: company.id,
              supplierId: supplier.id,
              date: this.parseDate(row.billDate, 'billDate'),
              dueDate: this.parseDate(row.dueDate, 'dueDate'),
              status: outstanding < amount - MONEY_EPSILON ? 'PARTIALLY_PAID' : 'OPEN',
              total: new Prisma.Decimal(outstanding),
            },
          });
        });

        created += 1;
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import AP opening balance row'));
      }
    }

    return { dataset, created, updated: 0, failed: errors.length, errors };
  }

  async importCustomerReceipts(dto: BulkImportCustomerReceiptsDto): Promise<BulkImportResult> {
    const dataset = 'customer_receipts';
    const errors: RowError[] = [];
    let created = 0;

    const company = await this.ensureCompanyExists(dto.companyId);
    const branch = await this.requirePrimaryBranch(company.id);
    // SALES is what the bootstrap seed sets, because the posting engine compares
    // controlSource against the posting module; the rest are older conventions.
    const receivableAccount = await this.requireControlAccount('AR', [
      'AR',
      'RECEIVABLE',
      'ACCOUNTS_RECEIVABLE',
      'SALES',
    ]);

    for (const [index, row] of dto.rows.entries()) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const receiptNumber = this.requireText(row.receiptNumber, 'Receipt number is required');
          const amount = this.money(row.amount, 'amount');
          if (amount <= 0) {
            throw new BadRequestException('Receipt amount must be greater than zero');
          }

          const duplicate = await tx.customerReceiptHeader.findUnique({ where: { receiptNumber } });
          if (duplicate) {
            throw new BadRequestException(`Receipt "${receiptNumber}" has already been imported`);
          }

          const customer = await this.findOrCreateCustomer(
            tx,
            company.id,
            this.requireText(row.customerName, 'Customer name is required'),
          );

          const receiptDate = this.parseDate(row.receiptDate, 'receiptDate');
          const cashAccountId = await this.resolveAccountCode(tx, row.bankAccountCode);

          let invoiceId: number | null = null;
          if (row.invoiceReference?.trim()) {
            const invoice = await tx.salesInvoice.findUnique({
              where: { number: row.invoiceReference.trim() },
            });
            if (!invoice) {
              throw new NotFoundException(`Invoice "${row.invoiceReference}" was not found`);
            }
            invoiceId = invoice.id;
          }

          const narration =
            row.narration?.trim() || `Imported customer receipt ${receiptNumber}`;

          const receipt = await tx.customerReceiptHeader.create({
            data: {
              receiptNumber,
              legalEntityId: company.id,
              branchId: branch.id,
              customerId: customer.id,
              cashAccountId,
              receivableAccountId: receivableAccount.id,
              paymentMethod: this.parsePaymentMethod(row.paymentMethod),
              paymentDate: receiptDate,
              postingDate: receiptDate,
              currencyCode: 'NGN',
              exchangeRate: new Prisma.Decimal(1),
              amount: new Prisma.Decimal(amount),
              externalReference: receiptNumber,
              narration,
              status: 'POSTED',
              postedAt: receiptDate,
            },
          });

          await tx.customerReceiptLine.create({
            data: {
              receiptId: receipt.id,
              lineNumber: 1,
              invoiceId,
              description: narration,
              appliedAmount: new Prisma.Decimal(amount),
            },
          });
        });

        created += 1;
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import customer receipt row'));
      }
    }

    return { dataset, created, updated: 0, failed: errors.length, errors };
  }

  async importSupplierPayments(dto: BulkImportSupplierPaymentsDto): Promise<BulkImportResult> {
    const dataset = 'supplier_payments';
    const errors: RowError[] = [];
    let created = 0;

    const company = await this.ensureCompanyExists(dto.companyId);
    const branch = await this.requirePrimaryBranch(company.id);
    const payableAccount = await this.requireControlAccount('AP', [
      'AP',
      'PAYABLE',
      'ACCOUNTS_PAYABLE',
      'PROCUREMENT',
    ]);

    for (const [index, row] of dto.rows.entries()) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const voucherNumber = this.requireText(row.paymentReference, 'Payment reference is required');
          const amount = this.money(row.amount, 'amount');
          if (amount <= 0) {
            throw new BadRequestException('Payment amount must be greater than zero');
          }

          const duplicate = await tx.aPPaymentVoucherHeader.findUnique({ where: { voucherNumber } });
          if (duplicate) {
            throw new BadRequestException(`Payment "${voucherNumber}" has already been imported`);
          }

          const supplierName = this.requireText(row.supplierName, 'Supplier name is required');
          const supplier = await this.findOrCreateSupplier(tx, company.id, supplierName);

          const paymentDate = this.parseDate(row.paymentDate, 'paymentDate');
          const period = await this.requireAccountingPeriod(tx, company.id, paymentDate);
          const cashAccountId = await this.resolveAccountCode(tx, row.bankAccountCode);

          const narration = row.narration?.trim() || `Imported supplier payment ${voucherNumber}`;

          const voucher = await tx.aPPaymentVoucherHeader.create({
            data: {
              voucherNumber,
              voucherType: 'VENDOR_PAYMENT',
              sourceType: 'SYSTEM',
              sourceModule: 'AP_IMPORT',
              sourceDocumentNumber: voucherNumber,
              legalEntityId: company.id,
              branchId: branch.id,
              beneficiaryType: 'VENDOR',
              beneficiaryName: supplierName,
              supplierId: supplier.id,
              payableAccountId: payableAccount.id,
              cashAccountId,
              paymentMethod: this.parsePaymentMethod(row.paymentMethod),
              currencyCode: 'NGN',
              exchangeRate: new Prisma.Decimal(1),
              voucherDate: paymentDate,
              requestedPaymentDate: paymentDate,
              postingDate: paymentDate,
              accountingPeriodId: period.id,
              fiscalYearId: period.fiscalYearId,
              referenceNumber: voucherNumber,
              invoiceReference: row.billReference?.trim() || null,
              narration,
              purposeOfPayment: narration,
              totalAmount: new Prisma.Decimal(amount),
              netPaymentAmount: new Prisma.Decimal(amount),
              status: 'PAID',
              workflowStatus: 'APPROVED',
              paymentStatus: 'PAID',
              isSystemGenerated: true,
              paidAt: paymentDate,
              postedAt: paymentDate,
            },
          });

          await tx.aPPaymentVoucherLine.create({
            data: {
              paymentVoucherId: voucher.id,
              lineNumber: 1,
              lineType: 'INVOICE_SETTLEMENT',
              accountId: payableAccount.id,
              accountCode: payableAccount.code,
              accountName: payableAccount.name,
              sourceInvoiceNumber: row.billReference?.trim() || null,
              description: narration,
              grossAmount: new Prisma.Decimal(amount),
              netAmount: new Prisma.Decimal(amount),
              branchId: branch.id,
              lineStatus: 'SETTLED',
            },
          });
        });

        created += 1;
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import supplier payment row'));
      }
    }

    return { dataset, created, updated: 0, failed: errors.length, errors };
  }

  /**
   * Assets carry no accumulated-depreciation column, so the migrated total is
   * written as a single opening depreciation line per asset.
   */
  async importFixedAssets(dto: BulkImportFixedAssetsDto): Promise<BulkImportResult> {
    const dataset = 'fixed_assets';
    const errors: RowError[] = [];
    let created = 0;
    let updated = 0;

    const company = await this.ensureCompanyExists(dto.companyId);
    const asOfDate = this.parseDate(dto.asOfDate, 'asOfDate');

    const branches = await this.prisma.branch.findMany({
      where: { companyId: company.id },
      select: { id: true, code: true, name: true },
    });

    const findBranch = (location?: string): number | null => {
      if (!location?.trim()) return null;
      const key = this.norm(location);
      const match = branches.find(
        (branch) => this.norm(branch.code) === key || this.norm(branch.name) === key,
      );
      return match?.id ?? null;
    };

    let openingRunId: number | null = null;

    for (const [index, row] of dto.rows.entries()) {
      try {
        const outcome = await this.prisma.$transaction(async (tx) => {
          const tag = this.requireText(row.assetCode, 'Asset code is required');
          const name = this.requireText(row.assetName, 'Asset name is required');
          const categoryName = this.requireText(row.category, 'Asset category is required');

          const cost = this.money(row.costPrice, 'costPrice');
          const accumulated = this.money(row.accumulatedDepreciation, 'accumulatedDepreciation');
          const netBookValue = this.money(row.netBookValue, 'netBookValue');

          if (accumulated > cost + MONEY_EPSILON) {
            throw new BadRequestException('Accumulated depreciation cannot exceed the asset cost');
          }
          if (Math.abs(cost - accumulated - netBookValue) > MONEY_EPSILON) {
            throw new BadRequestException(
              `Net book value ${netBookValue.toFixed(2)} does not equal cost ${cost.toFixed(2)} less accumulated depreciation ${accumulated.toFixed(2)}`,
            );
          }

          const usefulLifeMonths = row.usefulLifeYears
            ? Math.round(Number(row.usefulLifeYears) * 12)
            : 60;

          const category =
            (await tx.assetCategory.findFirst({ where: { name: categoryName } })) ??
            (await tx.assetCategory.create({
              data: {
                name: categoryName,
                usefulLifeMonths,
                residualRate: new Prisma.Decimal(0),
                depreciationMethod: this.parseDepreciationMethod(row.depreciationMethod),
              },
            }));

          const acquisitionDate = this.parseDate(row.acquisitionDate, 'acquisitionDate');
          const data = {
            name,
            categoryId: category.id,
            branchId: findBranch(row.location),
            acquisitionDate,
            acquisitionCost: new Prisma.Decimal(cost),
            depreciationStart: acquisitionDate,
          };

          const existing = await tx.asset.findUnique({ where: { tag } });
          const asset = existing
            ? await tx.asset.update({ where: { id: existing.id }, data })
            : await tx.asset.create({ data: { tag, ...data } });

          if (accumulated > 0) {
            if (openingRunId === null) {
              const run = await tx.depreciationRun.create({
                data: {
                  periodStart: asOfDate,
                  periodEnd: asOfDate,
                  book: 'book',
                  status: 'POSTED',
                },
              });
              openingRunId = run.id;
            }

            await tx.depreciationLine.deleteMany({
              where: { assetId: asset.id, runId: openingRunId },
            });

            await tx.depreciationLine.create({
              data: {
                runId: openingRunId,
                assetId: asset.id,
                amount: new Prisma.Decimal(0),
                accumulated: new Prisma.Decimal(accumulated),
                periodStart: asOfDate,
                periodEnd: asOfDate,
              },
            });
          }

          return existing ? 'updated' : 'created';
        });

        if (outcome === 'updated') updated += 1;
        else created += 1;
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import fixed asset row'));
      }
    }

    return { dataset, created, updated, failed: errors.length, errors };
  }

  async importStockOpeningBalances(
    dto: BulkImportStockOpeningBalancesDto,
  ): Promise<BulkImportResult> {
    const dataset = 'stock_opening_balances';
    const errors: RowError[] = [];
    let created = 0;

    const company = await this.ensureCompanyExists(dto.companyId);
    const openingDate = this.parseDate(dto.openingDate, 'openingDate');
    const branch = await this.requirePrimaryBranch(company.id);
    const reference = `OPENING-STOCK-${openingDate.toISOString().slice(0, 10)}`;

    for (const [index, row] of dto.rows.entries()) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const sku = this.requireText(row.sku, 'Product SKU is required');
          const warehouseName = this.requireText(row.warehouseName, 'Warehouse name is required');

          const quantity = this.money(row.quantity, 'quantity');
          const unitCost = this.money(row.unitCost, 'unitCost');
          const totalValue = this.money(row.totalValue, 'totalValue');

          if (quantity <= 0) {
            throw new BadRequestException('Opening quantity must be greater than zero');
          }
          if (Math.abs(quantity * unitCost - totalValue) > MONEY_EPSILON) {
            throw new BadRequestException(
              `Total value ${totalValue.toFixed(2)} does not equal quantity × unit cost ${(quantity * unitCost).toFixed(2)}`,
            );
          }

          const product = await tx.product.findFirst({ where: { companyId: company.id, sku } });
          if (!product) {
            throw new NotFoundException(`Product SKU "${sku}" was not found`);
          }

          const warehouse =
            (await tx.warehouse.findFirst({
              where: { name: warehouseName, branch: { companyId: company.id } },
            })) ??
            (await tx.warehouse.create({ data: { name: warehouseName, branchId: branch.id } }));

          const duplicate = await tx.stockMovement.findFirst({
            where: { productId: product.id, warehouseId: warehouse.id, reference },
          });
          if (duplicate) {
            throw new BadRequestException(
              `Opening stock for SKU "${sku}" in "${warehouseName}" has already been imported`,
            );
          }

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              warehouseId: warehouse.id,
              quantity: new Prisma.Decimal(quantity),
              direction: 'IN',
              reference,
            },
          });
        });

        created += 1;
      } catch (error) {
        errors.push(this.rowError(index, error, 'Could not import stock opening balance row'));
      }
    }

    return { dataset, created, updated: 0, failed: errors.length, errors };
  }

  /**
   * Bulk transaction history from a legacy ledger. Rows are grouped by journal
   * number; each journal must balance and belong to a single branch and currency.
   */
  async importGLJournalDump(dto: BulkImportGLJournalDumpDto): Promise<BulkImportResult> {
    const dataset = 'gl_journal_dump';
    const rows = Array.isArray(dto?.rows) ? dto.rows : [];
    const errors: RowError[] = [];
    let created = 0;

    if (!dto?.companyId || Number(dto.companyId) <= 0) {
      return this.batchFailure(dataset, rows.length, 'companyId is required');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: Number(dto.companyId) },
      select: { id: true, code: true, name: true },
    });

    if (!company) {
      return this.batchFailure(dataset, rows.length, `Company ${dto.companyId} was not found`);
    }

    const [accounts, branches, departments, costCenters, projects, currencies, periods, fiscalYears] =
      await Promise.all([
        this.prisma.account.findMany({ select: { id: true, code: true, name: true, type: true } }),
        this.prisma.branch.findMany({
          where: { companyId: company.id },
          select: { id: true, code: true, name: true },
        }),
        this.prisma.department.findMany({
          where: { companyId: company.id },
          select: { id: true, name: true },
        }),
        this.prisma.costCenter.findMany({
          where: { companyId: company.id },
          select: { id: true, code: true, name: true },
        }),
        this.prisma.project.findMany({
          where: { companyId: company.id },
          select: { id: true, code: true, name: true },
        }),
        this.prisma.currency.findMany({ select: { id: true, code: true } }),
        this.prisma.accountingPeriod.findMany({
          where: { companyId: company.id },
          select: { id: true, startDate: true, endDate: true, status: true, fiscalYearId: true },
        }),
        this.prisma.fiscalYear.findMany({
          where: { companyId: company.id },
          select: { id: true, startDate: true, endDate: true },
        }),
      ]);

    const accountMap = new Map(accounts.map((item) => [this.norm(item.code), item]));
    const branchMap = new Map(branches.map((item) => [this.norm(item.code), item]));
    const departmentMap = new Map(departments.map((item) => [this.norm(item.name), item]));
    const currencyMap = new Map(currencies.map((item) => [this.norm(item.code), item]));

    const costCenterMap = new Map<string, { id: number }>();
    for (const item of costCenters) {
      if (item.code) costCenterMap.set(this.norm(item.code), item);
      costCenterMap.set(this.norm(item.name), item);
    }

    const projectMap = new Map<string, { id: number }>();
    for (const item of projects) {
      if (item.code) projectMap.set(this.norm(item.code), item);
      projectMap.set(this.norm(item.name), item);
    }

    type DumpRow = (typeof rows)[number];
    const validRows: Array<{ rowNumber: number; row: DumpRow }> = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 1;
      try {
        const journalNumber = this.requireText(row.journalNumber, 'Journal number is required');
        const accountCode = this.requireText(row.accountCode, 'Account code is required');
        const branchCode = this.requireText(row.branchCode, 'Branch code is required');
        this.parseDate(row.postingDate, 'postingDate');

        const debit = this.money(row.debit, 'debit');
        const credit = this.money(row.credit, 'credit');
        if (debit > 0 && credit > 0) {
          throw new BadRequestException('A row may carry either a debit or a credit, not both');
        }
        if (debit === 0 && credit === 0) {
          throw new BadRequestException('A row must carry either a debit or a credit');
        }

        if (!accountMap.has(this.norm(accountCode))) {
          throw new NotFoundException(`Account code "${accountCode}" was not found`);
        }
        if (!branchMap.has(this.norm(branchCode))) {
          throw new NotFoundException(`Branch code "${branchCode}" was not found`);
        }
        if (row.departmentCode && !departmentMap.has(this.norm(row.departmentCode))) {
          throw new NotFoundException(`Department "${row.departmentCode}" was not found`);
        }
        if (row.costCenterCode && !costCenterMap.has(this.norm(row.costCenterCode))) {
          throw new NotFoundException(`Cost center "${row.costCenterCode}" was not found`);
        }
        if (row.projectCode && !projectMap.has(this.norm(row.projectCode))) {
          throw new NotFoundException(`Project "${row.projectCode}" was not found`);
        }
        if (row.currencyCode && !currencyMap.has(this.norm(row.currencyCode))) {
          throw new NotFoundException(`Currency "${row.currencyCode}" was not found`);
        }

        void journalNumber;
        validRows.push({ rowNumber, row });
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: this.errorMessage(error, 'Could not validate GL journal dump row'),
        });
      }
    }

    const grouped = new Map<string, Array<{ rowNumber: number; row: DumpRow }>>();
    for (const item of validRows) {
      const key = item.row.journalNumber.trim();
      const bucket = grouped.get(key) ?? [];
      bucket.push(item);
      grouped.set(key, bucket);
    }

    for (const [journalNumber, journalRows] of grouped.entries()) {
      try {
        const existing = await this.prisma.gLJournalHeader.findUnique({
          where: { journalNumber },
          select: { id: true },
        });
        if (existing) {
          throw new BadRequestException(`Journal "${journalNumber}" has already been imported`);
        }

        const totalDebit = journalRows.reduce((sum, item) => sum + this.money(item.row.debit, 'debit'), 0);
        const totalCredit = journalRows.reduce((sum, item) => sum + this.money(item.row.credit, 'credit'), 0);

        if (Math.abs(totalDebit - totalCredit) > MONEY_EPSILON) {
          throw new BadRequestException(
            `Journal "${journalNumber}" is not balanced. Debit=${totalDebit.toFixed(2)}, Credit=${totalCredit.toFixed(2)}`,
          );
        }

        const firstRow = journalRows[0].row;
        const postingDate = this.parseDate(firstRow.postingDate, 'postingDate');

        const headerBranchCode = this.norm(firstRow.branchCode);
        const headerBranch = branchMap.get(headerBranchCode)!;
        const headerCurrencyCode = this.norm(firstRow.currencyCode ?? 'NGN');

        for (const item of journalRows) {
          if (this.norm(item.row.branchCode) !== headerBranchCode) {
            throw new BadRequestException(
              `Journal "${journalNumber}" spans multiple branches. A journal must belong to one branch`,
            );
          }
          if (this.norm(item.row.currencyCode ?? 'NGN') !== headerCurrencyCode) {
            throw new BadRequestException(
              `Journal "${journalNumber}" spans multiple currencies. A journal must use one currency`,
            );
          }
        }

        const period = periods.find(
          (item) =>
            String(item.status ?? '').toUpperCase() === 'OPEN' &&
            postingDate >= new Date(item.startDate) &&
            postingDate <= new Date(item.endDate),
        );
        if (!period) {
          throw new BadRequestException(
            `No open accounting period covers ${postingDate.toISOString().slice(0, 10)}`,
          );
        }

        const fiscalYear = fiscalYears.find(
          (item) => postingDate >= new Date(item.startDate) && postingDate <= new Date(item.endDate),
        );

        const headerDepartment = firstRow.departmentCode
          ? departmentMap.get(this.norm(firstRow.departmentCode))
          : undefined;
        const headerCostCenter = firstRow.costCenterCode
          ? costCenterMap.get(this.norm(firstRow.costCenterCode))
          : undefined;
        const headerProject = firstRow.projectCode
          ? projectMap.get(this.norm(firstRow.projectCode))
          : undefined;

        const headerNarration =
          firstRow.narration?.trim() ||
          dto.defaultNarration?.trim() ||
          `Imported GL journal ${journalNumber}`;

        const referenceNumber = firstRow.reference?.trim() || null;
        const externalReference = firstRow.sourceDocument?.trim() || null;

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
              journalDate: postingDate,
              postingDate,
              accountingPeriodId: period.id,
              fiscalYearId: fiscalYear?.id ?? period.fiscalYearId ?? null,
              currencyCode: headerCurrencyCode,
              exchangeRate: new Prisma.Decimal(1),
              referenceNumber,
              externalReference,
              narration: headerNarration,
              description: 'Imported from GL journal dump',
              status: 'DRAFT',
              workflowStatus: 'DRAFT',
              approvalLevel: 0,
              isSystemGenerated: true,
              isRecurring: false,
              isIntercompany: false,
              totalDebit: new Prisma.Decimal(totalDebit),
              totalCredit: new Prisma.Decimal(totalCredit),
            },
          });

          for (const [lineIndex, item] of journalRows.entries()) {
            const row = item.row;
            const account = accountMap.get(this.norm(row.accountCode))!;
            const lineBranch = branchMap.get(this.norm(row.branchCode));
            const lineDepartment = row.departmentCode
              ? departmentMap.get(this.norm(row.departmentCode))
              : undefined;
            const lineCostCenter = row.costCenterCode
              ? costCenterMap.get(this.norm(row.costCenterCode))
              : undefined;
            const lineProject = row.projectCode
              ? projectMap.get(this.norm(row.projectCode))
              : undefined;

            const debit = this.money(row.debit, 'debit');
            const credit = this.money(row.credit, 'credit');

            await tx.gLJournalLine.create({
              data: {
                journalId: header.id,
                lineNumber: lineIndex + 1,
                accountId: account.id,
                accountCode: account.code,
                accountName: account.name,
                accountType: account.type,
                debitAmount: new Prisma.Decimal(debit),
                creditAmount: new Prisma.Decimal(credit),
                baseCurrencyDebit: new Prisma.Decimal(debit),
                baseCurrencyCredit: new Prisma.Decimal(credit),
                transactionCurrencyCode: this.norm(row.currencyCode ?? headerCurrencyCode),
                exchangeRate: new Prisma.Decimal(1),
                branchId: lineBranch?.id ?? null,
                departmentId: lineDepartment?.id ?? null,
                costCenterId: lineCostCenter?.id ?? null,
                projectId: lineProject?.id ?? null,
                lineNarration: row.narration?.trim() || headerNarration,
                reference1: row.reference?.trim() || null,
                reference2: row.sourceDocument?.trim() || null,
              },
            });
          }
        });

        created += 1;
      } catch (error) {
        const message = this.errorMessage(error, `Could not import journal "${journalNumber}"`);
        for (const item of journalRows) {
          errors.push({ row: item.rowNumber, message });
        }
      }
    }

    return { dataset, created, updated: 0, failed: errors.length, errors };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Shared helpers
  // ───────────────────────────────────────────────────────────────────────────

  private async importCustomersOrSuppliers(
    dataset: 'customer' | 'supplier',
    companyId: number,
    rows: BulkImportCustomersDto['rows'] | BulkImportSuppliersDto['rows'],
  ): Promise<BulkImportResult> {
    const errors: RowError[] = [];
    let created = 0;
    let updated = 0;

    await this.ensureCompanyExists(companyId);

    for (const [index, row] of rows.entries()) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const label = dataset === 'customer' ? 'Customer' : 'Supplier';
          const name = this.requireText(row.name, `${label} name is required`);
          const email = row.email?.trim() || null;
          const phone = row.phone?.trim() || null;

          const addressData = row.line1?.trim()
            ? {
                line1: row.line1.trim(),
                city: row.city?.trim() || null,
                state: row.state?.trim() || null,
                country: row.country?.trim() || null,
                postalCode: row.postalCode?.trim() || null,
              }
            : null;

          const where = email
            ? { companyId, OR: [{ email }, { name }] }
            : { companyId, name };

          if (dataset === 'customer') {
            const existing = await tx.customer.findFirst({ where, include: { addresses: true } });
            if (existing) {
              const party = await tx.customer.update({
                where: { id: existing.id },
                data: { name, email, phone },
                include: { addresses: true },
              });
              if (addressData) {
                if (party.addresses[0]) {
                  await tx.address.update({ where: { id: party.addresses[0].id }, data: addressData });
                } else {
                  await tx.address.create({ data: { ...addressData, customerId: party.id } });
                }
              }
              return 'updated';
            }

            await tx.customer.create({
              data: {
                companyId,
                name,
                email,
                phone,
                addresses: addressData ? { create: [addressData] } : undefined,
              },
            });
            return 'created';
          }

          const existing = await tx.supplier.findFirst({ where, include: { addresses: true } });
          if (existing) {
            const party = await tx.supplier.update({
              where: { id: existing.id },
              data: { name, email, phone },
              include: { addresses: true },
            });
            if (addressData) {
              if (party.addresses[0]) {
                await tx.address.update({ where: { id: party.addresses[0].id }, data: addressData });
              } else {
                await tx.address.create({ data: { ...addressData, supplierId: party.id } });
              }
            }
            return 'updated';
          }

          await tx.supplier.create({
            data: {
              companyId,
              name,
              email,
              phone,
              addresses: addressData ? { create: [addressData] } : undefined,
            },
          });
          return 'created';
        });

        if (result === 'updated') updated += 1;
        else created += 1;
      } catch (error) {
        errors.push(this.rowError(index, error, `Could not import ${dataset} row`));
      }
    }

    return {
      dataset: dataset === 'customer' ? 'customers' : 'suppliers',
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  private async findOrCreateCustomer(
    tx: Prisma.TransactionClient,
    companyId: number,
    name: string,
    email?: string,
  ) {
    const trimmedEmail = email?.trim() || null;
    const existing = await tx.customer.findFirst({
      where: trimmedEmail ? { companyId, OR: [{ email: trimmedEmail }, { name }] } : { companyId, name },
    });
    if (existing) return existing;
    return tx.customer.create({ data: { companyId, name, email: trimmedEmail } });
  }

  private async findOrCreateSupplier(
    tx: Prisma.TransactionClient,
    companyId: number,
    name: string,
    email?: string,
  ) {
    const trimmedEmail = email?.trim() || null;
    const existing = await tx.supplier.findFirst({
      where: trimmedEmail ? { companyId, OR: [{ email: trimmedEmail }, { name }] } : { companyId, name },
    });
    if (existing) return existing;
    return tx.supplier.create({ data: { companyId, name, email: trimmedEmail } });
  }

  private async requireCompanyByCode(code: string | undefined, client?: Prisma.TransactionClient) {
    const trimmed = this.requireText(code, 'Company code is required');
    const db = client ?? this.prisma;
    const company = await db.company.findFirst({ where: { code: trimmed } });
    if (!company) {
      throw new NotFoundException(`Company ${trimmed} was not found`);
    }
    return company;
  }

  private async requirePrimaryBranch(companyId: number) {
    const branch = await this.prisma.branch.findFirst({
      where: { companyId },
      orderBy: { id: 'asc' },
    });
    if (!branch) {
      throw new BadRequestException(
        'This company has no branch. Import branches before importing transactions.',
      );
    }
    return branch;
  }

  /** Resolves the AR/AP control account the migrated documents post against. */
  private async requireControlAccount(label: string, sources: string[]) {
    const account = await this.prisma.account.findFirst({
      where: { isControlAccount: true, controlSource: { in: sources } },
      orderBy: { id: 'asc' },
    });
    if (!account) {
      throw new BadRequestException(
        `No ${label} control account is configured. Mark one account as a control account with controlSource "${sources[0]}" before importing.`,
      );
    }
    return account;
  }

  private async requireAccountingPeriod(
    tx: Prisma.TransactionClient,
    companyId: number,
    date: Date,
  ) {
    const period = await tx.accountingPeriod.findFirst({
      where: {
        companyId,
        status: 'OPEN',
        startDate: { lte: date },
        endDate: { gte: date },
      },
      orderBy: { startDate: 'asc' },
    });
    if (!period) {
      throw new BadRequestException(
        `No open accounting period covers ${date.toISOString().slice(0, 10)}`,
      );
    }
    return period;
  }

  private async resolveAccountCode(tx: Prisma.TransactionClient, code?: string) {
    if (!code?.trim()) {
      return null;
    }
    const account = await tx.account.findUnique({ where: { code: code.trim() } });
    if (!account) {
      throw new NotFoundException(`Account ${code} was not found`);
    }
    return account.id;
  }

  private parsePaymentMethod(value?: string): Prisma.$CustomerReceiptHeaderPayload['scalars']['paymentMethod'] {
    const normalized = this.norm(value ?? '').replace(/[\s-]+/g, '_');
    const allowed = ['BANK_TRANSFER', 'CHEQUE', 'CASH', 'CARD', 'GATEWAY', 'WALLET'] as const;
    const match = allowed.find((item) => item === normalized);
    return match ?? 'BANK_TRANSFER';
  }

  private parseDepreciationMethod(
    value?: string,
  ): Prisma.$AssetCategoryPayload['scalars']['depreciationMethod'] {
    const normalized = this.norm(value ?? '').replace(/[\s-]+/g, '_');
    const allowed = ['STRAIGHT_LINE', 'DECLINING_BALANCE', 'UNITS_OF_PRODUCTION'] as const;
    const match = allowed.find((item) => item === normalized);
    return match ?? 'STRAIGHT_LINE';
  }

  private parseDate(value: string | undefined, field: string): Date {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new BadRequestException(`Field "${field}" is required`);
    }
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Field "${field}" must be a valid date`);
    }
    return date;
  }

  private money(value: unknown, field: string): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`Field "${field}" must be a valid number`);
    }
    if (parsed < 0) {
      throw new BadRequestException(`Field "${field}" cannot be negative`);
    }
    return parsed;
  }

  private norm(value: unknown): string {
    return String(value ?? '').trim().toUpperCase();
  }

  private requireText(value: string | undefined, message: string): string {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new BadRequestException(message);
    }
    return trimmed;
  }

  private async ensureCompanyExists(companyId: number) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} was not found`);
    }
    return company;
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  private rowError(index: number, error: unknown, fallback: string): RowError {
    return { row: index + 1, message: this.errorMessage(error, fallback) };
  }

  private batchFailure(dataset: string, rowCount: number, message: string): BulkImportResult {
    return {
      dataset,
      created: 0,
      updated: 0,
      failed: rowCount || 1,
      errors: [{ row: 0, message }],
    };
  }
}
