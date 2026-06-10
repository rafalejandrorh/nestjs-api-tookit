import { DynamicModule, Global, Module } from '@nestjs/common';
import type { ToolkitOptions } from './core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS, TOOLKIT_STORAGE_DRIVER } from './core/tokens';
import { StorageModule } from './storage/storage.module';
import { AuditModule } from './audit/audit.module';
import { CacheModule } from './cache/cache.module';
import { SecurityModule } from './security/security.module';
import { OAuthModule } from './oauth/oauth.module';
import { HttpModule } from './http/http.module';

@Global()
@Module({})
export class ApiToolkitModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const oauthImports = options.oauth?.enabled ? [OAuthModule.forRoot(options)] : [];

    return {
      module: ApiToolkitModule,
      imports: [
        HttpModule.forRoot(options),
        StorageModule.forRoot(options),
        SecurityModule.forRoot(options),
        AuditModule.forRoot(options),
        CacheModule,
        ...oauthImports,
      ],
      providers: [
        { provide: TOOLKIT_OPTIONS, useValue: options },
        // Aquí registraremos los Guards e Interceptors
      ],
      exports: [
        TOOLKIT_OPTIONS,
        HttpModule,
        StorageModule,
        AuditModule,
        CacheModule,
        SecurityModule,
        ...oauthImports,
      ],
    };
  }
}