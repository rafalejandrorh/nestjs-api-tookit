import { Schema } from 'mongoose';

export const AUDIT_LOG_MODEL = 'ApiToolkitAuditLog';

export const AuditLogSchema = new Schema(
  {
    method: { type: String },
    url: { type: String },
    ip: { type: String },
    requestHeaders: { type: Schema.Types.Mixed },
    requestBody: { type: Schema.Types.Mixed },
    requestBodyTruncated: { type: Boolean },
    requestSize: { type: Number },
    responseStatusCode: { type: Number },
    responseBody: { type: Schema.Types.Mixed },
    responseBodyTruncated: { type: Boolean },
    responseSize: { type: Number },
    macAddress: { type: String },
    requestId: { type: String },
    durationMs: { type: Number },
    timestamp: { type: Date },
  },
  {
    versionKey: false,
    strict: false,
  },
);
