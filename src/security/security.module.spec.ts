import { APP_GUARD } from '@nestjs/core';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { ErrorRateLimitGuard } from './guards/error-rate-limit.guard';
import { HmacGuard } from './guards/hmac.guard';
import { SecurityModule } from './security.module';

describe('SecurityModule.forRoot autoRegisterGuard', () => {
  it('registers HmacGuard as APP_GUARD when hmac.enabled is true', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      hmac: { enabled: true, secretKey: 'secret' },
    };

    const module = SecurityModule.forRoot(options);
    const appGuards = (module.providers ?? []).filter(
      provider => typeof provider === 'object' && provider !== null && 'provide' in provider && provider.provide === APP_GUARD,
    );

    expect(appGuards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provide: APP_GUARD, useClass: HmacGuard }),
      ]),
    );
  });

  it('registers ErrorRateLimitGuard as APP_GUARD when errorRateLimit.enabled is true', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      errorRateLimit: { enabled: true, maxAttempts404: 3, banDurationMs: 1000 },
    };

    const module = SecurityModule.forRoot(options);
    const appGuards = (module.providers ?? []).filter(
      provider => typeof provider === 'object' && provider !== null && 'provide' in provider && provider.provide === APP_GUARD,
    );

    expect(appGuards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provide: APP_GUARD, useClass: ErrorRateLimitGuard }),
      ]),
    );
  });

  it('skips auto registration when autoRegisterGuard is false', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      hmac: { enabled: true, secretKey: 'secret', autoRegisterGuard: false },
      errorRateLimit: {
        enabled: true,
        maxAttempts404: 3,
        banDurationMs: 1000,
        autoRegisterGuard: false,
      },
    };

    const module = SecurityModule.forRoot(options);
    const appGuards = (module.providers ?? []).filter(
      provider => typeof provider === 'object' && provider !== null && 'provide' in provider && provider.provide === APP_GUARD,
    );

    expect(appGuards).toHaveLength(0);
  });

  it('does not register APP_GUARD when features are disabled', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      hmac: { enabled: false, secretKey: 'secret' },
      errorRateLimit: { enabled: false },
    };

    const module = SecurityModule.forRoot(options);
    const appGuards = (module.providers ?? []).filter(
      provider => typeof provider === 'object' && provider !== null && 'provide' in provider && provider.provide === APP_GUARD,
    );

    expect(appGuards).toHaveLength(0);
  });
});
