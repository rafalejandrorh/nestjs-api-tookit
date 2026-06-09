import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import type { StorageDriver } from '../../storage/interfaces/storage.driver';
import { ErrorRateLimitGuard } from './error-rate-limit.guard';

function createExecutionContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

function createStorageDriver(getValue: string | null): StorageDriver {
  return {
    get: jest.fn().mockResolvedValue(getValue),
    set: jest.fn(),
    increment: jest.fn(),
  };
}

describe('ErrorRateLimitGuard', () => {
  it('allows the request when rate limit is disabled', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      errorRateLimit: { enabled: false, maxErrors: 3, windowMs: 60000 },
    };
    const guard = new ErrorRateLimitGuard(options, createStorageDriver(null));

    await expect(
      guard.canActivate(createExecutionContext({ path: '/api/orders', ip: '127.0.0.1' })),
    ).resolves.toBe(true);
  });

  it('skips validation when the route does not match globalMatch', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      globalMatch: { include: ['/api/orders'] },
      errorRateLimit: { enabled: true, maxErrors: 3, windowMs: 60000 },
    };
    const storage = createStorageDriver('99');
    const guard = new ErrorRateLimitGuard(options, storage);

    await expect(
      guard.canActivate(createExecutionContext({ path: '/health', ip: '127.0.0.1' })),
    ).resolves.toBe(true);
    expect(storage.get).not.toHaveBeenCalled();
  });

  it('allows the request when current errors are below the configured threshold', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      errorRateLimit: { enabled: true, maxErrors: 3, windowMs: 60000 },
    };
    const guard = new ErrorRateLimitGuard(options, createStorageDriver('2'));

    await expect(
      guard.canActivate(createExecutionContext({ path: '/api/orders', ip: '127.0.0.1' })),
    ).resolves.toBe(true);
  });

  it('throws HttpException with 429 when current errors exceed the threshold', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      errorRateLimit: { enabled: true, maxErrors: 3, windowMs: 60000 },
    };
    const guard = new ErrorRateLimitGuard(options, createStorageDriver('3'));

    await expect(
      guard.canActivate(createExecutionContext({ path: '/api/orders', ip: '127.0.0.1' })),
    ).rejects.toMatchObject<HttpException>({
      message: 'Too many failed requests',
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });
});