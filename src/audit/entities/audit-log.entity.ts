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
  requestBody?: unknown;

  @Column({ type: 'int' })
  responseStatusCode!: number;

  @Column({ type: 'json', nullable: true })
  responseBody?: unknown;

  @Column({ type: 'int' })
  durationMs!: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}