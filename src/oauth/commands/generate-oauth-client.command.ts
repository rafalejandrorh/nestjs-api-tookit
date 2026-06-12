import { randomBytes } from 'crypto';
import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import type { OAuthToolkitClient, OAuthToolkitUser, ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OAUTH_CLIENT_REPOSITORY, TOOLKIT_OPTIONS } from '../../core/tokens';
import type { OAuthClientRepository } from '../interfaces/oauth-client-repository.interface';

type GenerateOAuthClientCommandOptions = {
  clientId?: string;
  clientSecret?: string;
  scopes?: string;
  username?: string;
  password?: string;
};

function parseScopes(rawScopes?: string): string[] {
  if (!rawScopes) {
    return [];
  }

  return rawScopes
    .split(',')
    .map(scope => scope.trim())
    .filter(Boolean);
}

@Command({
  name: 'toolkit:oauth-client:generate',
  description: 'Generate OAuth client credentials for toolkit configuration',
})
export class GenerateOAuthClientCommand extends CommandRunner {
  constructor(
    @Inject(TOOLKIT_OAUTH_CLIENT_REPOSITORY)
    private readonly oauthClientRepository: OAuthClientRepository,
    @Inject(TOOLKIT_OPTIONS) private readonly options: ToolkitOptions,
  ) {
    super();
  }

  @Option({ flags: '--client-id [clientId]' })
  parseClientId(clientId: string): string {
    return clientId;
  }

  @Option({ flags: '--client-secret [clientSecret]' })
  parseClientSecret(clientSecret: string): string {
    return clientSecret;
  }

  @Option({ flags: '--scopes [scopes]' })
  parseScopesOption(scopes: string): string {
    return scopes;
  }

  @Option({ flags: '--username [username]' })
  parseUsername(username: string): string {
    return username;
  }

  @Option({ flags: '--password [password]' })
  parsePassword(password: string): string {
    return password;
  }

  async run(_: string[], options: GenerateOAuthClientCommandOptions): Promise<void> {
    const clientId = options.clientId ?? randomBytes(12).toString('hex');
    const clientSecret = options.clientSecret ?? randomBytes(24).toString('hex');
    const scopes = parseScopes(options.scopes);
    const users = this.buildUsers(options.username, options.password);

    const outputClient: OAuthToolkitClient = {
      clientId,
      clientSecret,
      ...(scopes.length > 0 ? { scopes } : {}),
      ...(users.length > 0 ? { users } : {}),
    };

    const oauthRepositoryType = this.options.oauth?.repository ?? 'options';

    if (oauthRepositoryType === 'sql' || oauthRepositoryType === 'nosql') {
      await this.oauthClientRepository.saveClient(outputClient);
    }

    process.stdout.write(`${JSON.stringify(outputClient, null, 2)}\n`);

    if (oauthRepositoryType === 'sql' || oauthRepositoryType === 'nosql') {
      process.stdout.write(`Persisted in ${oauthRepositoryType} repository\n`);
    }
  }

  private buildUsers(username?: string, password?: string): OAuthToolkitUser[] {
    if (!username && !password) {
      return [];
    }

    if (!username || !password) {
      throw new Error('username and password must be provided together');
    }

    return [{ username, password }];
  }
}