import * as crypto from 'crypto';
import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../core/tokens';

@Injectable()
export class HmacGuard implements CanActivate {
  constructor(@Inject(TOOLKIT_OPTIONS) private options: ToolkitOptions) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.options.hmac?.enabled) {
      return true; // Toggle apagado, permitimos el paso
    }

    const request = context.switchToHttp().getRequest();
    if (!this.isRouteMatching(request.path, this.options.globalMatch)) {
      return true; // Ignora la validación y deja pasar
    }

    const signature = request.headers['x-hmac-signature'];
    const payload = JSON.stringify(request.body); // O la data que uses para firmar
    const expectedSignature = crypto
      .createHmac('sha256', this.options.hmac.secretKey)
      .update(payload)
      .digest('hex');
    return signature === expectedSignature;
  }

  private isRouteMatching(path: string, options: ToolkitOptions['globalMatch']): boolean {
    if (!options) return true; // Si no hay configuración, aplica a todo

    const isExcluded = options.exclude?.some(pattern => path.match(pattern));
    if (isExcluded) return false;

    const isIncluded = options.include?.some(pattern => path.match(pattern));
    return isIncluded ?? false;
  }
}