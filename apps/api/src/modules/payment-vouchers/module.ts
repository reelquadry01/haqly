import { Module } from '@nestjs/common';
import { PaymentVouchersController } from './payment-vouchers.controller';
import { PaymentVouchersService } from './payment-vouchers.service';
import { PaymentGatewayService } from './payment-gateway.service';

@Module({
  controllers: [PaymentVouchersController],
  providers: [PaymentVouchersService, PaymentGatewayService],
})
export class PaymentVouchersModule {}
