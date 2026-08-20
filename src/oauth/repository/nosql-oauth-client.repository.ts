import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { OAuthToolkitClient } from '../../core/interfaces/toolkit-options.interface';
import { EncryptionAad } from '../../crypto/encryption-aad';
import type { Encryptor } from '../../crypto/encryptor';
import { TOOLKIT_ENCRYPTOR } from '../../core/tokens';
import type { OAuthClientRepository } from '../interfaces/oauth-client-repository.interface';
import { OAUTH_CLIENT_MODEL, type OAuthClientModel } from '../schemas/oauth-client.schema';

@Injectable()
export class NoSqlOAuthClientRepository implements OAuthClientRepository {
  constructor(
    @InjectModel(OAUTH_CLIENT_MODEL)
    private readonly model: Model<OAuthClientModel>,
    @Optional() @Inject(TOOLKIT_ENCRYPTOR) private readonly encryptor: Encryptor | null,
  ) {}

  async findByClientId(clientId: string): Promise<OAuthToolkitClient | null> {
    const lookupId = this.toStoredClientId(clientId);
    const client = await this.model.findOne({ clientId: lookupId }).lean<OAuthClientModel | null>().exec();
    if (!client) {
      return null;
    }

    return this.toToolkitClient(client);
  }

  async saveClient(client: OAuthToolkitClient): Promise<void> {
    const lookupId = this.toStoredClientId(client.clientId);

    await this.model
      .updateOne(
        { clientId: lookupId },
        {
          $set: {
            clientId: lookupId,
            clientSecret: this.toStoredClientSecret(client.clientSecret),
            name: client.name,
            roles: client.roles,
            scopes: client.scopes,
            users: client.users,
          },
        },
        { upsert: true },
      )
      .exec();
  }

  private toStoredClientId(clientId: string): string {
    if (!this.encryptor) {
      return clientId;
    }
    return this.encryptor.encryptDeterministic(clientId, EncryptionAad.OAUTH_CLIENT_ID);
  }

  private toStoredClientSecret(clientSecret: string): string {
    if (!this.encryptor) {
      return clientSecret;
    }
    return this.encryptor.encrypt(clientSecret, EncryptionAad.OAUTH_CLIENT_SECRET);
  }

  private toToolkitClient(client: OAuthClientModel): OAuthToolkitClient {
    const clientId = this.encryptor
      ? this.encryptor.decrypt(client.clientId, EncryptionAad.OAUTH_CLIENT_ID)
      : client.clientId;
    const clientSecret = this.encryptor
      ? this.encryptor.decrypt(client.clientSecret, EncryptionAad.OAUTH_CLIENT_SECRET)
      : client.clientSecret;

    return {
      clientId,
      clientSecret,
      ...(client.name ? { name: client.name } : {}),
      ...(client.roles ? { roles: client.roles } : {}),
      ...(client.scopes ? { scopes: client.scopes } : {}),
      ...(client.users ? { users: client.users } : {}),
    };
  }
}
