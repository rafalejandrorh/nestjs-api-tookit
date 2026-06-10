import { DynamicModule, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_AUDIT_REPOSITORY, TOOLKIT_OPTIONS } from '../core/tokens';
import { NoSqlAuditRepository, SqlAuditRepository } from './repository';
import { AuditMiddleware } from './middlewares/audit.middleware';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AUDIT_LOG_MODEL, AuditLogSchema } from './schemas/audit-log.schema';

@Module({})
export class AuditModule implements NestModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const useNoSql = options.audit?.repository === 'nosql';
    const useSql = options.audit?.repository === 'sql';
    const mongoConnection = options.audit?.config?.connection;
    const mongoCollection = options.audit?.config?.collection ?? 'audit_logs';
    const sqlConnection = options.audit?.config?.connection;
    const sqlType = options.audit?.config?.sqlType ?? 'postgres';
    const sqlSynchronize = options.audit?.config?.synchronize ?? false;
    const imports = [
      ...(useNoSql
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
        : []),
      ...(useSql
        ? [
            TypeOrmModule.forRoot({
              type: sqlType,
              url: sqlConnection,
              entities: [AuditLogEntity],
              synchronize: sqlSynchronize,
            }),
            TypeOrmModule.forFeature([AuditLogEntity]),
          ]
        : []),
    ];

    const auditDbProvider = useNoSql
      ? {
          provide: TOOLKIT_AUDIT_REPOSITORY,
          useClass: NoSqlAuditRepository,
        }
      : {
          provide: TOOLKIT_AUDIT_REPOSITORY,
          useClass: SqlAuditRepository,
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