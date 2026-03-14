import { Module } from '@nestjs/common';
import { FixedAssetsController } from './fixed-assets.controller';
import { FixedAssetsService } from './fixed-assets.service';
import { AuthModule } from '../auth/module';

@Module({
  imports: [AuthModule],
  controllers: [FixedAssetsController],
  providers: [FixedAssetsService],
})
export class FixedAssetsModule {}

