import { Injectable, NestMiddleware, Inject, Optional } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import type { AuditLogPayload, AuditRepository } from '../interfaces/audit-repository.interface';
import { TOOLKIT_AUDIT_REPOSITORY, TOOLKIT_ENCRYPTOR, TOOLKIT_OPTIONS } from '../../core/tokens';
import { EncryptionAad } from '../../crypto/encryption-aad';
import type { Encryptor } from '../../crypto/encryptor';
import { matchesToolkitRoute } from '../../core/utils/route-match.util';

const SENSITIVE_AUDIT_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'client_secret',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
]);

function getSensitiveAuditKeys(options: ToolkitOptions): Set<string> {
  return new Set([
    ...SENSITIVE_AUDIT_KEYS,
    ...(options.audit?.redactFields?.map(field => field.toLowerCase()) ?? []),
  ]);
}

function sanitizeRequestBody(body: unknown, sensitiveKeys: Set<string>): unknown {
  if (Array.isArray(body)) {
    return body.map(item => sanitizeRequestBody(item, sensitiveKeys));
  }

  if (!body || typeof body !== 'object') {
    return body;
  }

  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      if (sensitiveKeys.has(normalizedKey)) {
        return [key, '[REDACTED]'];
      }

      return [key, sanitizeRequestBody(value, sensitiveKeys)];
    }),
  );
}

function parseResponseBody(body: unknown): unknown {
  if (body == null) {
    return null;
  }

  if (typeof body !== 'string') {
    return body;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function maybeEncryptBody(
  value: unknown,
  encryptor: Encryptor | null | undefined,
  aad: string,
): unknown {
  if (!encryptor || value == null) {
    return value;
  }

  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return encryptor.encrypt(serialized, aad);
}

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(
    @Inject(TOOLKIT_OPTIONS) private options: ToolkitOptions,
    @Inject(TOOLKIT_AUDIT_REPOSITORY) private auditRepo: AuditRepository,
    @Optional() @Inject(TOOLKIT_ENCRYPTOR) private encryptor: Encryptor | null,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.options.audit?.enabled) {
      return next();
    }

    if (!matchesToolkitRoute(req.path, this.options.globalMatch)) {
      return next();
    }

    const start = Date.now();
    const sensitiveKeys = getSensitiveAuditKeys(this.options);

    const originalSend = res.send;
    let responseBody: unknown;

    res.send = function (body) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    res.on('finish', async () => {
      const durationMs = Date.now() - start;
      const sanitizedRequestBody = sanitizeRequestBody(req.body, sensitiveKeys);
      const parsedResponseBody = parseResponseBody(responseBody);

      const logPayload: AuditLogPayload = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        requestBody: maybeEncryptBody(
          sanitizedRequestBody,
          this.encryptor,
          EncryptionAad.AUDIT_REQUEST_BODY,
        ),
        responseStatusCode: res.statusCode,
        responseBody: maybeEncryptBody(
          parsedResponseBody,
          this.encryptor,
          EncryptionAad.AUDIT_RESPONSE_BODY,
        ),
        durationMs,
        timestamp: new Date(),
      };

      this.auditRepo.saveLog(logPayload).catch(err => {
        console.error('Error saving audit log', err);
      });
    });

    next();
  }
}
