import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerReceiptStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCustomerDto,
  CreateCustomerReceiptDto,
  CreateInvoiceDto,
  PostCustomerReceiptDto,
  UpdateCustomerDto,
} from './dto';
import { PostingService } from '../posting/posting.service';

type TxClient = Prisma.TransactionClient;

const CUSTOMER_RECEIPT_INCLUDE = {
  legalEntity: true,
  branch: true,
  customer: { include: { addresses: true } },
  bankAccount: { include: { glAccount: true, currency: true } },
  cashAccount: true,
  receivableAccount: true,
  glJournal: { include: { lines: true } },
  lines: {
    include: {
      invoice: {
        include: {
          customer: { include: { addresses: true } },
          items: { include: { product: true } },
        },
      },
    },
    orderBy: { lineNumber: 'asc' as const },
  },
} satisfies Prisma.CustomerReceiptHeaderInclude;

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService, private posting: PostingService) {}

  async createCustomer(dto: CreateCustomerDto) {
    await this.ensureCompanyExists(dto.companyId);
    const { addressLine1, city, state, country, creditLimit, companyId, ...customerData } = dto;
    return this.prisma.customer.create({
      data: {
        companyId,
        ...customerData,
        creditLimit: creditLimit !== undefined ? new Prisma.Decimal(creditLimit) : undefined,
        addresses: addressLine1
          ? {
              create: {
                line1: addressLine1,
                city,
                state,
                country,
              },
            }
          : undefined,
      },
      include: {
        addresses: true,
      },
    });
  }

  async listCustomers(companyId?: number) {
    return this.prisma.customer.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { id: 'desc' },
      include: { addresses: true },
    });
  }

  async updateCustomer(id: number, dto: UpdateCustomerDto, companyId?: number) {
    const { addressLine1, city, state, country, creditLimit, ...customerData } = dto;
    const existing = await this.prisma.customer.findUnique({
      where: { id },
      include: { addresses: true },
    });

    if (!existing) {
      throw new BadRequestException('Customer does not exist.');
    }
    if (companyId && existing.companyId !== companyId) {
      throw new ForbiddenException('Customer does not belong to the active company.');
    }

    const primaryAddressId = existing.addresses[0]?.id;

    return this.prisma.customer.update({
      where: { id },
      data: {
        ...customerData,
        creditLimit: creditLimit !== undefined ? new Prisma.Decimal(creditLimit) : undefined,
        addresses:
          addressLine1 || city || state || country
            ? primaryAddressId
              ? {
                  update: {
                    where: { id: primaryAddressId },
                    data: {
                      line1: addressLine1,
                      city,
                      state,
                      country,
                    },
                  },
                }
              : addressLine1
                ? {
                    create: {
                      line1: addressLine1,
                      city,
                      state,
                      country,
                    },
                  }
                : undefined
            : undefined,
      },
      include: {
        addresses: true,
      },
    });
  }

  async createInvoice(dto: CreateInvoiceDto) {
    const warehouseId = dto.warehouseId;

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id: dto.legalEntityId } });
      if (!company) {
        throw new BadRequestException('Company does not exist.');
      }

      const customer = await tx.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer || customer.companyId !== dto.legalEntityId) {
        throw new BadRequestException('Customer does not belong to the selected company.');
      }

      const products = await tx.product.findMany({
        where: { id: { in: dto.items.map((item) => item.productId) }, companyId: dto.legalEntityId },
        select: { id: true, categoryId: true, companyId: true },
      });
      if (products.length !== dto.items.length) {
        throw new BadRequestException('One or more invoice items reference missing products for this company.');
      }

      const categoryIds = [...new Set(products.map((product) => product.categoryId ?? null))];
      if (categoryIds.length > 1) {
        throw new BadRequestException(
          'Invoice contains multiple item categories. Split the invoice by item class or extend the posting matrix to support multi-rule invoice postings.',
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

      const baseTotal = dto.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
      const taxTotal = dto.items.reduce((s, i) => s + (i.taxRate ? (i.quantity * i.unitPrice * i.taxRate) / 100 : 0), 0);
      const total = baseTotal + taxTotal;
      if (total <= 0) throw new BadRequestException('Total must be > 0');

      const invoice = await tx.salesInvoice.create({
        data: {
          number: `INV-${Date.now()}`,
          legalEntityId: dto.legalEntityId,
          customerId: dto.customerId,
          date: new Date(dto.date),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: 'OPEN',
          total: new Prisma.Decimal(total),
        },
      });
      const items = dto.items.map((i) => ({
        invoiceId: invoice.id,
        productId: i.productId,
        quantity: new Prisma.Decimal(i.quantity),
        unitPrice: new Prisma.Decimal(i.unitPrice),
        taxRate: i.taxRate ? new Prisma.Decimal(i.taxRate) : null,
      }));
      await tx.salesInvoiceItem.createMany({ data: items });

      if (warehouseId) {
        for (const i of dto.items) {
          await tx.stockMovement.create({
            data: {
              productId: i.productId,
              warehouseId,
              quantity: new Prisma.Decimal(-i.quantity),
              direction: 'OUT',
              reference: `INV-${invoice.id}`,
            },
          });
        }
      }

      await this.posting.post(
        {
          context: {
            module: 'SALES',
            transactionType: 'INVOICE',
            transactionSubtype: dto.items.every((item) => (item.taxRate ?? 0) > 0) ? 'TAXED' : 'STANDARD',
            triggeringEvent: 'INVOICE_POSTED',
            postingDate: new Date(dto.date),
            sourceTable: 'salesInvoice',
            sourceDocumentId: String(invoice.id),
            sourceDocumentNumber: invoice.number,
            sourceStatus: invoice.status,
            legalEntityId: dto.legalEntityId,
            branchId: warehouse?.branchId,
            productCategoryId: categoryIds[0] ?? undefined,
            taxCode: taxTotal > 0 ? 'OUTPUT_TAX' : undefined,
            currencyCode: 'NGN',
            subledgerPartyId: dto.customerId,
            idempotencyKey: `sales-invoice-posted-${invoice.id}`,
            descriptionTemplateData: {
              invoiceNumber: invoice.number,
            },
          },
          pattern: 'SALES_INVOICE',
          amounts: {
            baseAmount: baseTotal,
            taxAmount: taxTotal,
            totalAmount: total,
          },
        },
        tx,
      );

      return tx.salesInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          items: { include: { product: true } },
          customer: { include: { addresses: true } },
        },
      });
    });
  }

  async listInvoices(legalEntityId?: number) {
    return this.prisma.salesInvoice.findMany({
      where: legalEntityId ? { legalEntityId } : undefined,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      include: {
        items: { include: { product: true } },
        customer: { include: { addresses: true } },
      },
    });
  }

  async getReceiptMetadata(legalEntityId: number) {
    const [company, receivableAccounts, cashAccounts, bankAccounts] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: legalEntityId },
        include: { currency: true, branches: true },
      }),
      this.prisma.account.findMany({
        where: {
          isActive: true,
          type: 'ASSET',
          isControlAccount: true,
          controlSource: 'SALES',
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.account.findMany({
        where: {
          isActive: true,
          type: 'ASSET',
          code: { startsWith: '10' },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.bankAccount.findMany({
        where: {
          isActive: true,
          OR: [{ companyId: legalEntityId }, { companyId: null }],
        },
        include: { glAccount: true, currency: true, branch: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    return {
      company: {
        id: company.id,
        name: company.name,
        currencyCode: company.currency?.code ?? 'NGN',
      },
      branches: company.branches,
      receivableAccounts,
      cashAccounts,
      bankAccounts: bankAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        accountName: account.accountName,
        number: account.number,
        bankName: account.bankName,
        branchId: account.branchId,
        currencyCode: account.currency?.code,
        glAccountId: account.glAccountId,
        glAccountCode: account.glAccount?.code,
        glAccountName: account.glAccount?.name,
      })),
      paymentMethods: Object.values(PaymentMethod),
    };
  }

  async createReceipt(dto: CreateCustomerReceiptDto, actor: { userId?: number; email?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const prepared = await this.prepareReceipt(tx, dto);
      const receiptNumber = await this.nextReceiptNumber(tx, dto.legalEntityId);
      const receipt = await tx.customerReceiptHeader.create({
        data: {
          receiptNumber,
          legalEntityId: dto.legalEntityId,
          branchId: dto.branchId,
          customerId: dto.customerId,
          bankAccountId: dto.bankAccountId,
          cashAccountId: dto.cashAccountId,
          receivableAccountId: dto.receivableAccountId,
          paymentMethod: dto.paymentMethod,
          paymentDate: new Date(dto.paymentDate),
          postingDate: new Date(dto.postingDate),
          currencyCode: dto.currencyCode,
          exchangeRate: dto.exchangeRate !== undefined ? new Prisma.Decimal(dto.exchangeRate) : null,
          amount: new Prisma.Decimal(prepared.amount),
          bankReference: dto.bankReference,
          externalReference: dto.externalReference,
          narration: dto.narration,
          remarks: dto.remarks,
          createdBy: actor.userId,
          lines: {
            create: prepared.lines.map((line, index) => ({
              lineNumber: index + 1,
              invoiceId: line.invoiceId,
              description: line.description,
              appliedAmount: new Prisma.Decimal(line.appliedAmount),
            })),
          },
        },
        include: CUSTOMER_RECEIPT_INCLUDE,
      });
      return this.decorateReceipt(receipt);
    });
  }

  async listReceipts(legalEntityId?: number, branchId?: number) {
    const receipts = await this.prisma.customerReceiptHeader.findMany({
      where: {
        legalEntityId: legalEntityId || undefined,
        branchId: branchId || undefined,
      },
      include: CUSTOMER_RECEIPT_INCLUDE,
      orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
    });
    return receipts.map((receipt) => this.decorateReceipt(receipt));
  }

  async getReceipt(id: number, legalEntityId?: number) {
    const receipt = await this.prisma.customerReceiptHeader.findUnique({
      where: { id },
      include: CUSTOMER_RECEIPT_INCLUDE,
    });
    if (!receipt) {
      throw new NotFoundException('Customer receipt not found.');
    }
    if (legalEntityId && receipt.legalEntityId !== legalEntityId) {
      throw new ForbiddenException('Receipt does not belong to the active company.');
    }
    return this.decorateReceipt(receipt);
  }

  async postReceipt(id: number, dto: PostCustomerReceiptDto, actor: { userId?: number; email?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.customerReceiptHeader.findUnique({
        where: { id },
        include: CUSTOMER_RECEIPT_INCLUDE,
      });
      if (!receipt) {
        throw new NotFoundException('Customer receipt not found.');
      }
      if (receipt.status === CustomerReceiptStatus.POSTED) {
        throw new BadRequestException('This receipt has already been posted to the general ledger.');
      }
      if (receipt.status === CustomerReceiptStatus.CANCELLED) {
        throw new ForbiddenException('Cancelled receipts cannot be posted.');
      }

      await this.ensureOpenPostingPeriod(tx, receipt.legalEntityId, receipt.postingDate);
      await this.validateReceiptForPosting(tx, receipt);

      const settlementAccountId = receipt.bankAccount?.glAccountId ?? receipt.cashAccountId;
      if (!settlementAccountId) {
        throw new BadRequestException('Selected bank or cash account does not have a valid GL mapping.');
      }

      const journal = await tx.journalEntry.create({
        data: {
          reference: receipt.receiptNumber,
          type: receipt.paymentMethod === PaymentMethod.CASH ? 'CASH' : 'BANK',
          description: dto.narration?.trim() || receipt.narration,
          date: receipt.postingDate,
          createdBy: actor.userId,
        },
      });

      await tx.journalLine.createMany({
        data: [
          {
            entryId: journal.id,
            accountId: settlementAccountId,
            branchId: receipt.branchId,
            debit: new Prisma.Decimal(receipt.amount),
            credit: new Prisma.Decimal(0),
            memo: 'Customer receipt settlement',
          },
          {
            entryId: journal.id,
            accountId: receipt.receivableAccountId,
            branchId: receipt.branchId,
            debit: new Prisma.Decimal(0),
            credit: new Prisma.Decimal(receipt.amount),
            memo: 'Accounts receivable clearance',
          },
        ],
      });

      const updatedReceipt = await tx.customerReceiptHeader.update({
        where: { id },
        data: {
          status: CustomerReceiptStatus.POSTED,
          postedBy: actor.userId,
          postedAt: new Date(),
          glJournalId: journal.id,
          narration: dto.narration?.trim() || receipt.narration,
        },
        include: CUSTOMER_RECEIPT_INCLUDE,
      });

      for (const line of updatedReceipt.lines) {
        if (!line.invoiceId) continue;
        await this.refreshInvoiceReceiptStatus(tx, line.invoiceId);
      }

      return this.decorateReceipt(updatedReceipt);
    });
  }

  private async prepareReceipt(tx: TxClient, dto: CreateCustomerReceiptDto) {
    if (!dto.bankAccountId && !dto.cashAccountId) {
      throw new BadRequestException('Select a bank or cash account for the receipt.');
    }
    if (dto.bankAccountId && dto.cashAccountId) {
      throw new BadRequestException('Select either a bank account or a cash account, not both.');
    }

    const [company, branch, customer, receivableAccount, bankAccount, cashAccount] = await Promise.all([
      tx.company.findUnique({ where: { id: dto.legalEntityId }, include: { currency: true } }),
      tx.branch.findUnique({ where: { id: dto.branchId } }),
      tx.customer.findUnique({ where: { id: dto.customerId }, include: { addresses: true } }),
      tx.account.findUnique({ where: { id: dto.receivableAccountId } }),
      dto.bankAccountId
        ? tx.bankAccount.findUnique({ where: { id: dto.bankAccountId }, include: { glAccount: true } })
        : Promise.resolve(null),
      dto.cashAccountId ? tx.account.findUnique({ where: { id: dto.cashAccountId } }) : Promise.resolve(null),
    ]);

    if (!company) throw new BadRequestException('Company does not exist.');
    if (!branch || branch.companyId !== dto.legalEntityId) throw new BadRequestException('Branch does not belong to the selected company.');
    if (!customer || customer.companyId !== dto.legalEntityId) throw new BadRequestException('Customer does not belong to the selected company.');
    if (!receivableAccount || !receivableAccount.isActive || !receivableAccount.allowsPosting) {
      throw new BadRequestException('Receivable control account is invalid or inactive.');
    }
    if (receivableAccount.isControlAccount && receivableAccount.controlSource && receivableAccount.controlSource !== 'SALES') {
      throw new BadRequestException('Receivable account is reserved for another source.');
    }
    if (bankAccount && (!bankAccount.isActive || !bankAccount.glAccountId)) {
      throw new BadRequestException('Bank account is inactive or missing a GL account mapping.');
    }
    if (bankAccount && bankAccount.companyId && bankAccount.companyId !== dto.legalEntityId) {
      throw new BadRequestException('Bank account does not belong to the selected company.');
    }
    if (cashAccount && (!cashAccount.isActive || !cashAccount.allowsPosting)) {
      throw new BadRequestException('Cash account is inactive or blocked for posting.');
    }

    const lines = dto.lines.map((line) => ({
      invoiceId: line.invoiceId,
      description: line.description.trim(),
      appliedAmount: this.roundMoney(Number(line.appliedAmount ?? 0)),
    }));

    const invoiceIds = [...new Set(lines.map((line) => line.invoiceId).filter((value): value is number => Boolean(value)))];
    const invoices = invoiceIds.length
      ? await tx.salesInvoice.findMany({
          where: { id: { in: invoiceIds }, legalEntityId: dto.legalEntityId },
          include: {
            customer: true,
            items: { include: { product: true } },
            receiptLines: { include: { receipt: true } },
          },
        })
      : [];

    const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    let totalAmount = 0;

    for (const [index, line] of lines.entries()) {
      if (!line.description) {
        throw new BadRequestException(`Receipt line ${index + 1} requires a description.`);
      }
      if (line.appliedAmount <= 0) {
        throw new BadRequestException(`Receipt line ${index + 1} must be greater than zero.`);
      }
      if (line.invoiceId) {
        const invoice = invoiceMap.get(line.invoiceId);
        if (!invoice) {
          throw new BadRequestException(`Receipt line ${index + 1} references an invoice that does not exist for this company.`);
        }
        if (invoice.customerId !== dto.customerId) {
          throw new BadRequestException(`Receipt line ${index + 1} invoice does not belong to the selected customer.`);
        }
        const outstanding = await this.invoiceOutstandingAmount(tx, invoice.id);
        if (line.appliedAmount - outstanding > 0.01) {
          throw new BadRequestException(`Receipt line ${index + 1} exceeds the outstanding balance on invoice ${invoice.number}.`);
        }
      }
      totalAmount += line.appliedAmount;
    }

    return {
      amount: this.roundMoney(totalAmount),
      lines,
      company,
      branch,
      customer,
      receivableAccount,
      bankAccount,
      cashAccount,
    };
  }

  private async validateReceiptForPosting(tx: TxClient, receipt: Awaited<ReturnType<SalesService['getReceipt']>> | Prisma.CustomerReceiptHeaderGetPayload<{ include: typeof CUSTOMER_RECEIPT_INCLUDE }>) {
    if (!receipt.lines.length) {
      throw new BadRequestException('Receipt must have at least one allocation line.');
    }
    const settlementAccountId = receipt.bankAccount?.glAccountId ?? receipt.cashAccountId;
    if (!settlementAccountId) {
      throw new BadRequestException('Bank or cash account must resolve to a posting account.');
    }
    const totalLines = this.roundMoney(receipt.lines.reduce((sum, line) => sum + Number(line.appliedAmount), 0));
    if (Math.abs(totalLines - Number(receipt.amount)) > 0.01) {
      throw new BadRequestException('Receipt amount does not match the applied receipt lines.');
    }
    for (const line of receipt.lines) {
      if (!line.invoiceId) continue;
      const outstanding = await this.invoiceOutstandingAmount(tx, line.invoiceId, receipt.id);
      if (Number(line.appliedAmount) - outstanding > 0.01) {
        throw new BadRequestException(`Invoice ${line.invoice?.number ?? line.invoiceId} no longer has enough outstanding balance for this receipt.`);
      }
    }
  }

  private async invoiceOutstandingAmount(tx: TxClient, invoiceId: number, excludeReceiptId?: number) {
    const invoice = await tx.salesInvoice.findUnique({ where: { id: invoiceId }, include: { receiptLines: { include: { receipt: true } } } });
    if (!invoice) {
      throw new NotFoundException('Invoice does not exist.');
    }
    const applied = invoice.receiptLines.reduce((sum, line) => {
      if (excludeReceiptId && line.receiptId === excludeReceiptId) return sum;
      if (line.receipt.status !== CustomerReceiptStatus.POSTED) return sum;
      return sum + Number(line.appliedAmount);
    }, 0);
    return this.roundMoney(Number(invoice.total) - applied);
  }

  private async refreshInvoiceReceiptStatus(tx: TxClient, invoiceId: number) {
    const outstanding = await this.invoiceOutstandingAmount(tx, invoiceId);
    const invoice = await tx.salesInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return;
    let status = 'OPEN';
    if (outstanding <= 0.01) {
      status = 'PAID';
    } else if (outstanding < Number(invoice.total)) {
      status = 'PARTIALLY_PAID';
    }
    await tx.salesInvoice.update({ where: { id: invoiceId }, data: { status } });
  }

  private async ensureOpenPostingPeriod(tx: TxClient, legalEntityId: number, postingDate: Date) {
    const period = await tx.accountingPeriod.findFirst({
      where: {
        companyId: legalEntityId,
        startDate: { lte: postingDate },
        endDate: { gte: postingDate },
      },
      orderBy: { startDate: 'desc' },
    });
    if (!period) {
      throw new BadRequestException('No accounting period is configured for this posting date.');
    }
    if (period.status !== 'OPEN') {
      throw new BadRequestException(`Accounting period ${period.name} is closed.`);
    }
    return period;
  }

  private async nextReceiptNumber(tx: TxClient, legalEntityId: number) {
    const sequenceName = 'Customer Receipt';
    const existing = await tx.numberingSequence.findFirst({
      where: { companyId: legalEntityId, name: sequenceName },
      orderBy: { id: 'asc' },
    });

    if (!existing) {
      await tx.numberingSequence.create({
        data: {
          companyId: legalEntityId,
          name: sequenceName,
          prefix: 'RCT',
          nextNumber: 2,
        },
      });
      return 'RCT-000001';
    }

    const currentNumber = existing.nextNumber;
    await tx.numberingSequence.update({
      where: { id: existing.id },
      data: { nextNumber: currentNumber + 1 },
    });
    return `${existing.prefix ?? 'RCT'}-${String(currentNumber).padStart(6, '0')}`;
  }

  private decorateReceipt(receipt: Prisma.CustomerReceiptHeaderGetPayload<{ include: typeof CUSTOMER_RECEIPT_INCLUDE }>) {
    return {
      ...receipt,
      amountInWords: this.amountInWords(Number(receipt.amount), receipt.currencyCode),
    };
  }

  private amountInWords(amount: number, currencyCode: string) {
    const whole = Math.floor(amount);
    const fraction = Math.round((amount - whole) * 100);
    const wholeWords = this.numberToWords(whole);
    const fractionWords = fraction ? ` and ${this.numberToWords(fraction)} kobo` : '';
    return `${wholeWords} ${currencyCode}${fractionWords}`.replace(/\s+/g, ' ').trim();
  }

  private numberToWords(value: number): string {
    if (value === 0) return 'zero';
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const toWords = (num: number): string => {
      if (num < 20) return ones[num];
      if (num < 100) return `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${ones[num % 10]}` : ''}`;
      if (num < 1000) return `${ones[Math.floor(num / 100)]} hundred${num % 100 ? ` ${toWords(num % 100)}` : ''}`;
      if (num < 1000000) return `${toWords(Math.floor(num / 1000))} thousand${num % 1000 ? ` ${toWords(num % 1000)}` : ''}`;
      if (num < 1000000000) return `${toWords(Math.floor(num / 1000000))} million${num % 1000000 ? ` ${toWords(num % 1000000)}` : ''}`;
      return `${toWords(Math.floor(num / 1000000000))} billion${num % 1000000000 ? ` ${toWords(num % 1000000000)}` : ''}`;
    };
    return toWords(value);
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async ensureCompanyExists(companyId: number) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new BadRequestException('Company does not exist.');
    }
    return company;
  }
}
