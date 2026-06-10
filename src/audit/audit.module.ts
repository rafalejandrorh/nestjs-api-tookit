import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  Provider,
  RequestMethod,
} from '@nestjs/common';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_AUDIT_REPOSITORY, TOOLKIT_OPTIONS } from '../core/tokens';
import { loadOptionalPeer } from '../core/utils/optional-peer.util';
import { AuditMiddleware } from './middlewares/audit.middleware';

type MongooseModuleLike = {
  forRoot(connection: string): DynamicModule;
  forFeature(models: Array<Record<string, unknown>>): DynamicModule;
};

type TypeOrmModuleLike = {
  forRoot(config: Record<string, unknown>): DynamicModule;
  forFeature(entities: unknown[]): DynamicModule;
};

@Module({})
export class AuditModule implements NestModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const useNoSql = options.audit?.repository === 'nosql';
    const useSql = options.audit?.repository === 'sql';
    const imports: DynamicModule[] = [];
    let auditDbProvider: Provider;

    if (useNoSql) {
      const mongoConnection = options.audit?.config?.connection;
      const mongoCollection = options.audit?.config?.collection ?? 'audit_logs';

      if (!mongoConnection) {
        throw new Error('audit.config.connection is required when audit.repository is nosql');
      }

      loadOptionalPeer<Record<string, unknown>>('mongoose', 'audit.repository="nosql"');
      const { MongooseModule } = loadOptionalPeer<{ MongooseModule: MongooseModuleLike }>(
        '@nestjs/mongoose',
        'audit.repository="nosql"',
      );
      const { NoSqlAuditRepository } = require('./repository/nosql-audit.repository') as {
        NoSqlAuditRepository: new (...args: unknown[]) => unknown;
      };
      const { AUDIT_LOG_MODEL, AuditLogSchema } = require('./schemas/audit-log.schema') as {
        AUDIT_LOG_MODEL: string;
        AuditLogSchema: unknown;
      };

      imports.push(
        MongooseModule.forRoot(mongoConnection),
        MongooseModule.forFeature([
          {
            name: AUDIT_LOG_MODEL,
            schema: AuditLogSchema,
            collection: mongoCollection,
          },
        ]),
      );

      auditDbProvider = {
        provide: TOOLKIT_AUDIT_REPOSITORY,
        useClass: NoSqlAuditRepository,
      };
    } else if (useSql) {
      const sqlSynchronize = options.audit?.config?.synchronize ?? false;
      const sqlConnection = options.audit?.config?.connection;
      const sqlType = options.audit?.config?.sqlType === 'sqlite'
        ? 'postgres'
        : (options.audit?.config?.sqlType ?? 'postgres');
        
      if (!sqlConnection) {
        throw new Error('audit.config.connection is required when audit.repository is sql');
      }

      loadOptionalPeer<Record<string, unknown>>('typeorm', 'audit.repository="sql"');
      if (sqlType === 'postgres') {
        loadOptionalPeer<Record<string, unknown>>('pg', 'audit.repository="sql" with sqlType="postgres"');
      }

      const { TypeOrmModule } = loadOptionalPeer<{ TypeOrmModule: TypeOrmModuleLike }>(
        '@nestjs/typeorm',
        'audit.repository="sql"',
      );
      const { SqlAuditRepository } = require('./repository/sql-audit.repository') as {
        SqlAuditRepository: new (...args: unknown[]) => unknown;
      };
      const { AuditLogEntity } = require('./entities/audit-log.entity') as {
        AuditLogEntity: new (...args: unknown[]) => unknown;
      };

      imports.push(
        TypeOrmModule.forRoot({
          type: sqlType,
          url: sqlConnection,
          entities: [AuditLogEntity],
          synchronize: sqlSynchronize,
        }),
        TypeOrmModule.forFeature([AuditLogEntity]),
      );

      auditDbProvider = {
        provide: TOOLKIT_AUDIT_REPOSITORY,
        useClass: SqlAuditRepository,
      };
    } else {
      throw new Error('audit.repository must be "sql" or "nosql"');
    }

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