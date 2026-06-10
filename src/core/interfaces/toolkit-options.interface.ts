import type { RedisClientOptions } from '@liaoliaots/nestjs-redis';

type RedisStorageConfig = RedisClientOptions | RedisClientOptions[];

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
  };
  hmac?: {
    enabled: boolean;
    secretKey: string;
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
    };
  };
}