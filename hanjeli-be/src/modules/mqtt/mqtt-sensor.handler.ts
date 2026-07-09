import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppCacheService } from '../../common/cache/app-cache.service.js';
import { Device } from '../../entities/device.entity.js';
import { SensorTelemetry } from '../../entities/sensor-telemetry.entity.js';
import { IrrigationEngine } from '../irrigation/irrigation.engine.js';
import { ThresholdAlertService } from '../notifications/threshold-alert.service.js';
import { SensorGateway } from '../websocket/sensor.gateway.js';
import { MqttService } from './mqtt.service.js';

interface NormalizedSensorPayload {
  /** Waktu pengiriman dari ESP32 (`ts`) — wajib; payload tanpa ts ditolak */
  sent_at: Date | undefined;
  ph_level: number | null;
  soil_moisture: number | null;
  soil_nitrogen: number | null;
  soil_phosphorus: number | null;
  soil_potassium: number | null;
  soil_temperature: number | null;
  /** Kondisi hujan dari sensor hujan ESP32 (null bila tidak dilaporkan) */
  is_raining: boolean | null;
}

/** Rentang valid per parameter — selaras dengan CHECK constraint di schema-init */
const SENSOR_VALUE_RANGES: Record<
  'ph_level' | 'soil_moisture' | 'soil_nitrogen' | 'soil_phosphorus' | 'soil_potassium' | 'soil_temperature',
  { min: number; max: number }
> = {
  ph_level: { min: 0, max: 14 },
  soil_moisture: { min: 0, max: 100 },
  soil_nitrogen: { min: 0, max: Number.POSITIVE_INFINITY },
  soil_phosphorus: { min: 0, max: Number.POSITIVE_INFINITY },
  soil_potassium: { min: 0, max: Number.POSITIVE_INFINITY },
  soil_temperature: { min: -50, max: 80 },
};

@Injectable()
export class MqttSensorHandler implements OnModuleInit {
  private readonly logger = new Logger(MqttSensorHandler.name);

  constructor(
    private readonly mqttService: MqttService,
    @InjectRepository(SensorTelemetry)
    private readonly telemetryRepository: Repository<SensorTelemetry>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly irrigationEngine: IrrigationEngine,
    @Inject(forwardRef(() => SensorGateway))
    private readonly sensorGateway: SensorGateway,
    @Inject(forwardRef(() => ThresholdAlertService))
    private readonly thresholdAlerts: ThresholdAlertService,
    @Optional()
    private readonly cache?: AppCacheService,
  ) {}

  onModuleInit(): void {
    const topics = this.mqttService.getTopicConfig();
    this.mqttService.registerHandler(
      topics.sensor,
      this.handleSensorData.bind(this),
    );
    this.mqttService.registerHandler(
      topics.legacySensor,
      this.handleSensorData.bind(this),
    );
    this.mqttService.registerHandler(
      topics.deviceStatus,
      this.handleDeviceStatus.bind(this),
    );
  }

