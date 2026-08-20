import { DynamicModule, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../core/tokens';
import { loadOptionalPeer } from '../core/utils/optional-peer.util';
import { ErrorRateLimitGuard, HmacGuard, JwtAuthGuard } from './guards';
import { ErrorRateLimitCounterMiddleware } from './middlewares/error-rate-limit-counter.middleware';

type JwtModuleLike = {
  register(config: Record<string, unknown>): DynamicModule;
};

@Module({
  providers: [HmacGuard, ErrorRateLimitGuard, ErrorRateLimitCounterMiddleware],
  exports: [HmacGuard, ErrorRateLimitGuard],
})
export class SecurityModule implements NestModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const jwtSecret = options.security?.jwtSecret ?? options.oauth?.jwtSecret;
    const imports: DynamicModule[] = [];
    const providers: unknown[] = [{ provide: TOOLKIT_OPTIONS, useValue: options }];
    const exports: unknown[] = [TOOLKIT_OPTIONS, HmacGuard, ErrorRateLimitGuard];

    if (jwtSecret) {
      const { JwtModule } = loadOptionalPeer<{ JwtModule: JwtModuleLike }>(
        '@nestjs/jwt',
        'JwtAuthGuard (security.jwtSecret or oauth.jwtSecret)',
      );

      imports.push(
        JwtModule.register({
          secret: jwtSecret,
          signOptions: {
            issuer: options.security?.jwtIssuer ?? options.oauth?.jwtIssuer,
            algorithm: (options.security?.jwtAlgorithm ??
              options.oauth?.jwtAlgorithm ??
              'HS256') as 'HS256',
          },
        }),
      );
      providers.push(JwtAuthGuard);
      exports.push(JwtAuthGuard);
    }

    return {
      module: SecurityModule,
      imports,
      providers: providers as never[],
      exports: exports as never[],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ErrorRateLimitCounterMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
