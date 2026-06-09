import { AuditLogPayload, AuditRepository } from "../interfaces/audit-repository.interface";

export class SqlAuditRepository implements AuditRepository {
  
    constructor(private readonly dbConnection: any) {}
  
  async saveLog(data: AuditLogPayload): Promise<void> {
    await this.dbConnection.query(
      'INSERT INTO audit_logs (method, url, request, response, status, duration) VALUES (...)',
      // ... mapeo de datos
    );
  }
}