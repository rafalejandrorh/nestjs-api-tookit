import { Module } from '@nestjs/common';
import { CacheService } from './services';

@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}