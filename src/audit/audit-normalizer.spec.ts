import {
  DEFAULT_MAC_ADDRESS_HEADER,
  DEFAULT_MASKED_HEADERS,
  FIELD_MASK,
  HEADER_MASK,
  normalizeBody,
  normalizeHeaders,
  resolveAuditNormalizerConfig,
} from './audit-normalizer';

describe('audit-normalizer', () => {
  it('resolves defaults for limits, headers, fields and MAC header', () => {
    const config = resolveAuditNormalizerConfig({});

    expect(config.requestBodyLimit).toBe(8192);
    expect(config.responseBodyLimit).toBe(8192);
    expect(config.macAddressHeader).toBe(DEFAULT_MAC_ADDRESS_HEADER);
    for (const header of DEFAULT_MASKED_HEADERS) {
      expect(config.maskedHeaders.has(header)).toBe(true);
    }
    expect(config.maskedFields.has('password')).toBe(true);
  });

  it('merges maskedFields and legacy redactFields', () => {
    const config = resolveAuditNormalizerConfig({
      maskedFields: ['ssn'],
      redactFields: ['creditCard'],
    });

    expect(config.maskedFields.has('ssn')).toBe(true);
    expect(config.maskedFields.has('creditcard')).toBe(true);
  });

  it('masks configured headers as ***', () => {
    const config = resolveAuditNormalizerConfig({});
    const headers = normalizeHeaders(
      {
        Authorization: 'Bearer secret',
        'X-Request-Id': 'req-1',
        'Content-Type': 'application/json',
      },
      config.maskedHeaders,
    );

    expect(headers.authorization).toEqual([HEADER_MASK]);
    expect(headers['x-request-id']).toEqual(['req-1']);
    expect(headers['content-type']).toEqual(['application/json']);
  });

  it('masks sensitive fields and truncates oversized bodies', () => {
    const config = resolveAuditNormalizerConfig({ requestBodyLimit: 40 });
    const normalized = normalizeBody(
      'application/json',
      { email: 'a@b.com', password: 'secret', note: 'x'.repeat(100) },
      config.requestBodyLimit,
      config.maskedFields,
    );

    expect(normalized.truncated).toBe(true);
    expect(normalized.size).toBeGreaterThan(40);
    if (typeof normalized.body === 'string') {
      expect(normalized.body.length).toBe(40);
    } else {
      expect(JSON.stringify(normalized.body).length).toBeLessThanOrEqual(40);
    }
  });

  it('redacts nested sensitive fields without truncation under limit', () => {
    const config = resolveAuditNormalizerConfig({ requestBodyLimit: 8192 });
    const normalized = normalizeBody(
      'application/json',
      {
        email: 'user@example.com',
        password: 'plain-secret',
        nested: { token: 'abc123', profile: { name: 'Rafael' } },
      },
      config.requestBodyLimit,
      config.maskedFields,
    );

    expect(normalized.truncated).toBe(false);
    expect(normalized.body).toEqual({
      email: 'user@example.com',
      password: FIELD_MASK,
      nested: {
        token: FIELD_MASK,
        profile: { name: 'Rafael' },
      },
    });
  });

  it('skips non-auditable content types but reports size', () => {
    const config = resolveAuditNormalizerConfig({});
    const binary = Buffer.alloc(16).toString('base64');
    const normalized = normalizeBody(
      'application/octet-stream',
      binary,
      config.requestBodyLimit,
      config.maskedFields,
    );

    expect(normalized.body).toBeNull();
    expect(normalized.truncated).toBe(false);
    expect(normalized.size).toBe(Buffer.byteLength(binary, 'utf8'));
  });
});
