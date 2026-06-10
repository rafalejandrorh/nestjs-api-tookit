import { Inject, Injectable } from '@nestjs/common';
import type { OAuthToolkitClient, ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../../core/tokens';
import type { OAuthClientRepository } from '../interfaces/oauth-client-repository.interface';

@Injectable()
export class OptionsOAuthClientRepository implements OAuthClientRepository {
  constructor(@Inject(TOOLKIT_OPTIONS) private readonly options: ToolkitOptions) {}

  async findByClientId(clientId: string): Promise<OAuthToolkitClient | null> {
    const client = (this.options.oauth?.clients ?? []).find(item => item.clientId === clientId);
    return client ?? null;
  }
}