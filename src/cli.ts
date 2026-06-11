#!/usr/bin/env node
import { Module } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';
import type { OAuthToolkitClient, ToolkitOptions } from './core/interfaces/toolkit-options.interface';
import { OAuthModule } from './oauth/oauth.module';

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
  const clientId = process.env.TOOLKIT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.TOOLKIT_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return [];
  }

  const username = process.env.TOOLKIT_OAUTH_USERNAME;
  const password = process.env.TOOLKIT_OAUTH_PASSWORD;
  const client: OAuthToolkitClient = {
    clientId,
    clientSecret,
    ...(parseScopes(process.env.TOOLKIT_OAUTH_SCOPES)
      ? { scopes: parseScopes(process.env.TOOLKIT_OAUTH_SCOPES) }
      : {}),
    ...(username && password
      ? {
          users: [
            {
              username,
              password,
              ...(parseScopes(process.env.TOOLKIT_OAUTH_USER_SCOPES)
                ? { scopes: parseScopes(process.env.TOOLKIT_OAUTH_USER_SCOPES) }
                : {}),
            },
          ],
        }
      : {}),
  };

  return [client];
}

function buildCliOAuthClients(): OAuthToolkitClient[] {
  const jsonClients = parseClientsFromJsonEnv(process.env.TOOLKIT_OAUTH_CLIENTS_JSON);
  if (jsonClients.length > 0) {
    return jsonClients;
  }

  return parseSingleClientFromEnv();
}

const cliOptions: ToolkitOptions = {
  storage: { type: 'memory' },
  oauth: {
    enabled: true,
    repository: 'options',
    jwtSecret: process.env.TOOLKIT_JWT_SECRET ?? 'change-me',
    clients: buildCliOAuthClients(),
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