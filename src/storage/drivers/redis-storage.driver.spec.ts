import { RedisStorageDriver } from './redis-storage.driver';

function createRedisMulti(execResult: Array<[Error | null, unknown]> | null = [[null, 2]]) {
  return {
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(execResult),
  };
}

function createClient(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    multi: jest.fn(),
    ...overrides,
  };
}

describe('RedisStorageDriver', () => {
  it('delegates get to the redis client', async () => {
    const client = createClient({ get: jest.fn().mockResolvedValue('value') });
    const driver = new RedisStorageDriver(client);

    await expect(driver.get('orders')).resolves.toBe('value');
    expect(client.get).toHaveBeenCalledWith('orders');
  });

  it('writes values without ttl when ttlSeconds is not provided', async () => {
    const client = createClient({ set: jest.fn().mockResolvedValue(undefined) });
    const driver = new RedisStorageDriver(client);

    await driver.set('orders', 'value');

    expect(client.set).toHaveBeenCalledWith('orders', 'value');
  });

  it('writes values with EX ttl when ttlSeconds is provided', async () => {
    const client = createClient({ set: jest.fn().mockResolvedValue(undefined) });
    const driver = new RedisStorageDriver(client);

    await driver.set('orders', 'value', 30);

    expect(client.set).toHaveBeenCalledWith('orders', 'value', 'EX', 30);
  });

  it('increments without expire when ttlSeconds is not provided', async () => {
    const multi = createRedisMulti([[null, 2]]);
    const client = createClient({ multi: jest.fn().mockReturnValue(multi) });
    const driver = new RedisStorageDriver(client);

    await expect(driver.increment('orders')).resolves.toBe(2);
    expect(multi.incr).toHaveBeenCalledWith('orders');
    expect(multi.expire).not.toHaveBeenCalled();
  });

  it('increments and applies expire when ttlSeconds is provided', async () => {
    const multi = createRedisMulti([[null, 3]]);
    const client = createClient({ multi: jest.fn().mockReturnValue(multi) });
    const driver = new RedisStorageDriver(client);

    await expect(driver.increment('orders', 60)).resolves.toBe(3);
    expect(multi.incr).toHaveBeenCalledWith('orders');
    expect(multi.expire).toHaveBeenCalledWith('orders', 60);
  });

  it('falls back to 1 when redis returns no exec result', async () => {
    const multi = createRedisMulti(null);
    const client = createClient({ multi: jest.fn().mockReturnValue(multi) });
    const driver = new RedisStorageDriver(client);

    await expect(driver.increment('orders', 60)).resolves.toBe(1);
  });

  it('deletes a key', async () => {
    const client = createClient({ del: jest.fn().mockResolvedValue(1) });
    const driver = new RedisStorageDriver(client);

    await driver.delete('orders');
    expect(client.del).toHaveBeenCalledWith('orders');
  });

  it('clears matching keys', async () => {
    const client = createClient({
      keys: jest.fn().mockResolvedValue(['a', 'b']),
      del: jest.fn().mockResolvedValue(2),
    });
    const driver = new RedisStorageDriver(client);

    await driver.clear();
    expect(client.keys).toHaveBeenCalledWith('*');
    expect(client.del).toHaveBeenCalledWith('a', 'b');
  });

  it('does not call del when clear finds no keys', async () => {
    const client = createClient({
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn(),
    });
    const driver = new RedisStorageDriver(client);

    await driver.clear();
    expect(client.del).not.toHaveBeenCalled();
  });
});
