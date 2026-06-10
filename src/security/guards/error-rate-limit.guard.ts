import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
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

function parseStoredBoolean(value: string | null): boolean {
  if (value == null) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
}

function toTtlSeconds(windowMs: number): number {
  return Math.max(1, Math.ceil(windowMs / 1000));
}

@Injectable()
export class ErrorRateLimitGuard implements CanActivate {
  constructor(
    @Inject(TOOLKIT_OPTIONS) private readonly options: ToolkitOptions,
    @Optional() @Inject(TOOLKIT_STORAGE_DRIVER) private readonly storage?: StorageDriver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Toggle apagado, permitimos el paso
    if (!this.options.errorRateLimit?.enabled) return true;

    const request = context.switchToHttp().getRequest();
    if (!matchesToolkitRoute(request.path, this.options.globalMatch)) {
      return true;
    }

    if (!this.storage) {
      throw new InternalServerErrorException(
        'TOOLKIT_STORAGE_DRIVER is required when errorRateLimit is enabled',
      );
    }

    const ip = request.ip;
    const banKey = `banned_ip_${ip}`;
    if (parseStoredBoolean(await this.storage.get(banKey))) {
      throw new ForbiddenException('IP banned');
    }

    const legacyAttemptKey = `rate-limit:errors:${ip}`;
    const parityAttemptKey = `ip_404_attempts_${ip}`;
    const parityAttempts = parseStoredErrorCount(await this.storage.get(parityAttemptKey));
    const legacyAttempts = parseStoredErrorCount(await this.storage.get(legacyAttemptKey));
    const currentErrors = parityAttempts ?? legacyAttempts;

    if (currentErrors != null && currentErrors > this.options.errorRateLimit.maxErrors) {
      const ttlSeconds = toTtlSeconds(this.options.errorRateLimit.windowMs);
      await this.storage.set(banKey, '1', ttlSeconds);
      await this.storage.set(parityAttemptKey, '0', ttlSeconds);
      throw new ForbiddenException('IP banned');
    }

    return true;
  }
}