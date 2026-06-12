#!/usr/bin/env node
import { Module } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';
import type { OAuthToolkitClient, ToolkitOptions } from './core/interfaces/toolkit-options.interface';
import { OAuthModule } from './oauth/oauth.module';

type CliOAuthRepository = 'options' | 'sql' | 'nosql';
type CliOAuthConfig = {
  connection?: string;
  collection?: string;
  sqlType?: 'postgres' | 'mysql' | 'mariadb' | 'mssql' | undefined;
  synchronize?: boolean;
};

function readEnv(primaryKey: string, ...fallbackKeys: string[]): string | undefined {
  const keys = [primaryKey, ...fallbackKeys];
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function parseBoolean(value?: string): boolean | undefined {
  if (!value) {
    return undefined;
  }

  return value === 'true';
}

function buildCliOAuthRepository(): CliOAuthRepository {
  const repository = readEnv('TOOLKIT_OAUTH_REPOSITORY', 'OAUTH_REPOSITORY') ?? 'options';
  if (repository !== 'options' && repository !== 'sql' && repository !== 'nosql') {
    throw new Error('TOOLKIT_OAUTH_REPOSITORY must be one of: options, sql, nosql');
  }

  return repository;
}

function buildCliOAuthConfig(repository: CliOAuthRepository): CliOAuthConfig | undefined {
  if (repository === 'options') {
    return undefined;
  }

  const connection = repository === 'sql'
    ? readEnv('TOOLKIT_OAUTH_CONNECTION', 'DATABASE_URL')
    : readEnv('TOOLKIT_OAUTH_CONNECTION', 'MONGODB_URI');
  if (!connection) {
    throw new Error(
      repository === 'sql'
        ? 'Define TOOLKIT_OAUTH_CONNECTION (preferido) o DATABASE_URL cuando TOOLKIT_OAUTH_REPOSITORY=sql'
        : 'Define TOOLKIT_OAUTH_CONNECTION (preferido) o MONGODB_URI cuando TOOLKIT_OAUTH_REPOSITORY=nosql',
    );
  }

  const sqlType = readEnv('TOOLKIT_OAUTH_SQL_TYPE');

  return {
    connection,
    collection: readEnv('TOOLKIT_OAUTH_COLLECTION'),
    sqlType:
      sqlType === 'postgres' ||
      sqlType === 'mysql' ||
      sqlType === 'mariadb' ||
      sqlType === 'mssql'
        ? sqlType
        : undefined,
    synchronize: parseBoolean(readEnv('TOOLKIT_OAUTH_SYNCHRONIZE')),
  };
}

function parseScopes(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const scopes = value
    .split(',')
    .map(scope => scope.trim())
    .filter(Boolean);

  return scopes.length > 0 ? scopes : undefined;
}

function parseClientsFromJsonEnv(rawJson?: string): OAuthToolkitClient[] {
  if (!rawJson) {
    return [];
  }

  const parsed = JSON.parse(rawJson) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('TOOLKIT_OAUTH_CLIENTS_JSON must be a JSON array');
  }

  return parsed as OAuthToolkitClient[];
}

function parseSingleClientFromEnv(): OAuthToolkitClient[] {
  const clientId = readEnv('TOOLKIT_OAUTH_CLIENT_ID', 'OAUTH_CLIENT_ID');
  const clientSecret = readEnv('TOOLKIT_OAUTH_CLIENT_SECRET', 'OAUTH_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return [];
  }

  const username = readEnv('TOOLKIT_OAUTH_USERNAME', 'OAUTH_USERNAME');
  const password = readEnv('TOOLKIT_OAUTH_PASSWORD', 'OAUTH_PASSWORD');
  const clientScopes = parseScopes(readEnv('TOOLKIT_OAUTH_SCOPES', 'OAUTH_SCOPES'));
  const userScopes = parseScopes(readEnv('TOOLKIT_OAUTH_USER_SCOPES', 'OAUTH_USER_SCOPES'));
  const client: OAuthToolkitClient = {
    clientId,
    clientSecret,
    ...(clientScopes ? { scopes: clientScopes } : {}),
    ...(username && password
      ? {
          users: [
            {
              username,
              password,
              ...(userScopes ? { scopes: userScopes } : {}),
            },
          ],
        }
      : {}),
  };

  return [client];
}

function buildCliOAuthClients(): OAuthToolkitClient[] {
  const jsonClients = parseClientsFromJsonEnv(
    readEnv('TOOLKIT_OAUTH_CLIENTS_JSON', 'OAUTH_CLIENTS_JSON'),
  );
  if (jsonClients.length > 0) {
    return jsonClients;
  }

  return parseSingleClientFromEnv();
}

const cliRepository = buildCliOAuthRepository();

const cliOptions: ToolkitOptions = {
  storage: { type: 'memory' },
  oauth: {
    enabled: true,
    repository: cliRepository,
    jwtSecret: readEnv('TOOLKIT_JWT_SECRET', 'JWT_SECRET') ?? 'change-me',
    clients: buildCliOAuthClients(),
    config: buildCliOAuthConfig(cliRepository),
  },
  commands: {
    oauth: {
      enabled: true,
    },
  },
};

@Module({
  imports: [OAuthModule.forRoot(cliOptions)],
})
class ToolkitCliModule {}

async function bootstrapCli() {
  try {
    // CommandFactory arranca la app de Nest enfocada en comandos, no en HTTP
    await CommandFactory.run(ToolkitCliModule, {
      logger: ['warn', 'error'], // Ocultamos los logs normales de Nest para una terminal más limpia
    });
  } catch (error) {
    console.error('Error iniciando el CLI:', error);
    process.exit(1);
  }
}

bootstrapCli();