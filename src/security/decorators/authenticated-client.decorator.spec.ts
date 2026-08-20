import { UnauthorizedException } from '@nestjs/common';
import { TOOLKIT_REQUEST_USER } from '../interfaces/toolkit-auth-user.interface';
import { resolveAuthenticatedClient } from './authenticated-client.decorator';

describe('resolveAuthenticatedClient', () => {
  it('returns the PHP-parity request attribute', () => {
    expect(resolveAuthenticatedClient({ authenticated_oauth_client: { clientId: 'abc' } })).toEqual({
      clientId: 'abc',
    });
  });

  it('falls back to HMAC and JWT attributes', () => {
    expect(resolveAuthenticatedClient({ authenticated_hmac: { signature: 'x' } })).toEqual({
      signature: 'x',
    });
    expect(resolveAuthenticatedClient({ [TOOLKIT_REQUEST_USER]: { sub: 'client' } })).toEqual({
      sub: 'client',
    });
  });

  it('throws when no authenticated principal is present', () => {
    expect(() => resolveAuthenticatedClient({})).toThrow(UnauthorizedException);
  });
});
