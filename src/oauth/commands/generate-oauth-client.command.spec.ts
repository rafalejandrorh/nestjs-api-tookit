import { GenerateOAuthClientCommand } from './generate-oauth-client.command';

describe('GenerateOAuthClientCommand', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prints generated client payload from explicit options', async () => {
    const command = new GenerateOAuthClientCommand();
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
  });

  it('throws when username/password are not provided together', async () => {
    const command = new GenerateOAuthClientCommand();

    await expect(
      command.run([], {
        clientId: 'client-a',
        clientSecret: 'secret-a',
        username: 'alice',
      }),
    ).rejects.toThrow('username and password must be provided together');
  });
});