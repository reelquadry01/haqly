import { Module } from '@nestjs/common';
import { DepreciationController } from './depreciation.controller';
import { DepreciationService } from './depreciation.service';
import { AuthModule } from '../auth/module';

@Module({
  imports: [AuthModule],
  controllers: [DepreciationController],
  providers: [DepreciationService],
})
export class DepreciationModule {}

