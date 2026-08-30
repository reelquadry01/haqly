import { Module } from '@nestjs/common';
import { DepreciationController } from './depreciation.controller';
import { DepreciationService } from './depreciation.service';
import { AuthModule } from '../auth/module';
import { PostingModule } from '../posting/module';

@Module({
  imports: [AuthModule, PostingModule],
  controllers: [DepreciationController],
  providers: [DepreciationService],
})
export class DepreciationModule {}

