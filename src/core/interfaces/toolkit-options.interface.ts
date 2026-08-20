type RedisStorageConfig = Record<string, unknown> | Record<string, unknown>[];

export interface OAuthToolkitUser {
  username: string;
  password: string;
  scopes?: string[];
}

export interface OAuthToolkitClient {
  clientId: string;
  clientSecret: string;
  name?: string;
  roles?: string[];
  scopes?: string[];
  users?: OAuthToolkitUser[];
}

export type OAuthRepositoryType = 'options' | 'sql' | 'nosql';

export interface ToolkitOptions {
  globalMatch?: {
    include: (string | RegExp)[];
    exclude?: (string | RegExp)[];
  };
  storage:
    | {
        type: 'redis';
        config?: RedisStorageConfig;
      }
    | {
        type: 'memory' | 'filesystem';
        config?: Record<string, unknown>;
      };
  oauth?: {
    enabled: boolean;
    repository?: OAuthRepositoryType;
    jwtSecret?: string;
    jwtIssuer?: string;
    jwtAlgorithm?: string;
    accessTokenExpiresIn?: number | string;
    defaultRoles?: string[];
    clients?: OAuthToolkitClient[];
    config?: {
      connection?: string;
      collection?: string;
      sqlType?: 'postgres' | 'mysql' | 'mariadb' | 'mssql' | undefined;
      synchronize?: boolean;
    };
  };
  security?: {
    jwtSecret?: string;
    jwtIssuer?: string;
    jwtAlgorithm?: string;
    defaultRoles?: string[];
  };
  encryption?: {
    secret: string;
    legacySecret?: string;
  };
  hmac?: {
    enabled: boolean;
    /** When true (default), registers HmacGuard as APP_GUARD. Set false to wire manually. */
    autoRegisterGuard?: boolean;
    secretKey: string;
    protectedPathPrefix?: string;
    timestampTolerance?: number;
    requestAttributeName?: string;
  };
  http?: {
    contentType?: {
      enabled?: boolean;
      enforceForMethods?: string[];
    };
    exception?: {
      enabled?: boolean;
      includeStack?: boolean;
    };
    responseHeaders?: {
      enabled?: boolean;
      headers?: Record<string, string>;
    };
  };
  errorRateLimit?: {
    enabled: boolean;
    /** When true (default), registers ErrorRateLimitGuard as APP_GUARD. Set false to wire manually. */
    autoRegisterGuard?: boolean;
    maxAttempts404?: number;
    banDurationMs?: number;
    /** @deprecated Prefer maxAttempts404 */
    maxErrors?: number;
    /** @deprecated Prefer banDurationMs */
    windowMs?: number;
  };
  audit?: {
    enabled: boolean;
    repository: 'sql' | 'nosql';
    /** Max bytes of sanitized request body before truncation. Default 8192. */
    requestBodyLimit?: number;
    /** Max bytes of sanitized response body before truncation. Default 8192. */
    responseBodyLimit?: number;
    /** Headers persisted as `***`. Defaults: authorization, cookie, set-cookie, x-api-key. */
    maskedHeaders?: string[];
    /** JSON/form field names to redact (merged with defaults + redactFields). */
    maskedFields?: string[];
    /** Header used for client MAC. Default X-Client-Mac-Address. */
    macAddressHeader?: string;
    /** @deprecated Prefer maskedFields. Merged into the sensitive-field set. */
    redactFields?: string[];
    config?: {
      connection: string | undefined;
      collection?: string;
      sqlType?: 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | 'mssql';
      synchronize?: boolean;
    };
  };
  commands?: {
    oauth?: {
      enabled: boolean;
    };
  };
}
