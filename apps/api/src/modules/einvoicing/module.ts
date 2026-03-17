import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EInvoicingSettingsController } from './controllers/einvoicing-settings.controller';
import { EInvoicingDocumentsController } from './controllers/einvoicing-documents.controller';
import { EInvoicingSettingsService } from './services/einvoicing-settings.service';
import { EInvoicingDocumentsService } from './services/einvoicing-documents.service';
import { EInvoicingAuditService } from './services/einvoicing-audit.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    EInvoicingSettingsController,
    EInvoicingDocumentsController,
  ],
  providers: [
    EInvoicingSettingsService,
    EInvoicingDocumentsService,
    EInvoicingAuditService,
  ],
  exports: [
    EInvoicingSettingsService,
    EInvoicingDocumentsService,
  ],
})
export class EInvoicingModule {}
