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

export type AuthTokenPurpose =
  | 'email_verification'
  | 'password_reset'
  | 'oauth_exchange'
  | 'refresh';

@Entity('auth_tokens')
@Index('idx_auth_tokens_user_id', ['user_id'])
@Index('idx_auth_tokens_token_hash', ['token_hash'], { unique: true })
@Index('idx_auth_tokens_purpose_hash', ['purpose', 'token_hash'])
@Index('idx_auth_tokens_expires_at', ['expires_at'])
export class AuthToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ type: 'varchar', length: 30, nullable: false })
  purpose!: AuthTokenPurpose;

  @Column({ type: 'varchar', length: 128, nullable: false, unique: true })
  token_hash!: string;

  @Column({ type: 'timestamptz', nullable: false })
  expires_at!: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  used_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  revoked_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => User, (user) => user.auth_tokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
