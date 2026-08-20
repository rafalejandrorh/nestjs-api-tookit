import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import type { JwtService } from '@nestjs/jwt';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import type { OAuthClientRepository } from './interfaces/oauth-client-repository.interface';

function createJwtService(): jest.Mocked<JwtService> {
  return {
    sign: jest.fn().mockReturnValue('signed-token'),
  } as unknown as jest.Mocked<JwtService>;
}

describe('OAuthService', () => {
  const baseOptions: ToolkitOptions = {
    storage: { type: 'memory' },
    oauth: {
      enabled: true,
      jwtSecret: 'secret',
      accessTokenExpiresIn: '1h',
      clients: [
        {
          clientId: 'client-a',
          clientSecret: 'client-secret',
          scopes: ['read', 'write'],
          users: [
            {
              username: 'alice',
              password: 'alice-password',
            },
          ],
        },
      ],
    },
  };

  function createRepository(): jest.Mocked<OAuthClientRepository> {
    return {
      findByClientId: jest.fn(async (clientId: string) =>
        baseOptions.oauth?.clients?.find(item => item.clientId === clientId) ?? null,
      ),
    };
  }

  it('issues a token for client_credentials grant', () => {
    const jwtService = createJwtService();
    const service = new OAuthService(baseOptions, createRepository(), jwtService);

    return service.issueToken({
      grant_type: 'client_credentials',
      client_id: 'client-a',
      client_secret: 'client-secret',
      scope: 'read',
    }).then(response => {
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 'client-a',
          sub_type: 'client',
          roles: ['ROLE_API_CLIENT'],
          scope: 'read',
        }),
      );
      expect(response).toEqual(
        expect.objectContaining({
          access_token: 'signed-token',
          token_type: 'Bearer',
          scope: 'read',
        }),
      );
    });
  });

  it('issues a token for password grant', () => {
    const jwtService = createJwtService();
    const service = new OAuthService(baseOptions, createRepository(), jwtService);

    return service.issueToken({
      grant_type: 'password',
      client_id: 'client-a',
      client_secret: 'client-secret',
      username: 'alice',
      password: 'alice-password',
    }).then(response => {
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 'client-a',
          username: 'alice',
          sub_type: 'user',
          roles: ['ROLE_API_CLIENT'],
        }),
      );
      expect(response.access_token).toBe('signed-token');
    });
  });

  it('rejects invalid client credentials', () => {
    const service = new OAuthService(baseOptions, createRepository(), createJwtService());

    return expect(
      service.issueToken({
        grant_type: 'client_credentials',
        client_id: 'client-a',
        client_secret: 'invalid',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects password grant without resource owner credentials', () => {
    const service = new OAuthService(baseOptions, createRepository(), createJwtService());

    return expect(
      service.issueToken({
        grant_type: 'password',
        client_id: 'client-a',
        client_secret: 'client-secret',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid scope', () => {
    const service = new OAuthService(baseOptions, createRepository(), createJwtService());

    return expect(
      service.issueToken({
        grant_type: 'client_credentials',
        client_id: 'client-a',
        client_secret: 'client-secret',
        scope: 'admin',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});