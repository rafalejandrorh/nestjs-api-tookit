import { FindOAuthClientCommand } from './find-oauth-client.command';

describe('FindOAuthClientCommand', () => {
  const repository = {
    findByClientId: jest.fn(async (clientId: string) => (clientId === 'client-a'
      ? {
          clientId: 'client-a',
          clientSecret: 'secret-a',
          scopes: ['read'],
        }
      : null)),
  };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('prints redacted client by default', async () => {
    const command = new FindOAuthClientCommand(repository as never);
    const writeSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);

    await command.run(['client-a'], {});

    expect(writeSpy).toHaveBeenCalledWith(
      `${JSON.stringify(
        {
          clientId: 'client-a',
          clientSecret: '[REDACTED]',
          scopes: ['read'],
        },
        null,
        2,
      )}\n`,
    );
  });

  it('prints full client when reveal-secret is enabled', async () => {
    const command = new FindOAuthClientCommand(repository as never);
    const writeSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);

    await command.run(['client-a'], { revealSecret: true });

    expect(writeSpy).toHaveBeenCalledWith(
      `${JSON.stringify(
        {
          clientId: 'client-a',
          clientSecret: 'secret-a',
          scopes: ['read'],
        },
        null,
        2,
      )}\n`,
    );
  });

  it('throws when client does not exist', async () => {
    const command = new FindOAuthClientCommand(repository as never);

    await expect(command.run(['missing-client'], {})).rejects.toThrow(
      'OAuth client not found for clientId: missing-client',
    );
  });
});