  async handleSensorData(
    topic: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const deviceCode = this.extractSensorDeviceCode(topic, payload);
    if (!deviceCode) {
      this.logger.warn(`Sensor message without device code ignored: ${topic}`);
      return;
    }

    try {
      const device = await this.deviceRepository.findOne({
        where: { code: deviceCode },
      });
      if (!device) {
        this.logger.warn(
          `Telemetry for unknown device code ignored: ${deviceCode}`,
        );
        return;
      }

      const normalized = this.normalizeSensorPayload(payload);
      if (!normalized.sent_at) {
        this.logger.warn(
          `Telemetry tanpa timestamp perangkat (ts) ditolak: ${deviceCode}`,
        );
        return;
      }

      device.status = 'online';
      device.last_seen_at = normalized.sent_at;
      device.warning_message = null;
      await this.deviceRepository.save(device);

      const telemetry = this.telemetryRepository.create({
        device_id: device.id,
        captured_at: normalized.sent_at,
        sent_at: normalized.sent_at,
        ph_level: normalized.ph_level,
        soil_moisture: normalized.soil_moisture,
        soil_nitrogen: normalized.soil_nitrogen,
        soil_phosphorus: normalized.soil_phosphorus,
        soil_potassium: normalized.soil_potassium,
        soil_temperature: normalized.soil_temperature,
        is_raining: normalized.is_raining,
      });
      const saved = await this.telemetryRepository.save(telemetry);

      await this.irrigationEngine.processSensorData(
        device.user_id,
        device.id,
        saved,
      );
      await this.invalidateSensorCaches(device.user_id);
      /* Key payload harus sama dengan yang dibaca frontend (RealtimeSensorPayload) */
      this.sensorGateway.broadcastTelemetry(device.user_id, device.code, {
        ph: saved.ph_level,
        soil_moisture: saved.soil_moisture,
        nitrogen: saved.soil_nitrogen,
        phosphorus: saved.soil_phosphorus,
        potassium: saved.soil_potassium,
        soil_temperature: saved.soil_temperature,
        is_raining: saved.is_raining,
        sent_at: saved.sent_at.toISOString(),
        ts: saved.sent_at.getTime(),
      });
      await this.thresholdAlerts.evaluateTelemetry(device.user_id, saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process sensor data: ${message}`);
    }
  }

  async handleDeviceStatus(
    topic: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const parts = topic.split('/');
    const deviceCode = this.normalizeCode(String(payload.code ?? parts[2] ?? ''));
    if (!deviceCode) return;

    const device = await this.deviceRepository.findOne({
      where: { code: deviceCode },
    });
    if (!device) {
      this.logger.warn(`Status for unknown device code ignored: ${deviceCode}`);
      return;
    }

    const nextStatus =
      payload.status === 'warning' || payload.status === 'offline'
        ? payload.status
        : 'online';
    const lastSeen = this.timestampToDate(payload.ts) ?? new Date();

    device.status = nextStatus;
    device.last_seen_at = lastSeen;
    device.warning_message =
      typeof payload.message === 'string' ? payload.message : null;
    await this.deviceRepository.save(device);
    await this.cache?.invalidate([
      `devices:${device.user_id}`,
      `devices:${device.user_id}:*`,
    ]);

    this.sensorGateway.broadcastDeviceStatus(
      device.user_id,
      device.code,
      nextStatus,
      lastSeen,
    );
  }

  private extractSensorDeviceCode(
    topic: string,
    payload: Record<string, unknown>,
  ): string | null {
    const parts = topic.split('/');
    const topicCode = parts[1] === 'sensor' ? parts[2] : parts[1];
    return this.normalizeCode(String(payload.code ?? topicCode ?? '')) || null;
  }

  private normalizeSensorPayload(
    payload: Record<string, unknown>,
  ): NormalizedSensorPayload {
    const normalized: NormalizedSensorPayload = {
      sent_at: this.timestampToDate(payload.ts),
      ph_level: this.toNumber(payload.ph ?? payload.ph_level),
      soil_moisture: this.toNumber(payload.moisture ?? payload.soil_moisture),
      soil_nitrogen: this.toNumber(
        payload.nitrogen ?? payload.soil_nitrogen ?? payload.n,
      ),
      soil_phosphorus: this.toNumber(
        payload.phosphorus ?? payload.soil_phosphorus ?? payload.p,
      ),
      soil_potassium: this.toNumber(
        payload.potassium ?? payload.soil_potassium ?? payload.k,
      ),
      soil_temperature: this.toNumber(
        payload.temp ?? payload.temperature ?? payload.soil_temperature,
      ),
      is_raining: this.toBooleanOrNull(
        payload.rain ?? payload.is_raining ?? payload.raining,
      ),
    };

    return this.clampOutOfRangeValues(normalized);
  }

  /**
   * Nilai di luar rentang CHECK di-null-kan per-field (dengan warn),
   * sehingga satu sensor rusak tidak membuang seluruh reading.
   */
  private clampOutOfRangeValues(
    payload: NormalizedSensorPayload,
  ): NormalizedSensorPayload {
    for (const key of Object.keys(SENSOR_VALUE_RANGES) as Array<
      keyof typeof SENSOR_VALUE_RANGES
    >) {
      const value = payload[key];
      if (value === null) continue;

      const { min, max } = SENSOR_VALUE_RANGES[key];
      if (value < min || value > max) {
        this.logger.warn(
          `Nilai ${key}=${value} di luar rentang [${min}, ${max}] — disimpan sebagai NULL`,
        );
        payload[key] = null;
      }
    }

    return payload;
  }

  /**
   * Konversi `ts` perangkat ke Date. Menerima epoch milidetik maupun detik
   * (heuristik: nilai < 1e12 dianggap detik). Timestamp mustahil
   * (sebelum 2020 atau > 1 jam di masa depan) dianggap tidak valid.
   */
  private timestampToDate(value: unknown): Date | undefined {
    if (value === undefined || value === null) return undefined;

    let timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;

    if (timestamp < 1e12) {
      timestamp *= 1000;
    }

    const MIN_VALID_MS = Date.UTC(2020, 0, 1);
    const maxValidMs = Date.now() + 60 * 60 * 1000;
    if (timestamp < MIN_VALID_MS || timestamp > maxValidMs) return undefined;

    return new Date(timestamp);
  }

  private toNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /** Terima boolean, 0/1, "0"/"1", "true"/"false" — selain itu null */
  private toBooleanOrNull(value: unknown): boolean | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return null;
  }

  private normalizeCode(code: string): string {
    return code.trim().replace(/^#/, '').toUpperCase();
  }

  private async invalidateSensorCaches(userId: string): Promise<void> {
    await this.cache?.invalidate([
      `sensor:latest:${userId}`,
      `sensor:overview:${userId}`,
      `sensor:quality:${userId}`,
      `sensor:trend:${userId}:*`,
      `sensor:stats:${userId}:*`,
      `sensor:history:${userId}:*`,
      `devices:${userId}`,
      `devices:${userId}:*`,
    ]);
  }
}
