import { Schema } from 'mongoose';

export const AUDIT_LOG_MODEL = 'ApiToolkitAuditLog';

export const AuditLogSchema = new Schema(
  {
    method: { type: String },
    url: { type: String },
    ip: { type: String },
    requestBody: { type: Schema.Types.Mixed },
    responseStatusCode: { type: Number },
    responseBody: { type: Schema.Types.Mixed },
    durationMs: { type: Number },
    timestamp: { type: Date },
  },
  {
    versionKey: false,
    strict: false,
  },
);