export interface AuditLogPayload {
  method: string;
  url: string;
  ip: string | undefined;
  requestHeaders?: Record<string, string[] | string> | null;
  requestBody: unknown;
  requestBodyTruncated?: boolean;
  requestSize?: number;
  responseStatusCode: number;
  responseBody: unknown;
  responseBodyTruncated?: boolean;
  responseSize?: number;
  macAddress?: string | null;
  requestId?: string | null;
  durationMs: number;
  timestamp: Date;
}

export interface AuditRepository {
  saveLog(data: AuditLogPayload): Promise<void>;
}
