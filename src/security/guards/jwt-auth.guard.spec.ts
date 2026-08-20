import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';

function createJwtService(payload: Record<string, unknown> | Error): JwtService {
  return {
    verify: jest.fn(() => {
      if (payload instanceof Error) {
        throw payload;
      }
      return payload;
    }),
  } as unknown as JwtService;
}

describe('JwtAuthGuard', () => {
  const options: ToolkitOptions = {
    storage: { type: 'memory' },
    globalMatch: { include: ['^/api'] },
    oauth: {
      enabled: true,
      jwtSecret: 'secret',
      defaultRoles: ['ROLE_API_CLIENT'],
    },
  };

  it('allows routes outside globalMatch without a token', () => {
    const guard = new JwtAuthGuard(options, createJwtService({}));
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          path: '/health',
          headers: {},
        }),
      }),
    } as never;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects missing bearer token on matched routes', () => {
    const guard = new JwtAuthGuard(options, createJwtService({}));
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          path: '/api/orders',
          headers: {},
        }),
      }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('attaches authenticated user from a valid token', () => {
    const guard = new JwtAuthGuard(
      options,
      createJwtService({
        sub: 'client-a',
        sub_type: 'client',
        client_id: 'client-a',
        roles: ['ROLE_API_CLIENT'],
        scope: 'read',
      }),
    );
    const request: {
      path: string;
      headers: Record<string, string>;
      user?: unknown;
    } = {
      path: '/api/orders',
      headers: { authorization: 'Bearer valid-token' },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as never;

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual({
      sub: 'client-a',
      clientId: 'client-a',
      roles: ['ROLE_API_CLIENT'],
      scope: 'read',
      subType: 'client',
    });
  });

  it('rejects invalid tokens', () => {
    const guard = new JwtAuthGuard(options, createJwtService(new Error('bad token')));
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          path: '/api/orders',
          headers: { authorization: 'Bearer bad' },
        }),
      }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects tokens without subject', () => {
    const guard = new JwtAuthGuard(options, createJwtService({ client_id: 'client-a' }));
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          path: '/api/orders',
          headers: { authorization: 'Bearer no-sub' },
        }),
      }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
