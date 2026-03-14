import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AuthModule } from '../auth/module';

@Module({
  imports: [AuthModule],
  controllers: [AccountingController],
  providers: [AccountingService],
})
export class AccountingModule {}

