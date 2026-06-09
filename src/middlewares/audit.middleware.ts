import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import type { AuditLogPayload, AuditRepository } from '../audit/interfaces/audit-repository.interface';
import { TOOLKIT_AUDIT_REPOSITORY, TOOLKIT_OPTIONS } from '../core/tokens';
import { matchesToolkitRoute } from '../core/utils/route-match.util';

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
        requestBody: req.body, // Asegúrate de censurar passwords/tokens aquí
        responseStatusCode: res.statusCode,
        responseBody: responseBody ? JSON.parse(responseBody) : null,
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