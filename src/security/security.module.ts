import { Module } from '@nestjs/common';
import { ErrorRateLimitGuard, HmacGuard } from '../guards';

@Module({
  providers: [HmacGuard, ErrorRateLimitGuard],
  exports: [HmacGuard, ErrorRateLimitGuard],
})
export class SecurityModule {}