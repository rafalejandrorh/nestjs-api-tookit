import type { Repository } from 'typeorm';
import { SqlAuditRepository } from './sql-audit.repository';
import { AuditLogEntity } from '../entities/audit-log.entity';

describe('SqlAuditRepository', () => {
  it('persists audit logs through typeorm repository', async () => {
    const repository = {
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as Repository<AuditLogEntity>;
    const sqlRepository = new SqlAuditRepository(repository);
    const payload = {
      method: 'POST',
      url: '/api/orders',
      ip: '127.0.0.1',
      requestBody: { orderId: 42 },
      responseStatusCode: 201,
      responseBody: { ok: true },
      durationMs: 12,
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
    };

    await sqlRepository.saveLog(payload);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/api/orders',
        ip: '127.0.0.1',
        requestBody: { orderId: 42 },
        responseStatusCode: 201,
        responseBody: { ok: true },
        durationMs: 12,
        createdAt: payload.timestamp,
      }),
    );
  });
});