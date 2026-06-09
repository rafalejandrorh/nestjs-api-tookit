// toolkit-options.interface.ts
import type { RedisClientOptions } from '@liaoliaots/nestjs-redis';

type RedisStorageConfig = RedisClientOptions | RedisClientOptions[];

export interface ToolkitOptions {
  globalMatch?: {
    include: (string | RegExp)[]; // Ej: ['/api/v1/.*', '/auth/.*']
    exclude?: (string | RegExp)[]; // Ej: ['/api/v1/public/.*']
  };
  storage:
    | { type: 'redis';
        config?: RedisStorageConfig;
      }
    | {
        type: 'memory' | 'filesystem';
        config?: Record<string, unknown>;
      };
  oauth?: {
    enabled: boolean;
    // URL del authorization server, scopes, etc.
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
    config?: {
      connection: string; // Configuración de conexión para la base de datos
    }; // Configuración específica para cada tipo de repositorio
  };
}