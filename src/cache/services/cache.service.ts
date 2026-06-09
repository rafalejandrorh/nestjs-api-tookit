import { Injectable, Inject } from '@nestjs/common';
import type { StorageDriver } from '../../storage/interfaces/storage.driver';
import { TOOLKIT_STORAGE_DRIVER } from '../../core/tokens';

function parseCachedValue<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error('Invalid cached JSON payload');
  }
}

@Injectable()
export class CacheService {
  constructor(@Inject(TOOLKIT_STORAGE_DRIVER) private storage: StorageDriver) {}

  async get<T>(key: string): Promise<T | null> {
    const data = await this.storage.get(key);
    return data ? parseCachedValue<T>(data) : null;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    await this.storage.set(key, JSON.stringify(value), ttlSeconds);
  }

  async remember<T>(key: string, ttlSeconds: number, fallback: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) return cached;

    const freshData = await fallback();
    await this.set(key, freshData, ttlSeconds);
    return freshData;
  }
}