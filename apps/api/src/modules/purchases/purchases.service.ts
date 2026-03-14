import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBillDto, CreateSupplierDto } from './dto';
import { PostingService } from '../posting/posting.service';

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService, private posting: PostingService) {}

  async createSupplier(dto: CreateSupplierDto) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) {
      throw new BadRequestException('Company does not exist.');
    }
    return this.prisma.supplier.create({ data: dto });
  }

  async listSuppliers(companyId?: number) {
    return this.prisma.supplier.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { id: 'desc' },
    });
  }

  async createBill(dto: CreateBillDto) {
    const warehouseId = dto.warehouseId;

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id: dto.legalEntityId } });
      if (!company) {
        throw new BadRequestException('Company does not exist.');
      }

      const supplier = await tx.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!supplier || supplier.companyId !== dto.legalEntityId) {
        throw new BadRequestException('Supplier does not belong to the selected company.');
      }

      const products = await tx.product.findMany({
        where: { id: { in: dto.items.map((item) => item.productId) }, companyId: dto.legalEntityId },
        select: { id: true, categoryId: true },
      });
      if (products.length !== dto.items.length) {
        throw new BadRequestException('One or more bill items reference missing products for this company.');
      }

      const categoryIds = [...new Set(products.map((product) => product.categoryId ?? null))];
      if (categoryIds.length > 1) {
        throw new BadRequestException(
          'Bill contains multiple item categories. Split the bill by item class or extend the posting matrix to support multi-rule purchase postings.',
        );
      }

      const warehouse = warehouseId
        ? await tx.warehouse.findUnique({
            where: { id: warehouseId },
            include: { branch: true },
          })
        : null;
      if (warehouseId && !warehouse) {
        throw new BadRequestException('Warehouse does not exist.');
      }
      if (warehouse && warehouse.branch.companyId !== dto.legalEntityId) {
        throw new BadRequestException('Warehouse does not belong to the selected company.');
      }

      const baseTotal = dto.items.reduce((s, item) => s + item.quantity * item.unitCost, 0);
      const taxTotal = dto.items.reduce((s, i) => s + (i.taxRate ? (i.quantity * i.unitCost * i.taxRate) / 100 : 0), 0);
      const total = baseTotal + taxTotal;
      if (total <= 0) throw new BadRequestException('Total must be > 0');

      const bill = await tx.purchaseBill.create({
        data: {
          number: `BILL-${Date.now()}`,
          legalEntityId: dto.legalEntityId,
          supplierId: dto.supplierId,
          date: new Date(dto.date),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: 'OPEN',
          total: new Prisma.Decimal(total),
        },
      });
      const items = dto.items.map((i) => ({
        billId: bill.id,
        productId: i.productId,
        quantity: new Prisma.Decimal(i.quantity),
        unitCost: new Prisma.Decimal(i.unitCost),
        taxRate: i.taxRate ? new Prisma.Decimal(i.taxRate) : null,
      }));
      await tx.purchaseBillItem.createMany({ data: items });

      if (warehouseId) {
        for (const i of dto.items) {
          await tx.stockMovement.create({
            data: {
              productId: i.productId,
              warehouseId,
              quantity: new Prisma.Decimal(i.quantity),
              direction: 'IN',
              reference: `BILL-${bill.id}`,
            },
          });
        }
      }

      await this.posting.post(
        {
          context: {
            module: 'PROCUREMENT',
            transactionType: 'PURCHASE_BILL',
            transactionSubtype: dto.items.every((item) => (item.taxRate ?? 0) > 0) ? 'TAXED' : 'STANDARD',
            triggeringEvent: 'PURCHASE_BILL_POSTED',
            postingDate: new Date(dto.date),
            sourceTable: 'purchaseBill',
            sourceDocumentId: String(bill.id),
            sourceDocumentNumber: bill.number,
            sourceStatus: bill.status,
            legalEntityId: dto.legalEntityId,
            branchId: warehouse?.branchId,
            productCategoryId: categoryIds[0] ?? undefined,
            taxCode: taxTotal > 0 ? 'INPUT_TAX' : undefined,
            currencyCode: 'NGN',
            subledgerPartyId: dto.supplierId,
            idempotencyKey: `purchase-bill-posted-${bill.id}`,
            descriptionTemplateData: {
              billNumber: bill.number,
            },
          },
          pattern: 'PURCHASE_BILL',
          amounts: {
            baseAmount: baseTotal,
            taxAmount: taxTotal,
            totalAmount: total,
          },
        },
        tx,
      );

      return tx.purchaseBill.findUnique({ where: { id: bill.id }, include: { items: true, supplier: true } });
    });
  }

  async listBills(legalEntityId?: number) {
    return this.prisma.purchaseBill.findMany({
      where: legalEntityId ? { legalEntityId } : undefined,
      orderBy: { date: 'desc' },
      include: { items: true, supplier: true },
    });
  }
}
