import { GenerateOAuthClientCommand } from './generate-oauth-client.command';

describe('GenerateOAuthClientCommand', () => {
  const repository = {
    saveClient: jest.fn(),
  };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('prints generated client payload from explicit options', async () => {
    const command = new GenerateOAuthClientCommand(repository as never, {
      storage: { type: 'memory' },
      oauth: { enabled: true, repository: 'options' },
    });
    const writeSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);

    await command.run([], {
      clientId: 'client-a',
      clientSecret: 'secret-a',
      scopes: 'read,write',
      username: 'alice',
      password: 'alice-password',
    });

    expect(writeSpy).toHaveBeenCalledWith(
      `${JSON.stringify(
        {
          clientId: 'client-a',
          clientSecret: 'secret-a',
          scopes: ['read', 'write'],
          users: [{ username: 'alice', password: 'alice-password' }],
        },
        null,
        2,
      )}\n`,
    );
    expect(repository.saveClient).not.toHaveBeenCalled();
  });

  it('throws when username/password are not provided together', async () => {
    const command = new GenerateOAuthClientCommand(repository as never, {
      storage: { type: 'memory' },
      oauth: { enabled: true, repository: 'options' },
    });

    await expect(
      command.run([], {
        clientId: 'client-a',
        clientSecret: 'secret-a',
        username: 'alice',
      }),
    ).rejects.toThrow('username and password must be provided together');
  });

  it('persists generated client when oauth repository is sql', async () => {
    const command = new GenerateOAuthClientCommand(repository as never, {
      storage: { type: 'memory' },
      oauth: { enabled: true, repository: 'sql' },
    });
    const writeSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);

    await command.run([], {
      clientId: 'client-sql',
      clientSecret: 'secret-sql',
    });

    expect(repository.saveClient).toHaveBeenCalledWith({
      clientId: 'client-sql',
      clientSecret: 'secret-sql',
    });
    expect(writeSpy).toHaveBeenCalledWith('Persisted in sql repository\n');
  });
});