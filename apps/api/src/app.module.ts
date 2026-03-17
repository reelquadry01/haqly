import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from './prisma/prisma.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';

import { HealthModule } from './health/health.module';

import { AuthModule } from './modules/auth/module';
import { UsersModule } from './modules/users/module';
import { OrgModule } from './modules/org/module';
import { AccountingModule } from './modules/accounting/module';
import { SalesModule } from './modules/sales/module';
import { PurchasesModule } from './modules/purchases/module';
import { InventoryModule } from './modules/inventory/module';
import { CrmModule } from './modules/crm/module';
import { PayrollModule } from './modules/payroll/module';
import { ReportsModule } from './modules/reports/module';
import { NotificationsModule } from './modules/notifications/module';
import { AuditModule } from './modules/audit/module';
import { AdminModule } from './modules/admin/module';
import { FilesModule } from './modules/files/module';
import { IntegrationsModule } from './modules/integrations/module';
import { FixedAssetsModule } from './modules/fixed-assets/module';
import { DepreciationModule } from './modules/depreciation/module';
import { LoansModule } from './modules/loans/module';
import { TaxModule } from './modules/tax/module';
import { PostingModule } from './modules/posting/module';
import { ImportsModule } from './modules/imports/module';
import { JournalsModule } from './modules/journals/module';
import { PaymentVouchersModule } from './modules/payment-vouchers/module';
import { EInvoicingModule } from './modules/einvoicing/module';
import { JwtAuthGuard } from './middleware/auth';
import { PermissionsGuard } from './modules/auth/permissions.guard';
import { RolesGuard } from './middleware/rbac';
import { AuditInterceptor } from './middleware/audit';
import { GlobalErrorFilter } from './middleware/errorHandler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validationSchema.validate,
    }),
    TerminusModule,
    PrismaModule,
    PostingModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrgModule,
    AccountingModule,
    SalesModule,
    PurchasesModule,
    InventoryModule,
    CrmModule,
    PayrollModule,
    ReportsModule,
    NotificationsModule,
    AuditModule,
    AdminModule,
    FilesModule,
    IntegrationsModule,
    FixedAssetsModule,
    DepreciationModule,
    LoansModule,
    TaxModule,
    ImportsModule,
    JournalsModule,
    PaymentVouchersModule,
    EInvoicingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: GlobalErrorFilter },
  ],
})
export class AppModule {}

