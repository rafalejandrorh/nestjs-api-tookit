import type { Model } from 'mongoose';
import { NoSqlAuditRepository } from './nosql-audit.repository';

describe('NoSqlAuditRepository', () => {
  it('persists logs using mongoose model create', async () => {
    const model = {
      create: jest.fn().mockResolvedValue(undefined),
    } as unknown as Model<Record<string, unknown>>;
    const repository = new NoSqlAuditRepository(model);
    const payload = {
      method: 'POST',
      url: '/api/orders',
      ip: '127.0.0.1',
      requestBody: { orderId: 42 },
      responseStatusCode: 201,
      responseBody: { ok: true },
      durationMs: 12,
      timestamp: new Date(),
    };
    await repository.saveLog(payload);
    expect(model.create).toHaveBeenCalledWith(payload);
  });
});