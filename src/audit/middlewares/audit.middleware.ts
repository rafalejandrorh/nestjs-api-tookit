import { Injectable, NestMiddleware, Inject, Optional } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import type { AuditLogPayload, AuditRepository } from '../interfaces/audit-repository.interface';
import { TOOLKIT_AUDIT_REPOSITORY, TOOLKIT_ENCRYPTOR, TOOLKIT_OPTIONS } from '../../core/tokens';
import { EncryptionAad } from '../../crypto/encryption-aad';
import type { Encryptor } from '../../crypto/encryptor';
import { matchesToolkitRoute } from '../../core/utils/route-match.util';
import {
  normalizeBody,
  normalizeHeaders,
  readHeader,
  resolveAuditNormalizerConfig,
} from '../audit-normalizer';

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
    const normalizer = resolveAuditNormalizerConfig(this.options.audit);
    const requestContentType = readHeader(req.headers as Record<string, unknown>, 'content-type');
    const requestNormalized = normalizeBody(
      requestContentType,
      req.body,
      normalizer.requestBodyLimit,
      normalizer.maskedFields,
    );
    const requestHeaders = normalizeHeaders(
      req.headers as Record<string, unknown>,
      normalizer.maskedHeaders,
    );
    const macAddress =
      readHeader(req.headers as Record<string, unknown>, normalizer.macAddressHeader) ?? null;
    const requestId =
      readHeader(req.headers as Record<string, unknown>, 'x-request-id') ??
      readHeader(req.headers as Record<string, unknown>, 'x-correlation-id') ??
      null;

    const originalSend = res.send;
    let responseBody: unknown;

    res.send = function (body) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    res.on('finish', async () => {
      const durationMs = Date.now() - start;
      const responseContentType =
        typeof res.getHeader === 'function'
          ? String(res.getHeader('content-type') ?? '')
          : undefined;
      const responseNormalized = normalizeBody(
        responseContentType || undefined,
        responseBody,
        normalizer.responseBodyLimit,
        normalizer.maskedFields,
      );

      const logPayload: AuditLogPayload = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        requestHeaders,
        requestBody: maybeEncryptBody(
          requestNormalized.body,
          this.encryptor,
          EncryptionAad.AUDIT_REQUEST_BODY,
        ),
        requestBodyTruncated: requestNormalized.truncated,
        requestSize: requestNormalized.size,
        responseStatusCode: res.statusCode,
        responseBody: maybeEncryptBody(
          responseNormalized.body,
          this.encryptor,
          EncryptionAad.AUDIT_RESPONSE_BODY,
        ),
        responseBodyTruncated: responseNormalized.truncated,
        responseSize: responseNormalized.size,
        macAddress,
        requestId,
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
