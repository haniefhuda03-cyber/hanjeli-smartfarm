import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity.js';

/**
 * Irrigation activity log — TimescaleDB HYPERTABLE.
 *
 * BIGSERIAL PK for write performance.
 * ON DELETE CASCADE — logs are deleted when user is deleted.
 * Hypertable partition key: executed_at
 */
@Entity('irrigation_activity_logs')
@Index('idx_irrigation_activity_logs_user_time', ['user_id', 'executed_at'])
export class IrrigationActivityLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ type: 'varchar', length: 300, nullable: false })
  description!: string;

  /**
   * Activity type.
   * CHECK: 'success' | 'info' | 'warning'
   */
  @Column({ type: 'varchar', length: 20, nullable: false })
  type!: string;

  @Column({ type: 'timestamptz', nullable: false, default: () => 'NOW()' })
  executed_at!: Date;

  // ─── Relations ───

  @ManyToOne(() => User, (user) => user.irrigation_activity_logs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
