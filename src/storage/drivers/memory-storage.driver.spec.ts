import { MemoryStorageDriver } from './memory-storage.driver';

describe('MemoryStorageDriver', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null when the key is missing', async () => {
    const driver = new MemoryStorageDriver();

    await expect(driver.get('orders')).resolves.toBeNull();
  });

  it('stores and returns values without ttl', async () => {
    const driver = new MemoryStorageDriver();

    await driver.set('orders', 'value');

    await expect(driver.get('orders')).resolves.toBe('value');
  });

  it('expires values after ttl has passed', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000);
    const driver = new MemoryStorageDriver();

    await driver.set('orders', 'value', 1);

    nowSpy.mockReturnValueOnce(2500);
    await expect(driver.get('orders')).resolves.toBeNull();
  });

  it('increments missing keys from 1', async () => {
    const driver = new MemoryStorageDriver();

    await expect(driver.increment('orders')).resolves.toBe(1);
    await expect(driver.get('orders')).resolves.toBe('1');
  });

  it('increments existing numeric values', async () => {
    const driver = new MemoryStorageDriver();
    await driver.set('orders', '2');

    await expect(driver.increment('orders')).resolves.toBe(3);
    await expect(driver.get('orders')).resolves.toBe('3');
  });
});