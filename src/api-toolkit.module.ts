import { DynamicModule, Module, Global, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ToolkitOptions } from './common/interfaces/toolkit-options.interface';
import { RedisStorageDriver, MemoryStorageDriver } from './drivers/cache';
import { CacheService } from './services';
import { NoSqlAuditRepository, SqlAuditRepository } from './audit/repository';
import { AuditMiddleware } from './middlewares/audit.middleware';

@Global()
@Module({})
export class ApiToolkitModule {
  static forRoot(options: ToolkitOptions): DynamicModule {

    // Proveedor dinámico para el almacenamiento
    const storageProvider = {
      provide: 'TOOLKIT_STORAGE_DRIVER',
      useFactory: () => {
        switch (options.storage.type) {
          case 'redis':
            return new RedisStorageDriver(options.storage.config);
          case 'memory':
          default:
            return new MemoryStorageDriver(); 
        }
      },
    };

    const auditDbProvider = {
      provide: 'TOOLKIT_AUDIT_REPOSITORY',
      useFactory: () => {
        if (options.audit?.repository === 'nosql') {
          return new NoSqlAuditRepository(options.audit?.config?.connection);
        }
        return new SqlAuditRepository(options.audit?.config?.connection);
      },
    };

    return {
      module: ApiToolkitModule,
      providers: [
        { provide: 'TOOLKIT_OPTIONS', useValue: options },
        storageProvider,
        auditDbProvider,
        CacheService,
        // Aquí registraremos los Guards e Interceptors
      ],
      exports: ['TOOLKIT_OPTIONS', 'TOOLKIT_STORAGE_DRIVER', CacheService], // Exportamos para que otros servicios lo lean si es necesario
    };
  }

  // Aplicar el Middleware de auditoría a las rutas
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuditMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL }); 
      // Nota: El middleware en sí mismo puede tener la lógica de isRouteMatching para decidir si audita o no
  }
}