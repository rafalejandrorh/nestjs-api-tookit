import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { OAuthToolkitClient } from '../../core/interfaces/toolkit-options.interface';
import { EncryptionAad } from '../../crypto/encryption-aad';
import type { Encryptor } from '../../crypto/encryptor';
import { TOOLKIT_ENCRYPTOR } from '../../core/tokens';
import { OAuthClientEntity } from '../entities/oauth-client.entity';
import type { OAuthClientRepository } from '../interfaces/oauth-client-repository.interface';

@Injectable()
export class SqlOAuthClientRepository implements OAuthClientRepository {
  constructor(
    @InjectRepository(OAuthClientEntity)
    private readonly repository: Repository<OAuthClientEntity>,
    @Optional() @Inject(TOOLKIT_ENCRYPTOR) private readonly encryptor: Encryptor | null,
  ) {}

  async findByClientId(clientId: string): Promise<OAuthToolkitClient | null> {
    const lookupId = this.toStoredClientId(clientId);
    const client = await this.repository.findOne({ where: { clientId: lookupId } });
    if (!client) {
      return null;
    }

    return this.toToolkitClient(client);
  }

  async saveClient(client: OAuthToolkitClient): Promise<void> {
    const lookupId = this.toStoredClientId(client.clientId);
    const existing = await this.repository.findOne({ where: { clientId: lookupId } });

    const entity = existing
      ? this.repository.merge(existing, {
          clientSecret: this.toStoredClientSecret(client.clientSecret),
          name: client.name ?? null,
          roles: client.roles ?? null,
          scopes: client.scopes ?? null,
          users: client.users ?? null,
        })
      : this.repository.create({
          clientId: lookupId,
          clientSecret: this.toStoredClientSecret(client.clientSecret),
          name: client.name ?? null,
          roles: client.roles ?? null,
          scopes: client.scopes ?? null,
          users: client.users ?? null,
        });

    await this.repository.save(entity);
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

  private toToolkitClient(client: OAuthClientEntity): OAuthToolkitClient {
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
