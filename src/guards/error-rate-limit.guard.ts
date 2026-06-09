import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import type { StorageDriver } from "../drivers/interfaces/storage.driver";
import { TOOLKIT_OPTIONS, TOOLKIT_STORAGE_DRIVER } from '../core/tokens';


@Injectable()
export class ErrorRateLimitGuard implements CanActivate {
  constructor(
    @Inject(TOOLKIT_OPTIONS) private options: ToolkitOptions,
    @Inject(TOOLKIT_STORAGE_DRIVER) private storage: StorageDriver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.options.errorRateLimit?.enabled) return true;

    const request = context.switchToHttp().getRequest();
    const ip = request.ip;
    const key = `rate-limit:errors:${ip}`;
    const currentErrors = await this.storage.get(key);
    
    if (currentErrors && parseInt(currentErrors, 10) >= this.options.errorRateLimit.maxErrors) {
      // Lanzar error 429 si ya superó el límite
      throw new Error('Too many failed requests'); 
    }

    return true;
  }
}