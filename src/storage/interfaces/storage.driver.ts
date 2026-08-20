export interface StorageDriver {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  increment(key: string, ttlSeconds?: number): Promise<number>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
