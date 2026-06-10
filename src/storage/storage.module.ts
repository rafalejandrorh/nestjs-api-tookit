import { DynamicModule, InternalServerErrorException, Module } from '@nestjs/common';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_STORAGE_DRIVER } from '../core/tokens';
import { loadOptionalPeer } from '../core/utils/optional-peer.util';
import { RedisStorageDriver, MemoryStorageDriver } from './drivers';

@Module({})
export class StorageModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const redisConfig = options.storage.type === 'redis' ? options.storage.config : undefined;
    const redisImports: DynamicModule[] = [];
    let redisServiceToken: unknown;

    if (options.storage.type === 'redis') {
      loadOptionalPeer<Record<string, unknown>>('ioredis', 'storage.type="redis"');

      const redisPackage = loadOptionalPeer<Record<string, any>>(
        '@liaoliaots/nestjs-redis',
        'storage.type="redis"',
      );

      redisServiceToken = redisPackage.RedisService;
      redisImports.push(redisPackage.RedisModule.forRoot({ config: redisConfig }));
    }

    const storageProvider = {
      provide: TOOLKIT_STORAGE_DRIVER,
      useFactory: (redisService?: any) => {
        switch (options.storage.type) {
          case 'redis': {
            const namespaceValue = Array.isArray(redisConfig)
              ? (redisConfig[0] as Record<string, unknown> | undefined)?.namespace
              : (redisConfig as Record<string, unknown> | undefined)?.namespace;
            const namespace = typeof namespaceValue === 'string' ? namespaceValue : undefined;

            const clientCandidate = namespace
              ? redisService?.getOrThrow(namespace)
              : redisService?.getOrThrow();

            const client = clientCandidate as any;

            if (!client) {
              throw new InternalServerErrorException('RedisService no disponible para storage redis');
            }

            return new RedisStorageDriver(client);
          }
          case 'memory':
          default:
            return new MemoryStorageDriver();
        }
      },
      inject: (options.storage.type === 'redis' && redisServiceToken ? [redisServiceToken] : []) as unknown[],
    };

    return {
      module: StorageModule,
      imports: [...redisImports],
      providers: [storageProvider as any],
      exports: [TOOLKIT_STORAGE_DRIVER],
    };
  }
}