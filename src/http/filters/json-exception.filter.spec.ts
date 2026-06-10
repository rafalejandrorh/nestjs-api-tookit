import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { JsonExceptionFilter } from './json-exception.filter';

function createHost(request: Partial<Request>, response: Partial<Response>): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;
}

function createResponse() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json };
}

describe('JsonExceptionFilter', () => {
  it('serializes HttpException into JSON payload', () => {
    const options: ToolkitOptions = { storage: { type: 'memory' } };
    const filter = new JsonExceptionFilter(options);
    const response = createResponse();
    const host = createHost({ path: '/api/orders', originalUrl: '/api/orders' }, response as unknown as Response);

    filter.catch(new BadRequestException('invalid payload'), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'BadRequestException',
        message: 'invalid payload',
        path: '/api/orders',
      }),
    );
  });

  it('serializes unknown errors as 500 JSON', () => {
    const options: ToolkitOptions = { storage: { type: 'memory' } };
    const filter = new JsonExceptionFilter(options);
    const response = createResponse();
    const host = createHost({ path: '/api/orders', originalUrl: '/api/orders' }, response as unknown as Response);

    filter.catch(new Error('unexpected failure'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'InternalServerError',
        message: 'unexpected failure',
      }),
    );
  });
});