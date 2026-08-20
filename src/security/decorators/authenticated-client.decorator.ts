import { UnauthorizedException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TOOLKIT_REQUEST_USER } from '../interfaces/toolkit-auth-user.interface';

export const DEFAULT_AUTHENTICATED_CLIENT_ATTRIBUTE = 'authenticated_oauth_client';
export const DEFAULT_HMAC_ATTRIBUTE = 'authenticated_hmac';

export function resolveAuthenticatedClient(
  request: Record<string, unknown>,
  attributeName = DEFAULT_AUTHENTICATED_CLIENT_ATTRIBUTE,
): unknown {
  const client =
    request[attributeName] ??
    request[DEFAULT_HMAC_ATTRIBUTE] ??
    request[TOOLKIT_REQUEST_USER] ??
    request.user;

  if (client == null) {
    throw new UnauthorizedException('Authenticated client is missing');
  }

  return client;
}

export const AuthenticatedClient = createParamDecorator(
  (attributeName: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    return resolveAuthenticatedClient(request, attributeName ?? DEFAULT_AUTHENTICATED_CLIENT_ATTRIBUTE);
  },
);
