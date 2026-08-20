import { ApiToolkitModule } from './api-toolkit.module';
import { AuditModule } from './audit/audit.module';
import { OAuthModule } from './oauth/oauth.module';

describe('ApiToolkitModule', () => {
  it('bootstraps without audit configuration', () => {
    const dynamicModule = ApiToolkitModule.forRoot({
      storage: { type: 'memory' },
    });

    const imports = dynamicModule.imports ?? [];
    const hasAudit = imports.some(
      item => typeof item === 'object' && item !== null && 'module' in item && item.module === AuditModule,
    );

    expect(hasAudit).toBe(false);
    expect(dynamicModule.exports).not.toContain(AuditModule);
  });

  it('includes AuditModule when audit is enabled', () => {
    const dynamicModule = ApiToolkitModule.forRoot({
      storage: { type: 'memory' },
      audit: {
        enabled: true,
        repository: 'sql',
        config: {
          connection: 'postgres://localhost/db',
          sqlType: 'postgres',
        },
      },
    });

    const imports = dynamicModule.imports ?? [];
    const hasAudit = imports.some(
      item => typeof item === 'object' && item !== null && 'module' in item && item.module === AuditModule,
    );

    expect(hasAudit).toBe(true);
  });

  it('includes OAuthModule only when oauth is enabled', () => {
    const withoutOauth = ApiToolkitModule.forRoot({ storage: { type: 'memory' } });
    const withOauth = ApiToolkitModule.forRoot({
      storage: { type: 'memory' },
      oauth: { enabled: true, jwtSecret: 'secret' },
    });

    const hasOauth = (imports: DynamicModuleImports) =>
      imports.some(
        item => typeof item === 'object' && item !== null && 'module' in item && item.module === OAuthModule,
      );

    expect(hasOauth(withoutOauth.imports ?? [])).toBe(false);
    expect(hasOauth(withOauth.imports ?? [])).toBe(true);
  });
});

type DynamicModuleImports = NonNullable<ReturnType<typeof ApiToolkitModule.forRoot>['imports']>;
