import type { NextFunction, Request, Response } from 'express';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import type { AuditRepository } from '../interfaces/audit-repository.interface';
import { AuditMiddleware } from './audit.middleware';

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/api/orders',
    originalUrl: '/api/orders',
    ip: '127.0.0.1',
    body: { orderId: 42 },
    ...overrides,
  } as Request;
}

function createResponse() {
  const listeners: Record<string, () => Promise<void> | void> = {};
  const response = {
    statusCode: 201,
    send: jest.fn(function (body: unknown) {
      return body;
    }),
    on: jest.fn((event: string, listener: () => Promise<void> | void) => {
      listeners[event] = listener;
      return response;
    }),
  } as unknown as Response;

  return { response, listeners };
}

describe('AuditMiddleware', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  function createNext(): jest.MockedFunction<NextFunction> {
    return jest.fn() as jest.MockedFunction<NextFunction>;
  }

  it('calls next immediately when audit is disabled', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      audit: { enabled: false, repository: 'sql' },
    };
    const auditRepo: AuditRepository = { saveLog: jest.fn() };
    const middleware = new AuditMiddleware(options, auditRepo);
    const next = createNext();

    middleware.use(createRequest(), createResponse().response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(auditRepo.saveLog).not.toHaveBeenCalled();
  });

  it('calls next immediately when the route does not match globalMatch', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      globalMatch: { include: ['/api/orders'] },
      audit: { enabled: true, repository: 'sql' },
    };
    const auditRepo: AuditRepository = { saveLog: jest.fn() };
    const middleware = new AuditMiddleware(options, auditRepo);
    const next = createNext();

    middleware.use(createRequest({ path: '/health', originalUrl: '/health' }), createResponse().response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(auditRepo.saveLog).not.toHaveBeenCalled();
  });

  it('saves an audit log when the response finishes', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      audit: { enabled: true, repository: 'sql' },
    };
    const auditRepo: AuditRepository = { saveLog: jest.fn().mockResolvedValue(undefined) };
    const middleware = new AuditMiddleware(options, auditRepo);
    const next = createNext();
    const { response, listeners } = createResponse();

    middleware.use(createRequest(), response, next);
    response.send(JSON.stringify({ ok: true }));
    await listeners.finish();

    expect(next).toHaveBeenCalledTimes(1);
    expect(auditRepo.saveLog).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/api/orders',
        ip: '127.0.0.1',
        requestBody: { orderId: 42 },
        responseStatusCode: 201,
        responseBody: { ok: true },
      }),
    );
  });

  it('redacts sensitive fields from the request body before persisting', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      audit: { enabled: true, repository: 'sql' },
    };
    const auditRepo: AuditRepository = { saveLog: jest.fn().mockResolvedValue(undefined) };
    const middleware = new AuditMiddleware(options, auditRepo);
    const next = createNext();
    const { response, listeners } = createResponse();
    const request = createRequest({
      body: {
        email: 'user@example.com',
        password: 'plain-secret',
        nested: {
          token: 'abc123',
          profile: { name: 'Rafael' },
        },
      },
    });

    middleware.use(request, response, next);
    response.send(JSON.stringify({ ok: true }));
    await listeners.finish();

    expect(auditRepo.saveLog).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          email: 'user@example.com',
          password: '[REDACTED]',
          nested: {
            token: '[REDACTED]',
            profile: { name: 'Rafael' },
          },
        },
      }),
    );
  });

  it('redacts additional configured fields from the request body', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      audit: {
        enabled: true,
        repository: 'sql',
        redactFields: ['ssn', 'creditCard'],
      },
    };
    const auditRepo: AuditRepository = { saveLog: jest.fn().mockResolvedValue(undefined) };
    const middleware = new AuditMiddleware(options, auditRepo);
    const next = createNext();
    const { response, listeners } = createResponse();
    const request = createRequest({
      body: {
        email: 'user@example.com',
        ssn: '123-45-6789',
        nested: {
          creditCard: '4111111111111111',
          profile: { name: 'Rafael' },
        },
      },
    });

    middleware.use(request, response, next);
    response.send(JSON.stringify({ ok: true }));
    await listeners.finish();

    expect(auditRepo.saveLog).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          email: 'user@example.com',
          ssn: '[REDACTED]',
          nested: {
            creditCard: '[REDACTED]',
            profile: { name: 'Rafael' },
          },
        },
      }),
    );
  });

  it('treats configured redacted fields case-insensitively', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      audit: {
        enabled: true,
        repository: 'sql',
        redactFields: ['X-Api-Key'],
      },
    };
    const auditRepo: AuditRepository = { saveLog: jest.fn().mockResolvedValue(undefined) };
    const middleware = new AuditMiddleware(options, auditRepo);
    const next = createNext();
    const { response, listeners } = createResponse();
    const requestBody = {
      'x-api-key': 'secret-key',
    };
    const request = createRequest({
      body: requestBody,
    });

    middleware.use(request, response, next);
    response.send(JSON.stringify({ ok: true }));
    await listeners.finish();

    expect(auditRepo.saveLog).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: { 'x-api-key': '[REDACTED]' },
      }),
    );
  });

  it('captures repository write errors without throwing', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      audit: { enabled: true, repository: 'sql' },
    };
    const auditRepo: AuditRepository = { saveLog: jest.fn().mockRejectedValue(new Error('db down')) };
    const middleware = new AuditMiddleware(options, auditRepo);
    const next = createNext();
    const { response, listeners } = createResponse();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    middleware.use(createRequest(), response, next);
    response.send(JSON.stringify({ ok: true }));
    await listeners.finish();
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving audit log', expect.any(Error));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('stores plain string responses without throwing on invalid JSON', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      audit: { enabled: true, repository: 'sql' },
    };
    const auditRepo: AuditRepository = { saveLog: jest.fn().mockResolvedValue(undefined) };
    const middleware = new AuditMiddleware(options, auditRepo);
    const next = createNext();
    const { response, listeners } = createResponse();

    middleware.use(createRequest(), response, next);
    response.send('ok');
    await listeners.finish();

    expect(auditRepo.saveLog).toHaveBeenCalledWith(
      expect.objectContaining({
        responseBody: 'ok',
      }),
    );
  });

  it('stores non-string response bodies as-is', async () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      audit: { enabled: true, repository: 'sql' },
    };
    const auditRepo: AuditRepository = { saveLog: jest.fn().mockResolvedValue(undefined) };
    const middleware = new AuditMiddleware(options, auditRepo);
    const next = createNext();
    const { response, listeners } = createResponse();

    middleware.use(createRequest(), response, next);
    response.send({ ok: true });
    await listeners.finish();

    expect(auditRepo.saveLog).toHaveBeenCalledWith(
      expect.objectContaining({
        responseBody: { ok: true },
      }),
    );
  });
});