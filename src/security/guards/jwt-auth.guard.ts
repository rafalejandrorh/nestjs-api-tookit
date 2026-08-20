import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../../core/tokens';
import { matchesToolkitRoute } from '../../core/utils/route-match.util';
import {
  TOOLKIT_REQUEST_USER,
  type ToolkitAuthUser,
} from '../interfaces/toolkit-auth-user.interface';

type JwtPayload = {
  sub?: string;
  client_id?: string;
  roles?: string[];
  scope?: string;
  username?: string;
  sub_type?: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TOOLKIT_OPTIONS) private readonly options: ToolkitOptions,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const path = typeof request.path === 'string' ? request.path : '';

    if (!matchesToolkitRoute(path, this.options.globalMatch)) {
      return true;
    }

    const headers = request.headers as Record<string, unknown> | undefined;
    const authorization = this.readAuthorization(headers);

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Bearer token is empty');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Token subject is missing');
    }

    const defaultRoles =
      this.options.security?.defaultRoles ??
      this.options.oauth?.defaultRoles ??
      ['ROLE_API_CLIENT'];

    const user: ToolkitAuthUser = {
      sub: payload.sub,
      clientId: payload.client_id ?? payload.sub,
      roles: Array.isArray(payload.roles) && payload.roles.length > 0 ? payload.roles : defaultRoles,
      ...(payload.scope ? { scope: payload.scope } : {}),
      ...(payload.username ? { username: payload.username } : {}),
      ...(payload.sub_type ? { subType: payload.sub_type } : {}),
    };

    request[TOOLKIT_REQUEST_USER] = user;
    request.user = user;

    return true;
  }

  private readAuthorization(headers: Record<string, unknown> | undefined): string | null {
    if (!headers) {
      return null;
    }

    const value = headers.authorization ?? headers.Authorization;
    return typeof value === 'string' ? value : null;
  }
}
