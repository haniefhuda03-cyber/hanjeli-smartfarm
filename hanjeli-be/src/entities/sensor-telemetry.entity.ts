import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Device } from './device.entity.js';

/**
 * Time-series sensor data — TimescaleDB HYPERTABLE.
 *
 * Desain per-parameter (4 kelompok sensor tanah):
 *   1. ph_level          — pH tanah (0–14)
 *   2. soil_moisture     — kelembapan tanah (0–100 %)
 *   3. soil_nitrogen / soil_phosphorus / soil_potassium
 *                        — N, P, K TERPISAH (mg/kg); tidak ada agregat NPK
 *   4. soil_temperature  — suhu tanah (−50…80 °C)
 *
 * Konteks pengukuran:
 *   - sent_at    — waktu pengiriman dari ESP32 (field `ts`) — WAJIB, tanpa
 *                  default; reading tanpa timestamp perangkat ditolak handler
 *   - is_raining — kondisi hujan saat data diambil (sensor hujan ESP32;
 *                  NULL bila tidak dilaporkan)
 *
 * Keputusan lain:
 *   - BIGSERIAL PK (bukan UUID) untuk performa tulis tinggi
 *   - ON DELETE CASCADE device_id — hard delete ikut menghapus riwayat
 *   - CHECK constraint nilai diterapkan via schema-init
 *   - Partition key hypertable: captured_at
 */
@Entity('sensor_telemetry')
@Index('idx_sensor_telemetry_device_time', ['device_id', 'captured_at'])
export class SensorTelemetry {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string; // bigint returned as string by pg driver

  @Column({ type: 'uuid', nullable: false })
  device_id!: string;

  @Column({ type: 'timestamptz', nullable: false })
  captured_at!: Date;

  /** Waktu pengiriman dari ESP32 (field `ts` payload MQTT) — wajib, tanpa default */
  @Column({ type: 'timestamptz', nullable: false })
  sent_at!: Date;

  /** pH Tanah — 0–14 */
  @Column({ type: 'float8', nullable: true })
  ph_level!: number | null;

  /** Kelembapan Tanah — 0–100 % */
  @Column({ type: 'float8', nullable: true })
  soil_moisture!: number | null;

  /** Nitrogen tanah — ≥ 0 mg/kg */
  @Column({ type: 'float8', nullable: true })
  soil_nitrogen!: number | null;

  /** Fosfor tanah — ≥ 0 mg/kg */
  @Column({ type: 'float8', nullable: true })
  soil_phosphorus!: number | null;

  /** Kalium tanah — ≥ 0 mg/kg */
  @Column({ type: 'float8', nullable: true })
  soil_potassium!: number | null;

  /** Suhu Tanah — −50…80 °C */
  @Column({ type: 'float8', nullable: true })
  soil_temperature!: number | null;

  /** Kondisi hujan saat data diambil (dari sensor hujan ESP32) */
  @Column({ type: 'boolean', nullable: true })
  is_raining!: boolean | null;

  // ─── Relations ───

  @ManyToOne(() => Device, (device) => device.telemetry, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'device_id' })
  device!: Device;
}
