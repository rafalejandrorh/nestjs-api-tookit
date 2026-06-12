import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { OAuthToolkitClient } from '../../core/interfaces/toolkit-options.interface';
import type { OAuthClientRepository } from '../interfaces/oauth-client-repository.interface';
import { OAUTH_CLIENT_MODEL, type OAuthClientModel } from '../schemas/oauth-client.schema';

@Injectable()
export class NoSqlOAuthClientRepository implements OAuthClientRepository {
  constructor(
    @InjectModel(OAUTH_CLIENT_MODEL)
    private readonly model: Model<OAuthClientModel>,
  ) {}

  async findByClientId(clientId: string): Promise<OAuthToolkitClient | null> {
    const client = await this.model.findOne({ clientId }).lean<OAuthClientModel | null>().exec();
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
    await this.model
      .updateOne(
        { clientId: client.clientId },
        {
          $set: {
            clientSecret: client.clientSecret,
            scopes: client.scopes,
            users: client.users,
          },
        },
        { upsert: true },
      )
      .exec();
  }
}