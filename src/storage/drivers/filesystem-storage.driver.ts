import { mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { StorageDriver } from '../interfaces/storage.driver';

type FilesystemEntry = {
  value: string;
  expiresAt: number | null;
};

export class FilesystemStorageDriver implements StorageDriver {
  constructor(private readonly directory: string) {}

  static defaultDirectory(): string {
    return join(tmpdir(), 'nestjs-api-toolkit-storage');
  }

  private filePath(key: string): string {
    return join(this.directory, `${encodeURIComponent(key)}.json`);
  }

  private async ensureDirectory(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  async get(key: string): Promise<string | null> {
    try {
      const raw = await readFile(this.filePath(key), 'utf8');
      const entry = JSON.parse(raw) as FilesystemEntry;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        await this.delete(key);
        return null;
      }
      return entry.value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.ensureDirectory();
    const entry: FilesystemEntry = {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    };
    await writeFile(this.filePath(key), JSON.stringify(entry), 'utf8');
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    const current = await this.get(key);
    const newValue = current ? parseInt(current, 10) + 1 : 1;
    await this.set(key, newValue.toString(), ttlSeconds);
    return newValue;
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.filePath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async clear(): Promise<void> {
    await rm(this.directory, { recursive: true, force: true });
    await this.ensureDirectory();
  }
}
