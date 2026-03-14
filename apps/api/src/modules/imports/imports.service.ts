import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BulkImportAccountsDto,
  BulkImportCustomersDto,
  BulkImportProductsDto,
  BulkImportResult,
  BulkImportSuppliersDto,
  BulkImportTaxConfigsDto,
} from './dto';

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async importAccounts(dto: BulkImportAccountsDto): Promise<BulkImportResult> {
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    let updated = 0;

    for (const [index, row] of dto.rows.entries()) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const code = this.requireText(row.code, 'Account code is required');
          const name = this.requireText(row.name, 'Account name is required');
          const type = this.requireText(row.type, 'Account type is required').toUpperCase();
          const existing = await tx.account.findUnique({ where: { code } });
          const account = existing
            ? await tx.account.update({
                where: { id: existing.id },
                data: {
                  name,
                  type,
                  description: row.description?.trim() || null,
                  isActive: row.isActive ?? true,
                  allowsPosting: row.allowsPosting ?? true,
                  isControlAccount: row.isControlAccount ?? false,
                  controlSource: row.controlSource?.trim().toUpperCase() || null,
                },
              })
            : await tx.account.create({
                data: {
                  code,
                  name,
                  type,
                  description: row.description?.trim() || null,
                  isActive: row.isActive ?? true,
                  allowsPosting: row.allowsPosting ?? true,
                  isControlAccount: row.isControlAccount ?? false,
                  controlSource: row.controlSource?.trim().toUpperCase() || null,
                },
              });

          if (row.parentCode?.trim()) {
            const parent = await tx.account.findUnique({ where: { code: row.parentCode.trim() } });
            if (!parent) {
              throw new NotFoundException(`Parent account ${row.parentCode} was not found`);
            }
            await tx.account.update({
              where: { id: account.id },
              data: { parentId: parent.id },
            });
          }

          return existing ? 'updated' : 'created';
        });

        if (result === 'updated') updated += 1;
        else created += 1;
      } catch (error) {
        errors.push({ row: index + 1, message: error instanceof Error ? error.message : 'Could not import account row' });
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
    const errors: BulkImportResult['errors'] = [];
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
            const category =
              (await tx.productCategory.findFirst({ where: { name: row.category.trim() } })) ??
              (await tx.productCategory.create({ data: { name: row.category.trim() } }));
            categoryId = category.id;
          }

          if (row.uom?.trim()) {
            const uom =
              (await tx.unitOfMeasure.findFirst({ where: { name: row.uom.trim() } })) ??
              (await tx.unitOfMeasure.create({ data: { name: row.uom.trim(), symbol: row.uom.trim().slice(0, 5).toLowerCase() } }));
            uomId = uom.id;
          }

          const existing = await tx.product.findFirst({ where: { companyId: dto.companyId, sku } });
          if (existing) {
            await tx.product.update({
              where: { id: existing.id },
              data: {
                name,
                categoryId,
                uomId,
                isActive: row.isActive ?? true,
              },
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
        errors.push({ row: index + 1, message: error instanceof Error ? error.message : 'Could not import product row' });
      }
    }

    return { dataset: 'products', created, updated, failed: errors.length, errors };
  }

  async importTaxConfigs(dto: BulkImportTaxConfigsDto): Promise<BulkImportResult> {
    const errors: BulkImportResult['errors'] = [];
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
          const existing = await tx.taxConfig.findFirst({
            where: { companyId: row.companyId, code },
          });

          const payload = {
            code,
            name,
            taxType: row.taxType?.trim().toUpperCase() ?? 'VAT',
            rate: row.rate.toFixed(4),
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
        errors.push({ row: index + 1, message: error instanceof Error ? error.message : 'Could not import tax config row' });
      }
    }

    return { dataset: 'tax_codes', created, updated, failed: errors.length, errors };
  }

  private async importCustomersOrSuppliers(
    dataset: 'customer' | 'supplier',
    companyId: number,
    rows: BulkImportCustomersDto['rows'] | BulkImportSuppliersDto['rows'],
  ): Promise<BulkImportResult> {
    const errors: BulkImportResult['errors'] = [];
    let created = 0;
    let updated = 0;

    await this.ensureCompanyExists(companyId);

    for (const [index, row] of rows.entries()) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const name = this.requireText(row.name, `${dataset === 'customer' ? 'Customer' : 'Supplier'} name is required`);
          const addressData = row.line1?.trim()
            ? {
                line1: row.line1.trim(),
                city: row.city?.trim() || null,
                state: row.state?.trim() || null,
                country: row.country?.trim() || null,
                postalCode: row.postalCode?.trim() || null,
              }
            : null;

          if (dataset === 'customer') {
            const existing = await tx.customer.findFirst({
              where: row.email?.trim()
                ? { companyId, OR: [{ email: row.email.trim() }, { name }] }
                : { companyId, name },
              include: { addresses: true },
            });

            if (existing) {
              const updatedParty = await tx.customer.update({
                where: { id: existing.id },
                data: {
                  name,
                  email: row.email?.trim() || null,
                  phone: row.phone?.trim() || null,
                },
                include: { addresses: true },
              });
              if (addressData) {
                if (updatedParty.addresses[0]) {
                  await tx.address.update({
                    where: { id: updatedParty.addresses[0].id },
                    data: addressData,
                  });
                } else {
                  await tx.address.create({
                    data: {
                      ...addressData,
                      customerId: updatedParty.id,
                    },
                  });
                }
              }
              return 'updated';
            }

            await tx.customer.create({
              data: {
                companyId,
                name,
                email: row.email?.trim() || null,
                phone: row.phone?.trim() || null,
                addresses: addressData ? { create: [addressData] } : undefined,
              },
            });
            return 'created';
          }

          const existing = await tx.supplier.findFirst({
            where: row.email?.trim()
              ? { companyId, OR: [{ email: row.email.trim() }, { name }] }
              : { companyId, name },
            include: { addresses: true },
          });

          if (existing) {
            const updatedParty = await tx.supplier.update({
              where: { id: existing.id },
              data: {
                name,
                email: row.email?.trim() || null,
                phone: row.phone?.trim() || null,
              },
              include: { addresses: true },
            });
            if (addressData) {
              if (updatedParty.addresses[0]) {
                await tx.address.update({
                  where: { id: updatedParty.addresses[0].id },
                  data: addressData,
                });
              } else {
                await tx.address.create({
                  data: {
                    ...addressData,
                    supplierId: updatedParty.id,
                  },
                });
              }
            }
            return 'updated';
          }

          await tx.supplier.create({
            data: {
              companyId,
              name,
              email: row.email?.trim() || null,
              phone: row.phone?.trim() || null,
              addresses: addressData ? { create: [addressData] } : undefined,
            },
          });
          return 'created';
        });

        if (result === 'updated') updated += 1;
        else created += 1;
      } catch (error) {
        errors.push({ row: index + 1, message: error instanceof Error ? error.message : `Could not import ${dataset} row` });
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

  private requireText(value: string | undefined, message: string) {
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
}
