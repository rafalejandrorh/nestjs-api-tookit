import { StorageDriver } from '../interfaces/storage.driver';

export class MemoryStorageDriver implements StorageDriver {
  private cache = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiresAt });
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    const current = await this.get(key);
    const newValue = current ? parseInt(current, 10) + 1 : 1;
    await this.set(key, newValue.toString(), ttlSeconds);
    return newValue;
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}