import { Inject, Injectable, NestMiddleware, UnsupportedMediaTypeException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../../core/tokens';
import { matchesToolkitRoute } from '../../core/utils/route-match.util';

const DEFAULT_METHODS = ['POST', 'PUT', 'PATCH'];

@Injectable()
export class ContentTypeMiddleware implements NestMiddleware {
  constructor(@Inject(TOOLKIT_OPTIONS) private readonly options: ToolkitOptions) {}

  use(req: Request, _: Response, next: NextFunction): void {
    const contentTypeConfig = this.options.http?.contentType;
    if (contentTypeConfig?.enabled === false) {
      return next();
    }

    if (!matchesToolkitRoute(req.path, this.options.globalMatch)) {
      return next();
    }

    const methods = contentTypeConfig?.enforceForMethods ?? DEFAULT_METHODS;
    const requiresJsonContentType = methods.includes(req.method.toUpperCase());
    if (!requiresJsonContentType) {
      return next();
    }

    const contentType = req.headers['content-type'];
    const normalizedContentType = Array.isArray(contentType)
      ? contentType.join(';')
      : (contentType ?? '');
    if (!normalizedContentType.toLowerCase().includes('application/json')) {
      throw new UnsupportedMediaTypeException('Content-Type must be application/json');
    }

    return next();
  }
}