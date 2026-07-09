import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity.js';

/**
 * Irrigation schedule with 7 boolean day-columns (1NF compliant).
 * Replaced text[] days array with individual boolean columns.
 * CHECK constraint: start_time < end_time applied via migration.
 */
@Entity('irrigation_schedules')
export class IrrigationSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_irrigation_schedules_user_id')
  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  // ─── Day columns (1NF: atomic boolean per day) ───

  @Column({ type: 'boolean', nullable: false, default: false })
  mon!: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  tue!: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  wed!: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  thu!: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  fri!: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  sat!: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  sun!: boolean;

  // ─── Time range ───

  @Column({ type: 'time', nullable: false })
  start_time!: string;

  @Column({ type: 'time', nullable: false })
  end_time!: string;

  @Column({ type: 'boolean', nullable: false, default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  // ─── Relations ───

  @ManyToOne(() => User, (user) => user.irrigation_schedules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
