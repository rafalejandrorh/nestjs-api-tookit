import { DynamicModule, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../core/tokens';
import { ErrorRateLimitGuard, HmacGuard } from './guards';
import { ErrorRateLimitCounterMiddleware } from './middlewares/error-rate-limit-counter.middleware';

@Module({
  providers: [HmacGuard, ErrorRateLimitGuard, ErrorRateLimitCounterMiddleware],
  exports: [HmacGuard, ErrorRateLimitGuard],
})
export class SecurityModule implements NestModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    return {
      module: SecurityModule,
      providers: [{ provide: TOOLKIT_OPTIONS, useValue: options }],
      exports: [TOOLKIT_OPTIONS],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ErrorRateLimitCounterMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}