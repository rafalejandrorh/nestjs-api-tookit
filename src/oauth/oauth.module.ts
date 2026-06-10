import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { StringValue } from 'ms';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OAUTH_CLIENT_REPOSITORY, TOOLKIT_OPTIONS } from '../core/tokens';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { FindOAuthClientCommand, GenerateOAuthClientCommand } from './commands';
import { OptionsOAuthClientRepository } from './repository/options-oauth-client.repository';
import { SqlOAuthClientRepository } from './repository/sql-oauth-client.repository';
import { NoSqlOAuthClientRepository } from './repository/nosql-oauth-client.repository';
import { OAuthClientEntity } from './entities/oauth-client.entity';
import { OAUTH_CLIENT_MODEL, OAuthClientSchema } from './schemas/oauth-client.schema';
import type { OAuthClientRepository } from './interfaces/oauth-client-repository.interface';

function parseJwtExpiresIn(value: number | string): number | StringValue {
  if (typeof value === 'number') {
    return value;
  }

  return value as StringValue;
}

@Module({})
export class OAuthModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const jwtSecret = options.oauth?.jwtSecret ?? 'change-me';
    const jwtIssuer = options.oauth?.jwtIssuer;
    const jwtAlgorithm = (options.oauth?.jwtAlgorithm ?? 'HS256') as 'HS256';
    const accessTokenExpiresIn = parseJwtExpiresIn(options.oauth?.accessTokenExpiresIn ?? '1h');

    const oauthCommandsEnabled = options.commands?.oauth?.enabled ?? true;
    const commandProviders = oauthCommandsEnabled
      ? [GenerateOAuthClientCommand, FindOAuthClientCommand]
      : [];

    const oauthRepositoryType = options.oauth?.repository ?? 'options';
    const mongoConnection = options.oauth?.config?.connection;
    const mongoCollection = options.oauth?.config?.collection ?? 'oauth_clients';
    const sqlConnection = options.oauth?.config?.connection;
    const sqlType = options.oauth?.config?.sqlType ?? 'postgres';
    const sqlSynchronize = options.oauth?.config?.synchronize ?? false;

    if ((oauthRepositoryType === 'sql' || oauthRepositoryType === 'nosql') && !options.oauth?.config?.connection) {
      throw new Error('oauth.config.connection is required when oauth.repository is sql or nosql');
    }

    const imports = [
      JwtModule.register({
        secret: jwtSecret,
        signOptions: {
          issuer: jwtIssuer,
          algorithm: jwtAlgorithm,
          expiresIn: accessTokenExpiresIn,
        },
      }),
      ...(oauthRepositoryType === 'nosql'
        ? [
            MongooseModule.forRoot(mongoConnection ?? ''),
            MongooseModule.forFeature([
              {
                name: OAUTH_CLIENT_MODEL,
                schema: OAuthClientSchema,
                collection: mongoCollection,
              },
            ]),
          ]
        : []),
      ...(oauthRepositoryType === 'sql'
        ? [
            TypeOrmModule.forRoot({
              type: sqlType,
              url: sqlConnection,
              entities: [OAuthClientEntity],
              synchronize: sqlSynchronize,
            }),
            TypeOrmModule.forFeature([OAuthClientEntity]),
          ]
        : []),
    ];

    const oauthRepositoryProvider = oauthRepositoryType === 'nosql'
      ? {
          provide: TOOLKIT_OAUTH_CLIENT_REPOSITORY,
          useClass: NoSqlOAuthClientRepository,
        }
      : oauthRepositoryType === 'sql'
        ? {
            provide: TOOLKIT_OAUTH_CLIENT_REPOSITORY,
            useClass: SqlOAuthClientRepository,
          }
        : {
            provide: TOOLKIT_OAUTH_CLIENT_REPOSITORY,
            useClass: OptionsOAuthClientRepository,
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