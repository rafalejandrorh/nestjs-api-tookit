import type { OAuthToolkitClient } from '../../core/interfaces/toolkit-options.interface';

export interface OAuthClientRepository {
  findByClientId(clientId: string): Promise<OAuthToolkitClient | null>;
}