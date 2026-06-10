import type { RedisClientOptions } from '@liaoliaots/nestjs-redis';

type RedisStorageConfig = RedisClientOptions | RedisClientOptions[];

export interface OAuthToolkitUser {
  username: string;
  password: string;
  scopes?: string[];
}

export interface OAuthToolkitClient {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  users?: OAuthToolkitUser[];
}

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
    jwtSecret?: string;
    jwtIssuer?: string;
    jwtAlgorithm?: string;
    accessTokenExpiresIn?: number | string;
    clients?: OAuthToolkitClient[];
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
    maxErrors: number;
    windowMs: number;
  };
  audit?: {
    enabled: boolean;
    repository: 'sql' | 'nosql';
    redactFields?: string[];
    config?: {
      connection: string;
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