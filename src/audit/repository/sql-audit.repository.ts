import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogPayload, AuditRepository } from '../interfaces/audit-repository.interface';
import { AuditLogEntity } from '../entities/audit-log.entity';

@Injectable()
export class SqlAuditRepository implements AuditRepository {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repository: Repository<AuditLogEntity>,
  ) {}

  async saveLog(data: AuditLogPayload): Promise<void> {
    await this.repository.save({
      method: data.method,
      url: data.url,
      ip: data.ip,
      requestHeaders: data.requestHeaders ?? null,
      requestBody: data.requestBody,
      requestBodyTruncated: data.requestBodyTruncated ?? null,
      requestSize: data.requestSize ?? null,
      responseStatusCode: data.responseStatusCode,
      responseBody: data.responseBody,
      responseBodyTruncated: data.responseBodyTruncated ?? null,
      responseSize: data.responseSize ?? null,
      macAddress: data.macAddress ?? null,
      requestId: data.requestId ?? null,
      durationMs: data.durationMs,
      createdAt: data.timestamp,
    });
  }
}
