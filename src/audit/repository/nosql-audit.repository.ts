import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLogPayload, AuditRepository } from '../interfaces/audit-repository.interface';
import { AUDIT_LOG_MODEL } from '../schemas/audit-log.schema';

@Injectable()
export class NoSqlAuditRepository implements AuditRepository {
    constructor(
        @InjectModel(AUDIT_LOG_MODEL)
        private readonly model: Model<Record<string, unknown>>,
    ) {}

    async saveLog(data: AuditLogPayload): Promise<void> {
        await this.model.create(data as unknown as Record<string, unknown>);
    }
}