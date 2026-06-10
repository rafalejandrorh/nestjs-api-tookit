import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { OAuthService } from './oauth.service';

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

  it('issues a token for client_credentials grant', () => {
    const jwtService = createJwtService();
    const service = new OAuthService(baseOptions, jwtService);

    const response = service.issueToken({
      grant_type: 'client_credentials',
      client_id: 'client-a',
      client_secret: 'client-secret',
      scope: 'read',
    });

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'client-a',
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

  it('issues a token for password grant', () => {
    const jwtService = createJwtService();
    const service = new OAuthService(baseOptions, jwtService);

    const response = service.issueToken({
      grant_type: 'password',
      client_id: 'client-a',
      client_secret: 'client-secret',
      username: 'alice',
      password: 'alice-password',
    });

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'client-a',
        username: 'alice',
      }),
    );
    expect(response.access_token).toBe('signed-token');
  });

  it('rejects invalid client credentials', () => {
    const service = new OAuthService(baseOptions, createJwtService());

    expect(() =>
      service.issueToken({
        grant_type: 'client_credentials',
        client_id: 'client-a',
        client_secret: 'invalid',
      }),
    ).toThrow(UnauthorizedException);
  });

  it('rejects password grant without resource owner credentials', () => {
    const service = new OAuthService(baseOptions, createJwtService());

    expect(() =>
      service.issueToken({
        grant_type: 'password',
        client_id: 'client-a',
        client_secret: 'client-secret',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid scope', () => {
    const service = new OAuthService(baseOptions, createJwtService());

    expect(() =>
      service.issueToken({
        grant_type: 'client_credentials',
        client_id: 'client-a',
        client_secret: 'client-secret',
        scope: 'admin',
      }),
    ).toThrow(BadRequestException);
  });
});