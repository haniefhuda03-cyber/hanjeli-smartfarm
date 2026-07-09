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

/**
 * Normalized from users.recovery_codes text[] to satisfy 1NF.
 * Each code is bcrypt-hashed before storage.
 * ON DELETE CASCADE — codes are deleted when user is deleted.
 */
@Entity('recovery_codes')
export class RecoveryCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_recovery_codes_user_id')
  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  /** Bcrypt-hashed recovery code (e.g. "A1B2-C3D4" → hashed) */
  @Column({ type: 'varchar', length: 255, nullable: false })
  code!: string;

  @Column({ type: 'boolean', nullable: false, default: false })
  is_used!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  // ─── Relations ───

  @ManyToOne(() => User, (user) => user.recovery_codes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
