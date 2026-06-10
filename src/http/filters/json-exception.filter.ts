import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../../core/tokens';
import { matchesToolkitRoute } from '../../core/utils/route-match.util';

@Catch()
export class JsonExceptionFilter implements ExceptionFilter {
  constructor(@Inject(TOOLKIT_OPTIONS) private readonly options: ToolkitOptions) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const exceptionConfig = this.options.http?.exception;

    if (exceptionConfig?.enabled === false) {
      this.replyWithDefaultHttpPayload(response, exception);
      return;
    }

    if (!matchesToolkitRoute(request.path, this.options.globalMatch)) {
      this.replyWithDefaultHttpPayload(response, exception);
      return;
    }

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : null;

    const payload = {
      statusCode,
      error: isHttpException ? exception.name : 'InternalServerError',
      message: this.resolveMessage(exceptionResponse, exception),
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      ...(exceptionConfig?.includeStack && exception instanceof Error ? { stack: exception.stack } : {}),
    };

    response.status(statusCode).json(payload);
  }

  private replyWithDefaultHttpPayload(response: Response, exception: unknown): void {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        response.status(statusCode).json({
          statusCode,
          message: exceptionResponse,
        });
        return;
      }

      response.status(statusCode).json(exceptionResponse);
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }

  private resolveMessage(responseBody: unknown, exception: unknown): string {
    if (typeof responseBody === 'string') {
      return responseBody;
    }

    if (responseBody && typeof responseBody === 'object') {
      const message = (responseBody as { message?: unknown }).message;
      if (Array.isArray(message)) {
        return message.join(', ');
      }

      if (typeof message === 'string') {
        return message;
      }
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }
}