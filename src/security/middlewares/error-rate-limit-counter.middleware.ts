import { Inject, Injectable, NestMiddleware, Optional } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS, TOOLKIT_STORAGE_DRIVER } from '../../core/tokens';
import { matchesToolkitRoute } from '../../core/utils/route-match.util';
import type { StorageDriver } from '../../storage/interfaces/storage.driver';

function toTtlSeconds(windowMs: number): number {
  return Math.max(1, Math.ceil(windowMs / 1000));
}

function resolveBanDurationMs(options: ToolkitOptions['errorRateLimit']): number {
  if (!options) {
    return 60000;
  }

  return options.banDurationMs ?? options.windowMs;
}

@Injectable()
export class ErrorRateLimitCounterMiddleware implements NestMiddleware {
  constructor(
    @Inject(TOOLKIT_OPTIONS) private readonly options: ToolkitOptions,
    @Optional() @Inject(TOOLKIT_STORAGE_DRIVER) private readonly storage?: StorageDriver,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.options.errorRateLimit?.enabled) {
      return next();
    }

    if (!matchesToolkitRoute(req.path, this.options.globalMatch)) {
      return next();
    }

    if (!this.storage) {
      return next();
    }

    res.on('finish', () => {
      if (res.statusCode !== 404) {
        return;
      }

      const key = `ip_404_attempts_${req.ip}`;
      const ttlSeconds = toTtlSeconds(resolveBanDurationMs(this.options.errorRateLimit));
      this.storage?.increment(key, ttlSeconds).catch(() => undefined);
    });

    return next();
  }
}