import { DynamicModule, MiddlewareConsumer, Module, NestModule, Provider, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../core/tokens';
import { loadOptionalPeer } from '../core/utils/optional-peer.util';
import { ErrorRateLimitGuard, HmacGuard, JwtAuthGuard } from './guards';
import { ErrorRateLimitCounterMiddleware } from './middlewares/error-rate-limit-counter.middleware';

type JwtModuleLike = {
  register(config: Record<string, unknown>): DynamicModule;
};

function shouldAutoRegisterGuard(enabled: boolean | undefined, autoRegister?: boolean): boolean {
  return enabled === true && autoRegister !== false;
}

@Module({
  providers: [HmacGuard, ErrorRateLimitGuard, ErrorRateLimitCounterMiddleware],
  exports: [HmacGuard, ErrorRateLimitGuard],
})
export class SecurityModule implements NestModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const jwtSecret = options.security?.jwtSecret ?? options.oauth?.jwtSecret;
    const imports: DynamicModule[] = [];
    const providers: Provider[] = [
      { provide: TOOLKIT_OPTIONS, useValue: options },
      HmacGuard,
      ErrorRateLimitGuard,
      ErrorRateLimitCounterMiddleware,
    ];
    const exports: Array<string | symbol | Provider | Function> = [
      TOOLKIT_OPTIONS,
      HmacGuard,
      ErrorRateLimitGuard,
    ];

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

    if (shouldAutoRegisterGuard(options.hmac?.enabled, options.hmac?.autoRegisterGuard)) {
      providers.push({
        provide: APP_GUARD,
        useClass: HmacGuard,
      });
    }

    if (
      shouldAutoRegisterGuard(options.errorRateLimit?.enabled, options.errorRateLimit?.autoRegisterGuard)
    ) {
      providers.push({
        provide: APP_GUARD,
        useClass: ErrorRateLimitGuard,
      });
    }

    return {
      module: SecurityModule,
      imports,
      providers,
      exports,
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ErrorRateLimitCounterMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
