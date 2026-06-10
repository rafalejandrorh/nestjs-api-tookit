import type { NextFunction, Request, Response } from 'express';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import type { StorageDriver } from '../../storage/interfaces/storage.driver';
import { ErrorRateLimitCounterMiddleware } from './error-rate-limit-counter.middleware';

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    path: '/api/orders',
    ip: '127.0.0.1',
    ...overrides,
  } as Request;
}

function createResponse(statusCode = 200): { response: Response; listeners: Record<string, () => void> } {
  const listeners: Record<string, () => void> = {};
  const response = {
    statusCode,
    on: jest.fn((event: string, listener: () => void) => {
      listeners[event] = listener;
      return response;
    }),
  } as unknown as Response;

  return { response, listeners };
}

function createStorage(): jest.Mocked<StorageDriver> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    increment: jest.fn().mockResolvedValue(1),
  };
}

describe('ErrorRateLimitCounterMiddleware', () => {
  function createNext(): jest.MockedFunction<NextFunction> {
    return jest.fn() as jest.MockedFunction<NextFunction>;
  }

  it('does nothing when errorRateLimit is disabled', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      errorRateLimit: { enabled: false, maxErrors: 3, windowMs: 60000 },
    };
    const storage = createStorage();
    const middleware = new ErrorRateLimitCounterMiddleware(options, storage);
    const next = createNext();

    middleware.use(createRequest(), createResponse().response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(storage.increment).not.toHaveBeenCalled();
  });

  it('does nothing when route does not match globalMatch', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      globalMatch: { include: ['^/api/orders'] },
      errorRateLimit: { enabled: true, maxErrors: 3, windowMs: 60000 },
    };
    const storage = createStorage();
    const middleware = new ErrorRateLimitCounterMiddleware(options, storage);
    const next = createNext();

    middleware.use(createRequest({ path: '/health' }), createResponse().response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(storage.increment).not.toHaveBeenCalled();
  });

  it('increments parity key on 404 response', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      errorRateLimit: { enabled: true, maxErrors: 3, windowMs: 60000 },
    };
    const storage = createStorage();
    const middleware = new ErrorRateLimitCounterMiddleware(options, storage);
    const next = createNext();
    const { response, listeners } = createResponse(404);

    middleware.use(createRequest(), response, next);
    listeners.finish();

    await Promise.resolve();
    expect(storage.increment).toHaveBeenCalledWith('ip_404_attempts_127.0.0.1', 60);
  });

  it('does not increment when response status is not 404', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      errorRateLimit: { enabled: true, maxErrors: 3, windowMs: 60000 },
    };
    const storage = createStorage();
    const middleware = new ErrorRateLimitCounterMiddleware(options, storage);
    const next = createNext();
    const { response, listeners } = createResponse(200);

    middleware.use(createRequest(), response, next);
    listeners.finish();

    await Promise.resolve();
    expect(storage.increment).not.toHaveBeenCalled();
  });

  it('uses banDurationMs for attempts TTL when provided', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      errorRateLimit: {
        enabled: true,
        maxAttempts404: 3,
        banDurationMs: 120000,
        maxErrors: 3,
        windowMs: 60000,
      },
    };
    const storage = createStorage();
    const middleware = new ErrorRateLimitCounterMiddleware(options, storage);
    const next = createNext();
    const { response, listeners } = createResponse(404);

    middleware.use(createRequest(), response, next);
    listeners.finish();

    await Promise.resolve();
    expect(storage.increment).toHaveBeenCalledWith('ip_404_attempts_127.0.0.1', 120);
  });
});