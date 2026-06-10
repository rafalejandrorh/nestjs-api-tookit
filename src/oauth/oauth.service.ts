import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import type {
  OAuthToolkitClient,
  OAuthToolkitUser,
  ToolkitOptions,
} from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../core/tokens';
import type { OAuthTokenRequest } from './interfaces/oauth-token-request.interface';
import type { OAuthTokenResponse } from './interfaces/oauth-token-response.interface';

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseExpiresInSeconds(value: string | number | undefined): number | undefined {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const match = value.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return amount * multiplier;
}

@Injectable()
export class OAuthService {
  constructor(
    @Inject(TOOLKIT_OPTIONS) private readonly options: ToolkitOptions,
    private readonly jwtService: JwtService,
  ) {}

  issueToken(request: OAuthTokenRequest): OAuthTokenResponse {
    const grantType = request.grant_type;
    if (grantType !== 'client_credentials' && grantType !== 'password') {
      throw new BadRequestException('Unsupported grant_type');
    }

    const client = this.findClient(request.client_id, request.client_secret);
    const scope = this.resolveScope(client, request.scope);
    const expiresIn = this.options.oauth?.accessTokenExpiresIn ?? '1h';

    if (grantType === 'password') {
      if (!request.username || !request.password) {
        throw new BadRequestException('username and password are required for password grant');
      }

      const user = this.findUser(client, request.username, request.password);
      const accessToken = this.jwtService.sign({
        sub: `${client.clientId}:${user.username}`,
        client_id: client.clientId,
        username: user.username,
        scope,
      });

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: parseExpiresInSeconds(expiresIn),
        scope,
      };
    }

    const accessToken = this.jwtService.sign({
      sub: client.clientId,
      client_id: client.clientId,
      scope,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: parseExpiresInSeconds(expiresIn),
      scope,
    };
  }

  private findClient(clientId: string, clientSecret: string): OAuthToolkitClient {
    const clients = this.options.oauth?.clients ?? [];
    const client = clients.find(item => safeCompare(item.clientId, clientId));

    if (!client || !safeCompare(client.clientSecret, clientSecret)) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    return client;
  }

  private findUser(client: OAuthToolkitClient, username: string, password: string): OAuthToolkitUser {
    const users = client.users ?? [];
    const user = users.find(item => safeCompare(item.username, username));

    if (!user || !safeCompare(user.password, password)) {
      throw new UnauthorizedException('Invalid resource owner credentials');
    }

    return user;
  }

  private resolveScope(client: OAuthToolkitClient, requestedScope?: string): string | undefined {
    if (!requestedScope) {
      return client.scopes?.join(' ');
    }

    const requestedScopes = requestedScope.split(/\s+/).filter(Boolean);
    const allowedScopes = new Set(client.scopes ?? []);

    if (allowedScopes.size === 0) {
      return requestedScopes.join(' ');
    }

    const invalidScope = requestedScopes.find(scope => !allowedScopes.has(scope));
    if (invalidScope) {
      throw new BadRequestException(`Invalid scope requested: ${invalidScope}`);
    }

    return requestedScopes.join(' ');
  }
}