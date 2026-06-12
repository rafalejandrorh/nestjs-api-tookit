import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { OAuthToolkitClient } from '../../core/interfaces/toolkit-options.interface';
import { OAuthClientEntity } from '../entities/oauth-client.entity';
import type { OAuthClientRepository } from '../interfaces/oauth-client-repository.interface';

@Injectable()
export class SqlOAuthClientRepository implements OAuthClientRepository {
  constructor(
    @InjectRepository(OAuthClientEntity)
    private readonly repository: Repository<OAuthClientEntity>,
  ) {}

  async findByClientId(clientId: string): Promise<OAuthToolkitClient | null> {
    const client = await this.repository.findOne({ where: { clientId } });
    if (!client) {
      return null;
    }

    return {
      clientId: client.clientId,
      clientSecret: client.clientSecret,
      ...(client.scopes ? { scopes: client.scopes } : {}),
      ...(client.users ? { users: client.users } : {}),
    };
  }

  async saveClient(client: OAuthToolkitClient): Promise<void> {
    const existing = await this.repository.findOne({ where: { clientId: client.clientId } });

    const entity = existing
      ? this.repository.merge(existing, {
          clientSecret: client.clientSecret,
          scopes: client.scopes ?? null,
          users: client.users ?? null,
        })
      : this.repository.create({
          clientId: client.clientId,
          clientSecret: client.clientSecret,
          scopes: client.scopes ?? null,
          users: client.users ?? null,
        });

    await this.repository.save(entity);
  }
}