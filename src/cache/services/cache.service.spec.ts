import type { StorageDriver } from '../../storage/interfaces/storage.driver';
import { CacheService } from './cache.service';

function createStorageDriver(): jest.Mocked<StorageDriver> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    increment: jest.fn(),
  };
}

describe('CacheService', () => {
  it('returns null when the key is not present', async () => {
    const storage = createStorageDriver();
    storage.get.mockResolvedValue(null);
    const service = new CacheService(storage);

    await expect(service.get('orders')).resolves.toBeNull();
  });

  it('parses cached JSON values on get', async () => {
    const storage = createStorageDriver();
    storage.get.mockResolvedValue(JSON.stringify({ orderId: 42 }));
    const service = new CacheService(storage);

    await expect(service.get<{ orderId: number }>('orders')).resolves.toEqual({ orderId: 42 });
  });

  it('serializes values before writing them to storage', async () => {
    const storage = createStorageDriver();
    const service = new CacheService(storage);

    await service.set('orders', { orderId: 42 }, 30);

    expect(storage.set).toHaveBeenCalledWith('orders', JSON.stringify({ orderId: 42 }), 30);
  });

  it('returns the cached value in remember without calling fallback', async () => {
    const storage = createStorageDriver();
    storage.get.mockResolvedValue(JSON.stringify({ orderId: 42 }));
    const service = new CacheService(storage);
    const fallback = jest.fn();

    await expect(service.remember('orders', 30, fallback)).resolves.toEqual({ orderId: 42 });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('calls fallback and stores the fresh value when cache is empty', async () => {
    const storage = createStorageDriver();
    storage.get.mockResolvedValue(null);
    const service = new CacheService(storage);
    const fallback = jest.fn().mockResolvedValue({ orderId: 42 });

    await expect(service.remember('orders', 30, fallback)).resolves.toEqual({ orderId: 42 });
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith('orders', JSON.stringify({ orderId: 42 }), 30);
  });
});