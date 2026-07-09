import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity.js';
import { SensorTelemetry } from './sensor-telemetry.entity.js';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_devices_user_id')
  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ type: 'varchar', length: 200, nullable: false })
  name!: string;

  @Index('idx_devices_code', { unique: true })
  @Column({ type: 'varchar', length: 20, nullable: false, unique: true })
  code!: string;

  /**
   * Device type.
   * PostgreSQL ENUM: 'sensor' | 'pump' | 'camera'
   * CHECK constraint applied via migration.
   */
  @Column({ type: 'varchar', length: 20, nullable: false })
  type!: string;

  /**
   * Connection status.
   * PostgreSQL ENUM: 'online' | 'warning' | 'offline'
   * CHECK constraint applied via migration.
   */
  @Column({ type: 'varchar', length: 20, nullable: false, default: 'offline' })
  status!: string;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  last_seen_at!: Date | null;

  @Column({ type: 'text', nullable: true, default: null })
  warning_message!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  // ─── Relations ───

  @ManyToOne(() => User, (user) => user.devices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => SensorTelemetry, (telemetry) => telemetry.device)
  telemetry!: SensorTelemetry[];
}
