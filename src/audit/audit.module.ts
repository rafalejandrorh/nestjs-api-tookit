import { DynamicModule, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_AUDIT_REPOSITORY, TOOLKIT_OPTIONS } from '../core/tokens';
import { NoSqlAuditRepository, SqlAuditRepository } from './repository';
import { AuditMiddleware } from './middlewares/audit.middleware';
import { AUDIT_LOG_MODEL, AuditLogSchema } from './schemas/audit-log.schema';

@Module({})
export class AuditModule implements NestModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const useNoSql = options.audit?.repository === 'nosql';
    const mongoConnection = options.audit?.config?.connection;
    const mongoCollection = options.audit?.config?.collection ?? 'audit_logs';
    const imports = useNoSql
      ? [
          MongooseModule.forRoot(mongoConnection ?? ''),
          MongooseModule.forFeature([
            {
              name: AUDIT_LOG_MODEL,
              schema: AuditLogSchema,
              collection: mongoCollection,
            },
          ]),
        ]
      : [];

    const auditDbProvider = useNoSql
      ? {
          provide: TOOLKIT_AUDIT_REPOSITORY,
          useClass: NoSqlAuditRepository,
        }
      : {
          provide: TOOLKIT_AUDIT_REPOSITORY,
          useFactory: () => new SqlAuditRepository(options.audit?.config?.connection),
        };

    return {
      module: AuditModule,
      imports,
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