import { Global, Module } from '@nestjs/common';
import { PostingService } from './posting.service';

@Global()
@Module({
  providers: [PostingService],
  exports: [PostingService],
})
export class PostingModule {}
