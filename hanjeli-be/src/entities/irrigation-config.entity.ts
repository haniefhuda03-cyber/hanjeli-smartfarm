import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity.js';

@Entity('irrigation_configs')
export class IrrigationConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_irrigation_configs_user_id', { unique: true })
  @Column({ type: 'uuid', nullable: false, unique: true })
  user_id!: string;

  /**
   * Active irrigation mode.
   * ENUM: 'auto' | 'manual' | 'scheduled' | 'off'
   * CHECK constraint applied via migration.
   */
  @Column({ type: 'varchar', length: 20, nullable: false, default: 'off' })
  active_mode!: string;

  @Column({ type: 'boolean', nullable: false, default: false })
  emergency_stop!: boolean;

  /**
   * Auto-mode sensor parameter.
   * CHECK: 'soil_moisture' | 'ph' | 'soil_temperature' | 'soil_nitrogen' | 'soil_phosphorus' | 'soil_potassium'
   */
  @Column({
    type: 'varchar',
    length: 30,
    nullable: false,
    default: 'soil_moisture',
  })
  auto_parameter!: string;

  /** Threshold value for auto mode — CHECK: >= 0 */
  @Column({ type: 'float8', nullable: false, default: 40 })
  auto_threshold_value!: number;

  /** Threshold direction — CHECK: 'below' | 'above' */
  @Column({ type: 'varchar', length: 10, nullable: false, default: 'below' })
  auto_threshold_direction!: string;

  /** Water control range based on soil moisture. */
  @Column({ type: 'float8', nullable: false, default: 30 })
  water_min_threshold!: number;

  @Column({ type: 'float8', nullable: false, default: 80 })
  water_max_threshold!: number;

  /** NPK control range based on soil NPK readings. */
  @Column({ type: 'float8', nullable: false, default: 60 })
  npk_min_threshold!: number;

  @Column({ type: 'float8', nullable: false, default: 180 })
  npk_max_threshold!: number;

  @Column({ type: 'float8', nullable: false, default: 20 })
  nitrogen_min_threshold!: number;

  @Column({ type: 'float8', nullable: false, default: 60 })
  nitrogen_max_threshold!: number;

  @Column({ type: 'float8', nullable: false, default: 20 })
  phosphorus_min_threshold!: number;

  @Column({ type: 'float8', nullable: false, default: 60 })
  phosphorus_max_threshold!: number;

  @Column({ type: 'float8', nullable: false, default: 20 })
  potassium_min_threshold!: number;

  @Column({ type: 'float8', nullable: false, default: 60 })
  potassium_max_threshold!: number;

  @Column({ type: 'boolean', nullable: false, default: false })
  manual_water_enabled!: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  manual_fertilizer_enabled!: boolean;

  /** Manual speed 0–100% — CHECK: >= 0 AND <= 100 */
  @Column({ type: 'int', nullable: false, default: 100 })
  manual_speed!: number;

  @Column({ type: 'int', nullable: false, default: 100 })
  fertilizer_manual_speed!: number;

  /** Scheduled behavior — CHECK: 'manual' | 'auto' */
  @Column({ type: 'varchar', length: 10, nullable: false, default: 'manual' })
  scheduled_behavior!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  // ─── Relations ───

  @OneToOne(() => User, (user) => user.irrigation_config, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
