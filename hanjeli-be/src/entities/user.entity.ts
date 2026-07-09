import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { RecoveryCode } from './recovery-code.entity.js';
import { UserPreference } from './user-preference.entity.js';
import { Device } from './device.entity.js';
import { IrrigationConfig } from './irrigation-config.entity.js';
import { IrrigationSchedule } from './irrigation-schedule.entity.js';
import { IrrigationActivityLog } from './irrigation-activity-log.entity.js';
import { Notification } from './notification.entity.js';
import { UserNotificationPref } from './user-notification-pref.entity.js';
import { UserSensorThreshold } from './user-sensor-threshold.entity.js';
import { AuthToken } from './auth-token.entity.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Index('idx_users_email', { unique: true })
  @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
  email!: string;

  /**
   * User role.
   * CHECK: 'Admin' | 'Guest'
   * Used by frontend /users page for role-based filtering.
   */
  @Column({ type: 'varchar', length: 20, nullable: false, default: 'Guest' })
  role!: string;

  /** NULL when user signed up via Google OAuth */
  @Column({ type: 'varchar', length: 255, nullable: true })
  password_hash!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  avatar_url!: string | null;

  @Column({ type: 'boolean', nullable: false, default: false })
  two_factor_enabled!: boolean;

  /**
   * Encrypted TOTP secret (pgcrypto).
   * Stored as bytea for at-rest encryption.
   */
  @Column({ type: 'bytea', nullable: true, default: null })
  two_factor_secret!: Buffer | null;

  @Column({ type: 'boolean', nullable: false, default: false })
  email_verified!: boolean;

  @Index('idx_users_google_id', { unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  google_id!: string | null;

  /**
   * Session epoch. Embedded into every access & refresh JWT at issue time.
   * Incrementing this value instantly invalidates ALL previously issued tokens
   * for the user (server-side logout / "log out everywhere"). Bumped on logout
   * and password reset so a captured or stale refresh token cannot be replayed.
   */
  @Column({ type: 'integer', nullable: false, default: 0 })
  token_version!: number;

  @Column({ type: 'timestamptz', nullable: true })
  password_updated_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  // ─── Relations ───

  @OneToMany(() => RecoveryCode, (rc) => rc.user)
  recovery_codes!: RecoveryCode[];

  @OneToMany(() => AuthToken, (token) => token.user)
  auth_tokens!: AuthToken[];

  @OneToOne(() => UserPreference, (pref) => pref.user)
  preference!: UserPreference;

  @OneToMany(() => Device, (device) => device.user)
  devices!: Device[];

  @OneToOne(() => IrrigationConfig, (config) => config.user)
  irrigation_config!: IrrigationConfig;

  @OneToMany(() => IrrigationSchedule, (sched) => sched.user)
  irrigation_schedules!: IrrigationSchedule[];

  @OneToMany(() => IrrigationActivityLog, (log) => log.user)
  irrigation_activity_logs!: IrrigationActivityLog[];

  @OneToMany(() => Notification, (notif) => notif.user)
  notifications!: Notification[];

  @OneToMany(() => UserNotificationPref, (pref) => pref.user)
  notification_prefs!: UserNotificationPref[];

  @OneToMany(() => UserSensorThreshold, (thresh) => thresh.user)
  sensor_thresholds!: UserSensorThreshold[];
}
