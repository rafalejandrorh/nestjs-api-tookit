import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { HmacGuard } from './hmac.guard';

function createExecutionContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('HmacGuard', () => {
  it('allows the request when hmac is disabled', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      hmac: { enabled: false, secretKey: 'secret' },
    };
    const guard = new HmacGuard(options);

    await expect(
      guard.canActivate(createExecutionContext({ path: '/api/orders', headers: {}, body: {} })),
    ).resolves.toBe(true);
  });

  it('skips validation when the route does not match globalMatch', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      globalMatch: { include: ['/api/orders'] },
      hmac: { enabled: true, secretKey: 'secret' },
    };
    const guard = new HmacGuard(options);

    await expect(
      guard.canActivate(createExecutionContext({ path: '/health', headers: {}, body: {} })),
    ).resolves.toBe(true);
  });

  it('allows the request when the signature is valid', async () => {
    const body = { orderId: 42 };
    const secretKey = 'secret';
    const signature = crypto.createHmac('sha256', secretKey).update(JSON.stringify(body)).digest('hex');
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      hmac: { enabled: true, secretKey },
    };
    const guard = new HmacGuard(options);

    await expect(
      guard.canActivate(
        createExecutionContext({
          path: '/api/orders',
          headers: { 'x-hmac-signature': signature },
          body,
        }),
      ),
    ).resolves.toBe(true);
  });

  it('throws UnauthorizedException when the signature is invalid', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      hmac: { enabled: true, secretKey: 'secret' },
    };
    const guard = new HmacGuard(options);

    await expect(
      guard.canActivate(
        createExecutionContext({
          path: '/api/orders',
          headers: { 'x-hmac-signature': 'invalid' },
          body: { orderId: 42 },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws UnauthorizedException when the signature header is missing', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      hmac: { enabled: true, secretKey: 'secret' },
    };
    const guard = new HmacGuard(options);

    await expect(
      guard.canActivate(
        createExecutionContext({
          path: '/api/orders',
          headers: {},
          body: { orderId: 42 },
        }),
      ),
    ).rejects.toMatchObject({ message: 'Missing HMAC signature' });
  });

  it('throws UnauthorizedException when the signature header is not a string', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      hmac: { enabled: true, secretKey: 'secret' },
    };
    const guard = new HmacGuard(options);

    await expect(
      guard.canActivate(
        createExecutionContext({
          path: '/api/orders',
          headers: { 'x-hmac-signature': ['invalid'] },
          body: { orderId: 42 },
        }),
      ),
    ).rejects.toMatchObject({ message: 'Missing HMAC signature' });
  });
});