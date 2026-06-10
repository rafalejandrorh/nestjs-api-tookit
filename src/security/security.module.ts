import { DynamicModule, Module } from '@nestjs/common';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../core/tokens';
import { ErrorRateLimitGuard, HmacGuard } from './guards';

@Module({
  providers: [HmacGuard, ErrorRateLimitGuard],
  exports: [HmacGuard, ErrorRateLimitGuard],
})
export class SecurityModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    return {
      module: SecurityModule,
      providers: [{ provide: TOOLKIT_OPTIONS, useValue: options }],
      exports: [TOOLKIT_OPTIONS],
    };
  }
}