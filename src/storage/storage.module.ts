import { DynamicModule, InternalServerErrorException, Module } from '@nestjs/common';
import { RedisModule, RedisService } from '@liaoliaots/nestjs-redis';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_STORAGE_DRIVER } from '../core/tokens';
import { RedisStorageDriver, MemoryStorageDriver } from '../drivers/cache';

@Module({})
export class StorageModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const redisConfig = options.storage.type === 'redis' ? options.storage.config : undefined;
    const redisImports =
      options.storage.type === 'redis'
        ? [RedisModule.forRoot({ config: redisConfig })]
        : [];

    const storageProvider = {
      provide: TOOLKIT_STORAGE_DRIVER,
      useFactory: (redisService?: RedisService) => {
        switch (options.storage.type) {
          case 'redis': {
            const namespace = Array.isArray(redisConfig)
              ? redisConfig[0]?.namespace
              : redisConfig?.namespace;
            const client = namespace
              ? redisService?.getOrThrow(namespace)
              : redisService?.getOrThrow();

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
      inject: options.storage.type === 'redis' ? [RedisService] : [],
    };

    return {
      module: StorageModule,
      imports: [...redisImports],
      providers: [storageProvider],
      exports: [TOOLKIT_STORAGE_DRIVER],
    };
  }
}