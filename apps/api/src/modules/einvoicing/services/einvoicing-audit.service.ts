import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EInvoicingAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logEvent(einvoiceDocumentId: number, eventType: string, eventPayloadJson?: unknown, createdBy?: number) {
    return this.prisma.eInvoiceEvent.create({
      data: {
        einvoiceDocumentId,
        eventType,
        eventPayloadJson: eventPayloadJson as any,
        createdBy,
      },
    });
  }
}
