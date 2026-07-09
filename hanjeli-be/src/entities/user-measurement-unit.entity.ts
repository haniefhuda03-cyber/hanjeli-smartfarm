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
import { UserPreference } from './user-preference.entity.js';

/**
 * Normalized from user_preferences.measurement_units jsonb to satisfy 1NF.
 * Each row stores ONE parameter-unit pair (max 6 rows per user).
 * ON DELETE CASCADE — units are deleted when preference is deleted.
 */
@Entity('user_measurement_units')
@Unique('uq_preference_parameter', ['preference_id', 'parameter_key'])
export class UserMeasurementUnit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_user_measurement_units_pref_id')
  @Column({ type: 'uuid', nullable: false })
  preference_id!: string;

  /**
   * Sensor parameter key.
   * Valid: 'soil_temperature','soil_moisture','ph','soil_npk'
   */
  @Column({ type: 'varchar', length: 30, nullable: false })
  parameter_key!: string;

  /** Selected unit value, e.g. '°C', '%VWC', 'dS/m', 'mg/kg', '% RH' */
  @Column({ type: 'varchar', length: 20, nullable: false })
  unit_value!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  // ─── Relations ───

  @ManyToOne(() => UserPreference, (pref) => pref.measurement_units, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'preference_id' })
  preference!: UserPreference;
}
