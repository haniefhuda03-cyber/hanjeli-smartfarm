import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from './user.entity.js';

/**
 * Granular notification preferences per (category, channel).
 *
 * Normalized from frontend JSONB state to satisfy 1NF–BCNF.
 * Each row stores ONE (category, channel) → enabled pair.
 * Max 6 rows per user (3 categories × 2 channels).
 *
 * Categories : 'irrigation' | 'sensor' | 'system'
 * Channels   : 'push' | 'email'
 *
 * BCNF proof:
 *   CK₁: {id}
 *   CK₂: {user_id, category, channel}
 *   FD: CK → enabled (all non-key attrs depend on CK)
 *
 * ON DELETE CASCADE — prefs are deleted when user is deleted.
 */
@Entity('user_notification_prefs')
@Unique('uq_user_notif_cat_chan', ['user_id', 'category', 'channel'])
export class UserNotificationPref {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_user_notification_prefs_user_id')
  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  /**
   * Notification category.
   * CHECK: 'irrigation' | 'sensor' | 'system'
   */
  @Column({ type: 'varchar', length: 30, nullable: false })
  category!: string;

  /**
   * Delivery channel.
   * CHECK: 'push' | 'email'
   */
  @Column({ type: 'varchar', length: 10, nullable: false })
  channel!: string;

  @Column({ type: 'boolean', nullable: false, default: true })
  enabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  // ─── Relations ───

  @ManyToOne(() => User, (user) => user.notification_prefs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
