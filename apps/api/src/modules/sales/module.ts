import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { AuthModule } from '../auth/module';

@Module({
  imports: [AuthModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}

