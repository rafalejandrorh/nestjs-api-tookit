import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import type { StorageDriver } from '../../storage/interfaces/storage.driver';
import { TOOLKIT_OPTIONS, TOOLKIT_STORAGE_DRIVER } from '../../core/tokens';
import { matchesToolkitRoute } from '../../core/utils/route-match.util';

function parseStoredErrorCount(value: string | null): number | null {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

@Injectable()
export class ErrorRateLimitGuard implements CanActivate {
  constructor(
    @Inject(TOOLKIT_OPTIONS) private options: ToolkitOptions,
    @Inject(TOOLKIT_STORAGE_DRIVER) private storage: StorageDriver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Toggle apagado, permitimos el paso
    if (!this.options.errorRateLimit?.enabled) return true;

    const request = context.switchToHttp().getRequest();
    if (!matchesToolkitRoute(request.path, this.options.globalMatch)) {
      return true;
    }

    const ip = request.ip;
    const key = `rate-limit:errors:${ip}`;
    const currentErrors = parseStoredErrorCount(await this.storage.get(key));

    if (currentErrors != null && currentErrors >= this.options.errorRateLimit.maxErrors) {
      throw new HttpException('Too many failed requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}