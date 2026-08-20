import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import type { ToolkitOptions } from './core/interfaces/toolkit-options.interface';
import { TOOLKIT_ENCRYPTOR, TOOLKIT_OPTIONS } from './core/tokens';
import { Encryptor } from './crypto/encryptor';
import { StorageModule } from './storage/storage.module';
import { AuditModule } from './audit/audit.module';
import { CacheModule } from './cache/cache.module';
import { SecurityModule } from './security/security.module';
import { OAuthModule } from './oauth/oauth.module';
import { HttpModule } from './http/http.module';

function createEncryptorProvider(options: ToolkitOptions): Provider {
  return {
    provide: TOOLKIT_ENCRYPTOR,
    useFactory: (): Encryptor | null => {
      const secret = options.encryption?.secret;
      if (!secret) {
        return null;
      }
      return new Encryptor(secret, options.encryption?.legacySecret);
    },
  };
}

@Global()
@Module({})
export class ApiToolkitModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const oauthImports = options.oauth?.enabled ? [OAuthModule.forRoot(options)] : [];
    const auditImports = options.audit?.enabled ? [AuditModule.forRoot(options)] : [];
    const encryptorProvider = createEncryptorProvider(options);

    return {
      module: ApiToolkitModule,
      imports: [
        HttpModule.forRoot(options),
        StorageModule.forRoot(options),
        SecurityModule.forRoot(options),
        ...auditImports,
        CacheModule,
        ...oauthImports,
      ],
      providers: [{ provide: TOOLKIT_OPTIONS, useValue: options }, encryptorProvider],
      exports: [
        TOOLKIT_OPTIONS,
        TOOLKIT_ENCRYPTOR,
        HttpModule,
        StorageModule,
        CacheModule,
        SecurityModule,
        ...auditImports,
        ...oauthImports,
      ],
    };
  }
}
