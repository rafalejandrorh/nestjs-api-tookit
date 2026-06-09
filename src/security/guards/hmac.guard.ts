import * as crypto from 'crypto';
import { Injectable, CanActivate, ExecutionContext, Inject, UnauthorizedException } from '@nestjs/common';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../../core/tokens';
import { matchesToolkitRoute } from '../../core/utils/route-match.util';

@Injectable()
export class HmacGuard implements CanActivate {
  constructor(@Inject(TOOLKIT_OPTIONS) private options: ToolkitOptions) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Toggle apagado, permitimos el paso
    if (!this.options.hmac?.enabled) return true;

    const request = context.switchToHttp().getRequest();
    if (!matchesToolkitRoute(request.path, this.options.globalMatch)) {
      return true; // Ignora la validación y deja pasar
    }

    const signature = request.headers['x-hmac-signature'];
    const payload = JSON.stringify(request.body); // O la data que uses para firmar
    const expectedSignature = crypto
      .createHmac('sha256', this.options.hmac.secretKey)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid HMAC signature');
    }
    return true;
  }
}