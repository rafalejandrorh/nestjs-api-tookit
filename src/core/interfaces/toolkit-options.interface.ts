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
