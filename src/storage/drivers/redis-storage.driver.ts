import { StorageDriver } from '../interfaces/storage.driver';

type RedisMulti = {
  incr(key: string): RedisMulti;
  expire(key: string, seconds: number): RedisMulti;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
};

type RedisLikeClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  multi(): RedisMulti;
};

export class RedisStorageDriver implements StorageDriver {
  constructor(private readonly client: RedisLikeClient) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    const multi = this.client.multi();
    multi.incr(key);
    if (ttlSeconds) {
      multi.expire(key, ttlSeconds);
    }
    const results = await multi.exec();
    return results ? (results[0][1] as number) : 1;
  }
}