export interface AuditLogPayload {
  method: string;
  url: string;
  ip: string | undefined;
  requestBody: any;
  responseStatusCode: number;
  responseBody: any;
  durationMs: number;
  timestamp: Date;
}

export interface AuditRepository {
  saveLog(data: AuditLogPayload): Promise<void>;
}