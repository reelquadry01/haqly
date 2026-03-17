import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EInvoicingDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async attachInvoice(salesInvoiceId: number) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id: salesInvoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Sales invoice not found');
    }

    if (!invoice.legalEntityId) {
      throw new NotFoundException('Sales invoice has no legal entity');
    }

    const profile = await this.prisma.eInvoiceProfile.findUnique({
      where: { companyId: invoice.legalEntityId },
    });

    if (!profile) {
      throw new NotFoundException('E-invoicing profile not found for legal entity');
    }

    const existing = await this.prisma.eInvoiceDocument.findUnique({
      where: { salesInvoiceId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.eInvoiceDocument.create({
      data: {
        companyId: invoice.legalEntityId,
        profileId: profile.id,
        salesInvoiceId: invoice.id,
        invoiceNumber: invoice.number,
        invoiceType: 'SALES_INVOICE',
        complianceStatus: 'READY_FOR_PREP',
      },
    });
  }

  async getBySalesInvoiceId(salesInvoiceId: number) {
    return this.prisma.eInvoiceDocument.findUnique({
      where: { salesInvoiceId },
      include: {
        profile: true,
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async markPrepared(salesInvoiceId: number) {
    const doc = await this.prisma.eInvoiceDocument.findUnique({
      where: { salesInvoiceId },
    });

    if (!doc) {
      throw new NotFoundException('E-invoicing document not found');
    }

    return this.prisma.eInvoiceDocument.update({
      where: { id: doc.id },
      data: {
        complianceStatus: 'PREPARED',
      },
    });
  }
}
