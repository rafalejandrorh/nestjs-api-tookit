import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../../core/tokens';
import { matchesToolkitRoute } from '../../core/utils/route-match.util';

const DEFAULT_RESPONSE_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

@Injectable()
export class ResponseHeaderMiddleware implements NestMiddleware {
  constructor(@Inject(TOOLKIT_OPTIONS) private readonly options: ToolkitOptions) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const responseHeaderConfig = this.options.http?.responseHeaders;
    if (responseHeaderConfig?.enabled === false) {
      return next();
    }

    if (!matchesToolkitRoute(req.path, this.options.globalMatch)) {
      return next();
    }

    const headers = {
      ...DEFAULT_RESPONSE_HEADERS,
      ...(responseHeaderConfig?.headers ?? {}),
    };

    for (const [header, value] of Object.entries(headers)) {
      res.setHeader(header, value);
    }

    next();
  }
}