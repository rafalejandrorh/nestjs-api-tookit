import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_logs' })
export class AuditLogEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 16 })
  method!: string;

  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ip?: string;

  @Column({ type: 'json', nullable: true })
  requestHeaders?: Record<string, string[] | string> | null;

  @Column({ type: 'json', nullable: true })
  requestBody?: unknown;

  @Column({ type: 'boolean', nullable: true })
  requestBodyTruncated?: boolean | null;

  @Column({ type: 'int', nullable: true })
  requestSize?: number | null;

  @Column({ type: 'int' })
  responseStatusCode!: number;

  @Column({ type: 'json', nullable: true })
  responseBody?: unknown;

  @Column({ type: 'boolean', nullable: true })
  responseBodyTruncated?: boolean | null;

  @Column({ type: 'int', nullable: true })
  responseSize?: number | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  macAddress?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  requestId?: string | null;

  @Column({ type: 'int' })
  durationMs!: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
