// redis-storage.driver.ts
import { StorageDriver } from '../interfaces/storage.driver';
import { Redis } from 'ioredis'; // o la librería que prefieras

export class RedisStorageDriver implements StorageDriver {
  private client: Redis;

  constructor(config: any) {
    this.client = new Redis(config);
  }

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