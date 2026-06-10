import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import type { AuditLogPayload, AuditRepository } from '../interfaces/audit-repository.interface';
import { TOOLKIT_AUDIT_REPOSITORY, TOOLKIT_OPTIONS } from '../../core/tokens';
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

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(
    @Inject(TOOLKIT_OPTIONS) private options: ToolkitOptions,
    @Inject(TOOLKIT_AUDIT_REPOSITORY) private auditRepo: AuditRepository,
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

    // Interceptar el body de la respuesta es truculento en Express/Nest.
    // Sobrescribimos temporalmente res.send para capturar el payload.
    const originalSend = res.send;
    let responseBody: any;

    res.send = function (body) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    res.on('finish', async () => {
      const durationMs = Date.now() - start;

      const logPayload: AuditLogPayload = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        requestBody: sanitizeRequestBody(req.body, sensitiveKeys),
        responseStatusCode: res.statusCode,
        responseBody: parseResponseBody(responseBody),
        durationMs,
        timestamp: new Date(),
      };

      // Disparamos el guardado de forma asíncrona para no bloquear el hilo
      this.auditRepo.saveLog(logPayload).catch(err => {
        console.error('Error saving audit log', err);
      });
    });

    next();
  }
}