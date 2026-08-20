import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FilesystemStorageDriver } from './filesystem-storage.driver';

describe('FilesystemStorageDriver', () => {
  let directory: string;
  let driver: FilesystemStorageDriver;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'toolkit-fs-'));
    driver = new FilesystemStorageDriver(directory);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('returns null when the key is missing', async () => {
    await expect(driver.get('orders')).resolves.toBeNull();
  });

  it('stores and returns values', async () => {
    await driver.set('orders', 'value');
    await expect(driver.get('orders')).resolves.toBe('value');
  });

  it('expires values after ttl has passed', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);
    await driver.set('orders', 'value', 1);
    nowSpy.mockReturnValue(2500);
    await expect(driver.get('orders')).resolves.toBeNull();
    nowSpy.mockRestore();
  });

  it('increments and deletes keys', async () => {
    await expect(driver.increment('counter')).resolves.toBe(1);
    await expect(driver.increment('counter')).resolves.toBe(2);
    await driver.delete('counter');
    await expect(driver.get('counter')).resolves.toBeNull();
  });

  it('clears all keys in the directory', async () => {
    await driver.set('a', '1');
    await driver.set('b', '2');
    await driver.clear();
    await expect(driver.get('a')).resolves.toBeNull();
    await expect(driver.get('b')).resolves.toBeNull();
  });
});
