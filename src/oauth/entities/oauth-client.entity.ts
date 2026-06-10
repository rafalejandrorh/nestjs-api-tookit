import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { OAuthToolkitUser } from '../../core/interfaces/toolkit-options.interface';

@Entity('oauth_clients')
export class OAuthClientEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index('idx_oauth_clients_client_id', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  clientId!: string;

  @Column({ type: 'varchar', length: 255 })
  clientSecret!: string;

  @Column({ type: 'simple-json', nullable: true })
  scopes!: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  users!: OAuthToolkitUser[] | null;
}