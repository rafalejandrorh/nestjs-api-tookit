import { matchesToolkitRoute } from './route-match.util';

describe('matchesToolkitRoute', () => {
  it('returns true when no route matcher is configured', () => {
    expect(matchesToolkitRoute('/api/orders', undefined)).toBe(true);
  });

  it('returns true when path matches an included string pattern', () => {
    expect(
      matchesToolkitRoute('/api/orders', {
        include: ['/api/orders'],
      }),
    ).toBe(true);
  });

  it('returns true when path matches an included regex pattern', () => {
    expect(
      matchesToolkitRoute('/api/orders/123', {
        include: [/^\/api\/orders\/\d+$/],
      }),
    ).toBe(true);
  });

  it('returns false when path does not match any included pattern', () => {
    expect(
      matchesToolkitRoute('/health', {
        include: ['/api/orders', /^\/auth/],
      }),
    ).toBe(false);
  });

  it('returns false when path matches an excluded pattern even if included', () => {
    expect(
      matchesToolkitRoute('/api/orders/private', {
        include: [/^\/api\/orders/],
        exclude: ['/private'],
      }),
    ).toBe(false);
  });
});