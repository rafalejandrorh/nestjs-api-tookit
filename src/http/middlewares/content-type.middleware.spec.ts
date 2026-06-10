import { UnsupportedMediaTypeException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { ContentTypeMiddleware } from './content-type.middleware';

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/api/orders',
    headers: {},
    ...overrides,
  } as Request;
}

describe('ContentTypeMiddleware', () => {
  function createNext(): jest.MockedFunction<NextFunction> {
    return jest.fn() as jest.MockedFunction<NextFunction>;
  }

  it('allows requests when middleware is disabled', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
      http: { contentType: { enabled: false } },
    };
    const middleware = new ContentTypeMiddleware(options);
    const next = createNext();

    middleware.use(createRequest(), {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows GET requests without content-type enforcement', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
    };
    const middleware = new ContentTypeMiddleware(options);
    const next = createNext();

    middleware.use(createRequest({ method: 'GET' }), {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('throws when a required method does not use application/json', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
    };
    const middleware = new ContentTypeMiddleware(options);

    expect(() => middleware.use(createRequest(), {} as Response, createNext())).toThrow(
      UnsupportedMediaTypeException,
    );
  });

  it('allows JSON content type for required methods', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
    };
    const middleware = new ContentTypeMiddleware(options);
    const next = createNext();

    middleware.use(
      createRequest({ headers: { 'content-type': 'application/json; charset=utf-8' } }),
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });
});