import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { TOOLKIT_OAUTH_CLIENT_REPOSITORY } from '../../core/tokens';
import type { OAuthClientRepository } from '../interfaces/oauth-client-repository.interface';

type FindOAuthClientCommandOptions = {
  revealSecret?: boolean;
};

@Command({
  name: 'toolkit:oauth-client:find',
  description: 'Find configured OAuth client by clientId',
  arguments: '<clientId>',
})
export class FindOAuthClientCommand extends CommandRunner {
  constructor(
    @Inject(TOOLKIT_OAUTH_CLIENT_REPOSITORY)
    private readonly oauthClientRepository: OAuthClientRepository,
  ) {
    super();
  }

  @Option({ flags: '--reveal-secret [revealSecret]' })
  parseRevealSecret(revealSecret: string): boolean {
    return revealSecret === 'true';
  }

  async run(params: string[], options: FindOAuthClientCommandOptions): Promise<void> {
    const [clientId] = params;
    if (!clientId) {
      throw new Error('clientId is required');
    }

    const client = await this.oauthClientRepository.findByClientId(clientId);
    if (!client) {
      throw new Error(`OAuth client not found for clientId: ${clientId}`);
    }

    const output = options.revealSecret
      ? client
      : {
          ...client,
          clientSecret: '[REDACTED]',
        };

    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  }
}