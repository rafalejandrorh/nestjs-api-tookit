import { DynamicModule, Module, Provider } from '@nestjs/common';
import type { StringValue } from 'ms';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OAUTH_CLIENT_REPOSITORY, TOOLKIT_OPTIONS } from '../core/tokens';
import { loadOptionalPeer } from '../core/utils/optional-peer.util';

type JwtModuleLike = {
  register(config: Record<string, unknown>): DynamicModule;
};

type MongooseModuleLike = {
  forRoot(connection: string): DynamicModule;
  forFeature(models: Array<Record<string, unknown>>): DynamicModule;
};

type TypeOrmModuleLike = {
  forRoot(config: Record<string, unknown>): DynamicModule;
  forFeature(entities: unknown[]): DynamicModule;
};

function parseJwtExpiresIn(value: number | string): number | StringValue {
  if (typeof value === 'number') {
    return value;
  }

  return value as StringValue;
}

@Module({})
export class OAuthModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const { JwtModule } = loadOptionalPeer<{ JwtModule: JwtModuleLike }>(
      '@nestjs/jwt',
      'oauth.enabled=true',
    );

    const jwtSecret = options.oauth?.jwtSecret ?? 'change-me';
    const jwtIssuer = options.oauth?.jwtIssuer;
    const jwtAlgorithm = (options.oauth?.jwtAlgorithm ?? 'HS256') as 'HS256';
    const accessTokenExpiresIn = parseJwtExpiresIn(options.oauth?.accessTokenExpiresIn ?? '1h');
    const oauthCommandsEnabled = options.commands?.oauth?.enabled ?? true;
    const commandProviders: Array<new (...args: unknown[]) => unknown> = [];

    if (oauthCommandsEnabled) {
      loadOptionalPeer<Record<string, unknown>>('nest-commander', 'commands.oauth.enabled=true');
      const { GenerateOAuthClientCommand } = require('./commands/generate-oauth-client.command') as {
        GenerateOAuthClientCommand: new (...args: unknown[]) => unknown;
      };
      const { FindOAuthClientCommand } = require('./commands/find-oauth-client.command') as {
        FindOAuthClientCommand: new (...args: unknown[]) => unknown;
      };

      commandProviders.push(GenerateOAuthClientCommand, FindOAuthClientCommand);
    }

    const oauthRepositoryType = options.oauth?.repository ?? 'options';
    if ((oauthRepositoryType === 'sql' || oauthRepositoryType === 'nosql') && !options.oauth?.config?.connection) {
      throw new Error('oauth.config.connection is required when oauth.repository is sql or nosql');
    }

    const imports: DynamicModule[] = [
      JwtModule.register({
        secret: jwtSecret,
        signOptions: {
          issuer: jwtIssuer,
          algorithm: jwtAlgorithm,
          expiresIn: accessTokenExpiresIn,
        },
      }),
    ];

    let oauthRepositoryProvider: Provider;

    if (oauthRepositoryType === 'nosql') {
      const mongoConnection = options.oauth?.config?.connection;
      const mongoCollection = options.oauth?.config?.collection ?? 'oauth_clients';

      loadOptionalPeer<Record<string, unknown>>('mongoose', 'oauth.repository="nosql"');
      const { MongooseModule } = loadOptionalPeer<{ MongooseModule: MongooseModuleLike }>(
        '@nestjs/mongoose',
        'oauth.repository="nosql"',
      );
      const { NoSqlOAuthClientRepository } = require('./repository/nosql-oauth-client.repository') as {
        NoSqlOAuthClientRepository: new (...args: unknown[]) => unknown;
      };
      const { OAUTH_CLIENT_MODEL, OAuthClientSchema } = require('./schemas/oauth-client.schema') as {
        OAUTH_CLIENT_MODEL: string;
        OAuthClientSchema: unknown;
      };

      imports.push(
        MongooseModule.forRoot(mongoConnection ?? ''),
        MongooseModule.forFeature([
          {
            name: OAUTH_CLIENT_MODEL,
            schema: OAuthClientSchema,
            collection: mongoCollection,
          },
        ]),
      );

      oauthRepositoryProvider = {
        provide: TOOLKIT_OAUTH_CLIENT_REPOSITORY,
        useClass: NoSqlOAuthClientRepository,
      };
    } else if (oauthRepositoryType === 'sql') {
      const sqlConnection = options.oauth?.config?.connection;
      const sqlType = options.oauth?.config?.sqlType ?? 'postgres';
      const sqlSynchronize = options.oauth?.config?.synchronize ?? false;

      loadOptionalPeer<Record<string, unknown>>('typeorm', 'oauth.repository="sql"');
      if (sqlType === 'postgres') {
        loadOptionalPeer<Record<string, unknown>>('pg', 'oauth.repository="sql" with sqlType="postgres"');
      }

      const { TypeOrmModule } = loadOptionalPeer<{ TypeOrmModule: TypeOrmModuleLike }>(
        '@nestjs/typeorm',
        'oauth.repository="sql"',
      );
      const { SqlOAuthClientRepository } = require('./repository/sql-oauth-client.repository') as {
        SqlOAuthClientRepository: new (...args: unknown[]) => unknown;
      };
      const { OAuthClientEntity } = require('./entities/oauth-client.entity') as {
        OAuthClientEntity: new (...args: unknown[]) => unknown;
      };

      imports.push(
        TypeOrmModule.forRoot({
          type: sqlType,
          url: sqlConnection,
          entities: [OAuthClientEntity],
          synchronize: sqlSynchronize,
        }),
        TypeOrmModule.forFeature([OAuthClientEntity]),
      );

      oauthRepositoryProvider = {
        provide: TOOLKIT_OAUTH_CLIENT_REPOSITORY,
        useClass: SqlOAuthClientRepository,
      };
    } else {
      const { OptionsOAuthClientRepository } = require('./repository/options-oauth-client.repository') as {
        OptionsOAuthClientRepository: new (...args: unknown[]) => unknown;
      };

      oauthRepositoryProvider = {
        provide: TOOLKIT_OAUTH_CLIENT_REPOSITORY,
        useClass: OptionsOAuthClientRepository,
      };
    }

    const { OAuthService } = require('./oauth.service') as {
      OAuthService: new (...args: unknown[]) => unknown;
    };
    const { OAuthController } = require('./oauth.controller') as {
      OAuthController: new (...args: unknown[]) => unknown;
    };

    return {
      module: OAuthModule,
      imports,
      providers: [
        { provide: TOOLKIT_OPTIONS, useValue: options },
        oauthRepositoryProvider,
        OAuthService,
        ...commandProviders,
      ],
      controllers: [OAuthController],
      exports: [OAuthService],
    };
  }
}