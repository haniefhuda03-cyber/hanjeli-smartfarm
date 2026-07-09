import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity.js';
import { UserMeasurementUnit } from './user-measurement-unit.entity.js';

@Entity('user_preferences')
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_user_preferences_user_id', { unique: true })
  @Column({ type: 'uuid', nullable: false, unique: true })
  user_id!: string;

  @Column({ type: 'varchar', length: 5, nullable: false, default: 'id' })
  language!: string;

  @Column({ type: 'boolean', nullable: false, default: true })
  notifications_enabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  // ─── Relations ───

  @OneToOne(() => User, (user) => user.preference, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => UserMeasurementUnit, (unit) => unit.preference)
  measurement_units!: UserMeasurementUnit[];
}
