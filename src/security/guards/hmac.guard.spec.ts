import * as crypto from 'crypto';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
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

function computeSignature(request: {
  method?: string;
  originalUrl?: string;
  url?: string;
  path: string;
  body?: unknown;
  rawBody?: Buffer | string;
}, timestamp: string, secret: string): string {
  const rawBody = Buffer.isBuffer(request.rawBody)
    ? request.rawBody.toString('utf8')
    : typeof request.rawBody === 'string'
      ? request.rawBody
      : typeof request.body === 'string'
        ? request.body
        : request.body == null
          ? ''
          : JSON.stringify(request.body);
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const uri = request.originalUrl ?? request.url ?? request.path;
  const message = `${request.method?.toUpperCase() ?? 'GET'}|${uri}|${bodyHash}|${timestamp}`;

  return crypto.createHmac('sha256', secret).update(message).digest('base64');
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
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      hmac: { enabled: true, secretKey },
    };
    const guard = new HmacGuard(options);
    const request = {
      method: 'POST',
      path: '/api/orders',
      originalUrl: '/api/orders?foo=bar',
      headers: {
        'x-timestamp': timestamp,
      },
      body,
    };
    request.headers['x-signature'] = computeSignature(request, timestamp, secretKey);

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect((request as Record<string, unknown>).authenticated_hmac).toEqual(
      expect.objectContaining({
        timestamp,
        method: 'POST',
        uri: '/api/orders?foo=bar',
      }),
    );
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
          method: 'POST',
          path: '/api/orders',
          originalUrl: '/api/orders',
          headers: {
            'x-timestamp': `${Math.floor(Date.now() / 1000)}`,
            'x-signature': 'invalid',
          },
          body: { orderId: 42 },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws BadRequestException when required HMAC headers are missing', async () => {
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
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws ForbiddenException when timestamp is outside tolerance', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      hmac: { enabled: true, secretKey: 'secret', timestampTolerance: 10 },
    };
    const guard = new HmacGuard(options);

    await expect(
      guard.canActivate(
        createExecutionContext({
          method: 'POST',
          path: '/api/orders',
          originalUrl: '/api/orders',
          headers: {
            'x-timestamp': `${Math.floor(Date.now() / 1000) - 11}`,
            'x-signature': 'ignored',
          },
          body: { orderId: 42 },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses rawBody when present to compute the signature', async () => {
    const secretKey = 'secret';
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      hmac: { enabled: true, secretKey, requestAttributeName: 'verifiedHmac' },
    };
    const guard = new HmacGuard(options);
    const request = {
      method: 'POST',
      path: '/api/orders',
      originalUrl: '/api/orders',
      headers: {
        'x-timestamp': timestamp,
      },
      body: { orderId: 42 },
      rawBody: '{"orderId":42}',
    };
    request.headers['x-signature'] = computeSignature(request, timestamp, secretKey);

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect((request as Record<string, unknown>).verifiedHmac).toEqual(
      expect.objectContaining({
        timestamp,
        uri: '/api/orders',
      }),
    );
  });
});