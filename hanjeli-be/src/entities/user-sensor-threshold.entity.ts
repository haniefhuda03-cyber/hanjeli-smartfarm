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
 * User-defined sensor alert thresholds per parameter.
 *
 * Normalized from frontend JSONB state to satisfy 1NF–BCNF.
 * Each row stores ONE parameter → (min_value, max_value) pair.
 * Max 6 rows per user (soil_temperature, soil_moisture, ph, soil_nitrogen, soil_phosphorus, soil_potassium).
 *
 * Note: `unit` is NOT stored here — it's in user_measurement_units.
 *       Storing it here would violate 3NF (transitive: parameter_key → unit).
 *
 * BCNF proof:
 *   CK₁: {id}
 *   CK₂: {user_id, parameter_key}
 *   FD: CK → {min_value, max_value} (all non-key attrs depend on CK)
 *
 * CHECK: min_value < max_value (applied via migration)
 * ON DELETE CASCADE — thresholds are deleted when user is deleted.
 */
@Entity('user_sensor_thresholds')
@Unique('uq_user_sensor_param', ['user_id', 'parameter_key'])
export class UserSensorThreshold {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_user_sensor_thresholds_user_id')
  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  /**
   * Sensor parameter key.
   * CHECK: 'soil_temperature' | 'soil_moisture' | 'ph' | 'soil_nitrogen' | 'soil_phosphorus' | 'soil_potassium'
   */
  @Column({ type: 'varchar', length: 30, nullable: false })
  parameter_key!: string;

  /** Lower bound of safe range — CHECK: min_value < max_value */
  @Column({ type: 'float8', nullable: false })
  min_value!: number;

  /** Upper bound of safe range — CHECK: min_value < max_value */
  @Column({ type: 'float8', nullable: false })
  max_value!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  // ─── Relations ───

  @ManyToOne(() => User, (user) => user.sensor_thresholds, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
