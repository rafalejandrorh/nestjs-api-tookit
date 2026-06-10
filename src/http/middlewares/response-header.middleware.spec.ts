import type { NextFunction, Request, Response } from 'express';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { ResponseHeaderMiddleware } from './response-header.middleware';

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    path: '/api/orders',
    ...overrides,
  } as Request;
}

function createResponse(): Response {
  return {
    setHeader: jest.fn(),
  } as unknown as Response;
}

describe('ResponseHeaderMiddleware', () => {
  function createNext(): jest.MockedFunction<NextFunction> {
    return jest.fn() as jest.MockedFunction<NextFunction>;
  }

  it('skips header injection when disabled', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      http: { responseHeaders: { enabled: false } },
    };
    const middleware = new ResponseHeaderMiddleware(options);
    const response = createResponse();
    const next = createNext();

    middleware.use(createRequest(), response, next);

    expect(response.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('injects default headers by default', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
    };
    const middleware = new ResponseHeaderMiddleware(options);
    const response = createResponse();

    middleware.use(createRequest(), response, createNext());

    expect(response.setHeader).toHaveBeenCalledWith('x-content-type-options', 'nosniff');
    expect(response.setHeader).toHaveBeenCalledWith('x-frame-options', 'DENY');
    expect(response.setHeader).toHaveBeenCalledWith('referrer-policy', 'no-referrer');
  });

  it('injects custom configured headers', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      http: {
        responseHeaders: {
          headers: {
            'x-powered-by': 'api-toolkit',
          },
        },
      },
    };
    const middleware = new ResponseHeaderMiddleware(options);
    const response = createResponse();

    middleware.use(createRequest(), response, createNext());

    expect(response.setHeader).toHaveBeenCalledWith('x-powered-by', 'api-toolkit');
  });
});