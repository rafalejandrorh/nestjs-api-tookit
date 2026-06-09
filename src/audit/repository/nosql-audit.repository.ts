import { AuditLogPayload, AuditRepository } from "../interfaces/audit-repository.interface";

export class NoSqlAuditRepository implements AuditRepository {
  
    constructor(private readonly collection: any) {}
  
    async saveLog(data: AuditLogPayload): Promise<void> {
        await this.collection.insertOne(data);
    }
}