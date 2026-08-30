import { Module } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { AuthModule } from '../auth/module';
import { PostingModule } from '../posting/module';

@Module({
  imports: [AuthModule, PostingModule],
  controllers: [LoansController],
  providers: [LoansService],
})
export class LoansModule {}

