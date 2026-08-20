export const DEFAULT_REQUEST_BODY_LIMIT = 8192;
export const DEFAULT_RESPONSE_BODY_LIMIT = 8192;
export const DEFAULT_MAC_ADDRESS_HEADER = 'X-Client-Mac-Address';
export const HEADER_MASK = '***';
export const FIELD_MASK = '[REDACTED]';

export const DEFAULT_MASKED_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
];

export const DEFAULT_MASKED_FIELDS = [
  'password',
  'passwd',
  'pwd',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'client_secret',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
];

export type NormalizedBody = {
  body: unknown;
  truncated: boolean;
  size: number;
};

export type AuditNormalizerConfig = {
  requestBodyLimit: number;
  responseBodyLimit: number;
  maskedHeaders: Set<string>;
  maskedFields: Set<string>;
  macAddressHeader: string;
};

export function resolveAuditNormalizerConfig(options: {
  requestBodyLimit?: number;
  responseBodyLimit?: number;
  maskedHeaders?: string[];
  maskedFields?: string[];
  redactFields?: string[];
  macAddressHeader?: string;
}): AuditNormalizerConfig {
  return {
    requestBodyLimit: options.requestBodyLimit ?? DEFAULT_REQUEST_BODY_LIMIT,
    responseBodyLimit: options.responseBodyLimit ?? DEFAULT_RESPONSE_BODY_LIMIT,
    maskedHeaders: new Set(
      (options.maskedHeaders ?? DEFAULT_MASKED_HEADERS).map(header => header.toLowerCase()),
    ),
    maskedFields: new Set([
      ...DEFAULT_MASKED_FIELDS,
      ...(options.maskedFields?.map(field => field.toLowerCase()) ?? []),
      ...(options.redactFields?.map(field => field.toLowerCase()) ?? []),
    ]),
    macAddressHeader: options.macAddressHeader ?? DEFAULT_MAC_ADDRESS_HEADER,
  };
}

export function normalizeHeaders(
  headers: Record<string, unknown> | undefined,
  maskedHeaders: Set<string>,
): Record<string, string[] | string> {
  const normalized: Record<string, string[] | string> = {};
  if (!headers) {
    return normalized;
  }

  for (const [name, value] of Object.entries(headers)) {
    const headerName = name.toLowerCase();
    if (maskedHeaders.has(headerName)) {
      normalized[headerName] = [HEADER_MASK];
      continue;
    }

    if (Array.isArray(value)) {
      normalized[headerName] = value.map(item => String(item));
    } else if (value == null) {
      normalized[headerName] = [];
    } else {
      normalized[headerName] = [String(value)];
    }
  }

  return Object.fromEntries(Object.entries(normalized).sort(([left], [right]) => left.localeCompare(right)));
}

export function maskStructuredData(data: unknown, maskedFields: Set<string>, key?: string): unknown {
  if (key !== undefined && maskedFields.has(key.toLowerCase())) {
    return FIELD_MASK;
  }

  if (Array.isArray(data)) {
    return data.map(item => maskStructuredData(item, maskedFields));
  }

  if (!data || typeof data !== 'object') {
    return data;
  }

  return Object.fromEntries(
    Object.entries(data).map(([entryKey, value]) => [
      entryKey,
      maskStructuredData(value, maskedFields, entryKey),
    ]),
  );
}

function serializeBody(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

function truncateSerialized(serialized: string, limit: number): { body: unknown; truncated: boolean } {
  if (serialized.length <= limit) {
    try {
      return { body: JSON.parse(serialized), truncated: false };
    } catch {
      return { body: serialized, truncated: false };
    }
  }

  const truncated = serialized.slice(0, limit);
  try {
    return { body: JSON.parse(truncated), truncated: true };
  } catch {
    return { body: truncated, truncated: true };
  }
}

export function normalizeBody(
  contentType: string | undefined,
  rawBody: unknown,
  limit: number,
  maskedFields: Set<string>,
): NormalizedBody {
  const contentTypeBase = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  const sizeHint =
    typeof rawBody === 'string'
      ? Buffer.byteLength(rawBody, 'utf8')
      : Buffer.byteLength(serializeBody(rawBody), 'utf8');

  if (rawBody == null || rawBody === '') {
    return { body: null, truncated: false, size: 0 };
  }

  if (contentTypeBase && !isAuditableContentType(contentTypeBase)) {
    return { body: null, truncated: false, size: sizeHint };
  }

  let sanitized: unknown = rawBody;

  if (typeof rawBody === 'string') {
    if (contentTypeBase === 'application/json' || contentTypeBase.endsWith('+json') || contentTypeBase === '') {
      try {
        sanitized = maskStructuredData(JSON.parse(rawBody), maskedFields);
      } catch {
        sanitized = rawBody;
      }
    } else if (contentTypeBase === 'application/x-www-form-urlencoded') {
      const params = new URLSearchParams(rawBody);
      const parsed: Record<string, string> = {};
      for (const [key, value] of params.entries()) {
        parsed[key] = value;
      }
      sanitized = maskStructuredData(parsed, maskedFields);
    } else {
      sanitized = rawBody;
    }
  } else {
    sanitized = maskStructuredData(rawBody, maskedFields);
  }

  if (sanitized == null || sanitized === '') {
    return { body: null, truncated: false, size: sizeHint };
  }

  const serialized = serializeBody(sanitized);
  const size = Buffer.byteLength(serialized, 'utf8');
  const { body, truncated } = truncateSerialized(serialized, limit);

  return { body, truncated, size };
}

function isAuditableContentType(contentType: string): boolean {
  if (contentType === 'application/json' || contentType.endsWith('+json')) {
    return true;
  }
  if (
    contentType === 'application/xml' ||
    contentType === 'text/xml' ||
    contentType === 'application/x-www-form-urlencoded'
  ) {
    return true;
  }
  return contentType.startsWith('text/');
}

export function readHeader(
  headers: Record<string, unknown> | undefined,
  headerName: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }

  const direct = headers[headerName] ?? headers[headerName.toLowerCase()];
  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }
  if (Array.isArray(direct) && typeof direct[0] === 'string') {
    return direct[0];
  }

  return undefined;
}
