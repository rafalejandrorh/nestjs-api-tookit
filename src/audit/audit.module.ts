import { DynamicModule, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_AUDIT_REPOSITORY, TOOLKIT_OPTIONS } from '../core/tokens';
import { NoSqlAuditRepository, SqlAuditRepository } from './repository';
import { AuditMiddleware } from './middlewares/audit.middleware';

@Module({})
export class AuditModule implements NestModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const auditDbProvider = {
      provide: TOOLKIT_AUDIT_REPOSITORY,
      useFactory: () => {
        if (options.audit?.repository === 'nosql') {
          return new NoSqlAuditRepository(options.audit?.config?.connection);
        }

        return new SqlAuditRepository(options.audit?.config?.connection);
      },
    };

    return {
      module: AuditModule,
      providers: [
        { provide: TOOLKIT_OPTIONS, useValue: options },
        auditDbProvider,
        AuditMiddleware,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuditMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}