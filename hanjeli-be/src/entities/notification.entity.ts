import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity.js';

@Entity('notifications')
@Index('idx_notifications_user_read_time', ['user_id', 'read', 'created_at'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ type: 'varchar', length: 200, nullable: false })
  title!: string;

  @Column({ type: 'text', nullable: true, default: null })
  description!: string | null;

  /**
   * Notification type.
   * CHECK: 'info' | 'success' | 'warning' | 'error'
   */
  @Column({ type: 'varchar', length: 20, nullable: false })
  type!: string;

  /**
   * Domain category for icon mapping.
   * CHECK: 'temperature' | 'irrigation' | 'soil' |
   *        'wind' | 'ph' | 'uv' | 'device' | 'security' |
   *        'auth' | 'profile' | 'system' | 'general'
   */
  @Column({ type: 'varchar', length: 30, nullable: false, default: 'general' })
  category!: string;

  @Column({ type: 'boolean', nullable: false, default: false })
  read!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  // ─── Relations ───

  @ManyToOne(() => User, (user) => user.notifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
