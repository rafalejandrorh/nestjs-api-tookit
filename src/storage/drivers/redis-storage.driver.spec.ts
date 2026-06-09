import { RedisStorageDriver } from './redis-storage.driver';

function createRedisMulti(execResult: Array<[Error | null, unknown]> | null = [[null, 2]]) {
  return {
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(execResult),
  };
}

describe('RedisStorageDriver', () => {
  it('delegates get to the redis client', async () => {
    const client = {
      get: jest.fn().mockResolvedValue('value'),
      set: jest.fn(),
      multi: jest.fn(),
    };
    const driver = new RedisStorageDriver(client);

    await expect(driver.get('orders')).resolves.toBe('value');
    expect(client.get).toHaveBeenCalledWith('orders');
  });

  it('writes values without ttl when ttlSeconds is not provided', async () => {
    const client = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      multi: jest.fn(),
    };
    const driver = new RedisStorageDriver(client);

    await driver.set('orders', 'value');

    expect(client.set).toHaveBeenCalledWith('orders', 'value');
  });

  it('writes values with EX ttl when ttlSeconds is provided', async () => {
    const client = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      multi: jest.fn(),
    };
    const driver = new RedisStorageDriver(client);

    await driver.set('orders', 'value', 30);

    expect(client.set).toHaveBeenCalledWith('orders', 'value', 'EX', 30);
  });

  it('increments without expire when ttlSeconds is not provided', async () => {
    const multi = createRedisMulti([[null, 2]]);
    const client = {
      get: jest.fn(),
      set: jest.fn(),
      multi: jest.fn().mockReturnValue(multi),
    };
    const driver = new RedisStorageDriver(client);

    await expect(driver.increment('orders')).resolves.toBe(2);
    expect(multi.incr).toHaveBeenCalledWith('orders');
    expect(multi.expire).not.toHaveBeenCalled();
  });

  it('increments and applies expire when ttlSeconds is provided', async () => {
    const multi = createRedisMulti([[null, 3]]);
    const client = {
      get: jest.fn(),
      set: jest.fn(),
      multi: jest.fn().mockReturnValue(multi),
    };
    const driver = new RedisStorageDriver(client);

    await expect(driver.increment('orders', 60)).resolves.toBe(3);
    expect(multi.incr).toHaveBeenCalledWith('orders');
    expect(multi.expire).toHaveBeenCalledWith('orders', 60);
  });

  it('falls back to 1 when redis returns no exec result', async () => {
    const multi = createRedisMulti(null);
    const client = {
      get: jest.fn(),
      set: jest.fn(),
      multi: jest.fn().mockReturnValue(multi),
    };
    const driver = new RedisStorageDriver(client);

    await expect(driver.increment('orders', 60)).resolves.toBe(1);
  });
});