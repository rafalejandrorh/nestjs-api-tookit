import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import { TOOLKIT_OAUTH_CLIENT_REPOSITORY, TOOLKIT_OPTIONS } from '../core/tokens';
import type {
  OAuthToolkitClient,
  OAuthToolkitUser,
  ToolkitOptions,
} from '../core/interfaces/toolkit-options.interface';
import type { OAuthTokenRequest } from './interfaces/oauth-token-request.interface';
import type { OAuthTokenResponse } from './interfaces/oauth-token-response.interface';
import type { OAuthClientRepository } from './interfaces/oauth-client-repository.interface';

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
    @Inject(TOOLKIT_OAUTH_CLIENT_REPOSITORY)
    private readonly oauthClientRepository: OAuthClientRepository,
    private readonly jwtService: JwtService,
  ) {}

  async issueToken(request: OAuthTokenRequest): Promise<OAuthTokenResponse> {
    const grantType = request.grant_type;
    if (grantType !== 'client_credentials' && grantType !== 'password') {
      throw new BadRequestException('Unsupported grant_type');
    }

    const client = await this.findClient(request.client_id, request.client_secret);
    const scope = this.resolveScope(client, request.scope);
    const expiresIn = this.options.oauth?.accessTokenExpiresIn ?? '1h';
    const roles = this.resolveRoles(client);

    if (grantType === 'password') {
      if (!request.username || !request.password) {
        throw new BadRequestException('username and password are required for password grant');
      }

      const user = this.findUser(client, request.username, request.password);
      const accessToken = this.jwtService.sign({
        sub: `${client.clientId}:${user.username}`,
        sub_type: 'user',
        client_id: client.clientId,
        username: user.username,
        roles,
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
      sub_type: 'client',
      client_id: client.clientId,
      roles,
      scope,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: parseExpiresInSeconds(expiresIn),
      scope,
    };
  }

  private async findClient(clientId: string, clientSecret: string): Promise<OAuthToolkitClient> {
    const client = await this.oauthClientRepository.findByClientId(clientId);
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

  private resolveRoles(client: OAuthToolkitClient): string[] {
    if (client.roles && client.roles.length > 0) {
      return client.roles;
    }

    return (
      this.options.oauth?.defaultRoles ??
      this.options.security?.defaultRoles ?? ['ROLE_API_CLIENT']
    );
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
