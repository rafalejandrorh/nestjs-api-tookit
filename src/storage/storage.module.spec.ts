import { DynamicModule, InternalServerErrorException } from '@nestjs/common';
import { RedisModule, RedisService } from '@liaoliaots/nestjs-redis';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_STORAGE_DRIVER } from '../core/tokens';
import { MemoryStorageDriver } from './drivers/memory-storage.driver';
import { RedisStorageDriver } from './drivers/redis-storage.driver';
import { FilesystemStorageDriver } from './drivers/filesystem-storage.driver';
import { StorageModule } from './storage.module';

type StorageProvider = {
  provide: string;
  useFactory: (redisService?: RedisService) => MemoryStorageDriver | RedisStorageDriver | FilesystemStorageDriver;
  inject: unknown[];
};

function getStorageProvider(dynamicModule: DynamicModule): StorageProvider {
  return dynamicModule.providers?.[0] as StorageProvider;
}

describe('StorageModule', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds a memory storage provider without Redis imports', () => {
    const options: ToolkitOptions = {
      storage: { type: 'memory' },
    };

    const dynamicModule = StorageModule.forRoot(options);
    const storageProvider = getStorageProvider(dynamicModule);

    expect(dynamicModule.imports).toEqual([]);
    expect(dynamicModule.exports).toEqual([TOOLKIT_STORAGE_DRIVER]);
    expect(storageProvider.provide).toBe(TOOLKIT_STORAGE_DRIVER);
    expect(storageProvider.inject).toEqual([]);
    expect(storageProvider.useFactory()).toBeInstanceOf(MemoryStorageDriver);
  });

  it('builds a redis storage provider with RedisModule and namespaced client lookup', () => {
    const redisDynamicModule = { module: class FakeRedisModule {} } as DynamicModule;
    const forRootSpy = jest.spyOn(RedisModule, 'forRoot').mockReturnValue(redisDynamicModule);
    const options: ToolkitOptions = {
      storage: {
        type: 'redis',
        config: { host: 'localhost', namespace: 'toolkit' },
      },
    };
    const client = {
      get: jest.fn(),
      set: jest.fn(),
      multi: jest.fn(),
    };
    const redisService = {
      getOrThrow: jest.fn().mockReturnValue(client),
    } as unknown as RedisService;

    const dynamicModule = StorageModule.forRoot(options);
    const storageProvider = getStorageProvider(dynamicModule);
    const driver = storageProvider.useFactory(redisService);

    expect(forRootSpy).toHaveBeenCalledWith({ config: options.storage.config });
    expect(dynamicModule.imports).toEqual([redisDynamicModule]);
    expect(storageProvider.inject).toEqual([RedisService]);
    expect((redisService.getOrThrow as jest.Mock)).toHaveBeenCalledWith('toolkit');
    expect(driver).toBeInstanceOf(RedisStorageDriver);
  });

  it('uses the default Redis client lookup when no namespace is configured', () => {
    jest.spyOn(RedisModule, 'forRoot').mockReturnValue({ module: class FakeRedisModule {} } as DynamicModule);
    const options: ToolkitOptions = {
      storage: {
        type: 'redis',
        config: { host: 'localhost' },
      },
    };
    const redisService = {
      getOrThrow: jest.fn().mockReturnValue({
        get: jest.fn(),
        set: jest.fn(),
        multi: jest.fn(),
      }),
    } as unknown as RedisService;

    const dynamicModule = StorageModule.forRoot(options);
    const storageProvider = getStorageProvider(dynamicModule);
    storageProvider.useFactory(redisService);

    expect((redisService.getOrThrow as jest.Mock)).toHaveBeenCalledWith();
  });

  it('throws InternalServerErrorException when Redis client resolution fails', () => {
    jest.spyOn(RedisModule, 'forRoot').mockReturnValue({ module: class FakeRedisModule {} } as DynamicModule);
    const options: ToolkitOptions = {
      storage: {
        type: 'redis',
        config: { host: 'localhost', namespace: 'toolkit' },
      },
    };
    const redisService = {
      getOrThrow: jest.fn().mockReturnValue(undefined),
    } as unknown as RedisService;
    const dynamicModule = StorageModule.forRoot(options);
    const storageProvider = getStorageProvider(dynamicModule);

    expect(() => storageProvider.useFactory(redisService)).toThrow(InternalServerErrorException);
  });

  it('builds a filesystem storage provider', () => {
    const options: ToolkitOptions = {
      storage: { type: 'filesystem', config: { directory: '/tmp/toolkit-cache' } },
    };

    const dynamicModule = StorageModule.forRoot(options);
    const storageProvider = getStorageProvider(dynamicModule);
    const driver = storageProvider.useFactory();

    expect(driver).toBeInstanceOf(FilesystemStorageDriver);
  });


});