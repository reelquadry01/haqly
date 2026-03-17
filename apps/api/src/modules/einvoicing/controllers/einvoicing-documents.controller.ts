import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { EInvoicingDocumentsService } from '../services/einvoicing-documents.service';

@Controller('einvoicing/documents')
export class EInvoicingDocumentsController {
  constructor(private readonly documentsService: EInvoicingDocumentsService) {}

  @Post('attach/:salesInvoiceId')
  attachInvoice(@Param('salesInvoiceId', ParseIntPipe) salesInvoiceId: number) {
    return this.documentsService.attachInvoice(salesInvoiceId);
  }

  @Get(':salesInvoiceId')
  getBySalesInvoiceId(@Param('salesInvoiceId', ParseIntPipe) salesInvoiceId: number) {
    return this.documentsService.getBySalesInvoiceId(salesInvoiceId);
  }

  @Post('prepare/:salesInvoiceId')
  markPrepared(@Param('salesInvoiceId', ParseIntPipe) salesInvoiceId: number) {
    return this.documentsService.markPrepared(salesInvoiceId);
  }
}
