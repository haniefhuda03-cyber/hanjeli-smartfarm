import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IrrigationActivityLog } from '../../entities/irrigation-activity-log.entity.js';
import { IrrigationConfig } from '../../entities/irrigation-config.entity.js';
import { SensorTelemetry } from '../../entities/sensor-telemetry.entity.js';
import { IrrigationCommandPayload, MqttService } from '../mqtt/mqtt.service.js';
import { ThresholdAlertService } from '../notifications/threshold-alert.service.js';

const DEFAULT_WATER_MIN_THRESHOLD = 30;
const DEFAULT_WATER_MAX_THRESHOLD = 80;
const DEFAULT_NUTRIENT_MIN_THRESHOLD = 20;
const DEFAULT_NUTRIENT_MAX_THRESHOLD = 60;

type PumpChannel = 'water' | 'fertilizer';
type NutrientStatus = 'missing' | 'low' | 'normal' | 'high';

@Injectable()
export class IrrigationEngine {
  private readonly logger = new Logger(IrrigationEngine.name);
  private readonly lastPumpState = new Map<string, boolean>();
  private readonly lastFertilizerPumpState = new Map<string, boolean>();
  private readonly lastNpkState = new Map<string, NutrientStatus>();

  constructor(
    @InjectRepository(IrrigationConfig)
    private readonly configRepository: Repository<IrrigationConfig>,
    @InjectRepository(IrrigationActivityLog)
    private readonly activityRepository: Repository<IrrigationActivityLog>,
    @Inject(forwardRef(() => MqttService))
    private readonly mqttService: MqttService,
    @Inject(forwardRef(() => ThresholdAlertService))
    private readonly thresholdAlerts: ThresholdAlertService,
  ) {}

  async processSensorData(
    userId: string,
    deviceId: string,
    telemetry: SensorTelemetry,
  ): Promise<void> {
    try {
      const config = await this.configRepository.findOne({
        where: { user_id: userId },
      });
      if (!config) return;

      if (config.emergency_stop) {
        await this.sendCommand(
          userId,
          deviceId,
          false,
          'Emergency stop aktif sehingga pompa air dipastikan mati',
          config,
          'water',
          true,
          'EMERGENCY_STOP',
        );
        await this.sendCommand(
          userId,
          deviceId,
          false,
          'Emergency stop aktif sehingga pompa pupuk dipastikan mati',
          config,
          'fertilizer',
          true,
          'EMERGENCY_STOP',
        );
        return;
      }

      if (config.active_mode !== 'auto') return;

      await this.evaluateAutoMode(userId, deviceId, config, telemetry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in irrigation engine: ${message}`);
    }
  }

  private async evaluateAutoMode(
    userId: string,
    deviceId: string,
    config: IrrigationConfig,
    telemetry: SensorTelemetry,
  ): Promise<void> {
    const moistureValue = this.toFiniteNumber(telemetry.soil_moisture);
    let waterDecision: { shouldTurnOn: boolean; reason: string } | null = null;

    if (moistureValue !== null) {
      const waterMin = this.numberOrFallback(
        config.water_min_threshold,
        DEFAULT_WATER_MIN_THRESHOLD,
      );
      const waterMax = this.numberOrFallback(
        config.water_max_threshold,
        DEFAULT_WATER_MAX_THRESHOLD,
      );
      const currentPumpState = this.lastPumpState.get(deviceId) ?? false;
      let shouldTurnOn = currentPumpState;
      let waterStatus = `berada di rentang target ${waterMin}-${waterMax}%`;

      if (moistureValue < waterMin) {
        shouldTurnOn = true;
        waterStatus = `di bawah batas bawah ${waterMin}%`;
      } else if (moistureValue > waterMax) {
        shouldTurnOn = false;
        waterStatus = `di atas batas atas ${waterMax}%`;
      }

      waterDecision = {
        shouldTurnOn,
        reason: `Auto mode membaca kelembaban tanah=${moistureValue}%, ${waterStatus}`,
      };
    }

    const npkEvaluation = this.evaluateNpkStatus(config, telemetry);
    await this.logNpkStatusIfChanged(userId, deviceId, npkEvaluation);

    if (npkEvaluation.status !== 'missing') {
      if (npkEvaluation.shouldTurnOn) {
        const waterPriorityReason = waterDecision?.shouldTurnOn
          ? `${waterDecision.reason}; pompa air ditunda karena pompa pupuk diprioritaskan saat N/P/K rendah`
          : 'Pompa air dipastikan mati karena pompa pupuk diprioritaskan saat N/P/K rendah';

        await this.sendCommand(
          userId,
          deviceId,
          false,
          waterPriorityReason,
          config,
          'water',
        );
        await this.sendCommand(
          userId,
          deviceId,
          true,
          npkEvaluation.message,
          config,
          'fertilizer',
        );
        return;
      }

      await this.sendCommand(
        userId,
        deviceId,
        false,
        npkEvaluation.message,
        config,
        'fertilizer',
      );
    }

    if (waterDecision) {
      await this.sendCommand(
        userId,
        deviceId,
        waterDecision.shouldTurnOn,
        waterDecision.reason,
        config,
        'water',
      );
    }
  }

  private evaluateNpkStatus(
    config: IrrigationConfig,
    telemetry: SensorTelemetry,
  ): { status: NutrientStatus; shouldTurnOn: boolean; message: string } {
    const nutrients = [
      {
        label: 'N',
        value: this.toFiniteNumber(telemetry.soil_nitrogen),
        min: this.numberOrFallback(
          config.nitrogen_min_threshold,
          DEFAULT_NUTRIENT_MIN_THRESHOLD,
        ),
        max: this.numberOrFallback(
          config.nitrogen_max_threshold,
          DEFAULT_NUTRIENT_MAX_THRESHOLD,
        ),
      },
      {
        label: 'P',
        value: this.toFiniteNumber(telemetry.soil_phosphorus),
        min: this.numberOrFallback(
          config.phosphorus_min_threshold,
          DEFAULT_NUTRIENT_MIN_THRESHOLD,
        ),
        max: this.numberOrFallback(
          config.phosphorus_max_threshold,
          DEFAULT_NUTRIENT_MAX_THRESHOLD,
        ),
      },
      {
        label: 'K',
        value: this.toFiniteNumber(telemetry.soil_potassium),
        min: this.numberOrFallback(
          config.potassium_min_threshold,
          DEFAULT_NUTRIENT_MIN_THRESHOLD,
        ),
        max: this.numberOrFallback(
          config.potassium_max_threshold,
          DEFAULT_NUTRIENT_MAX_THRESHOLD,
        ),
      },
    ];
    const missing = nutrients.filter((nutrient) => nutrient.value === null);

    if (missing.length > 0) {
      return {
        status: 'missing',
        shouldTurnOn: false,
        message: `Data N/P/K tanah belum lengkap; target ${this.describeNutrientTargets(nutrients)}.`,
      };
    }

    const high = nutrients.filter((nutrient) => nutrient.value! > nutrient.max);
    if (high.length > 0) {
      return {
        status: 'high',
        shouldTurnOn: false,
        message: `Pompa pupuk ditahan karena ${this.describeNutrientValues(high)} di atas target. Target ${this.describeNutrientTargets(nutrients)}.`,
      };
    }

    const low = nutrients.filter((nutrient) => nutrient.value! < nutrient.min);
    if (low.length > 0) {
      return {
        status: 'low',
        shouldTurnOn: true,
        message: `Pompa pupuk diminta NYALA karena ${this.describeNutrientValues(low)} di bawah target. Target ${this.describeNutrientTargets(nutrients)}.`,
      };
    }

    return {
      status: 'normal',
      shouldTurnOn: false,
      message: `N/P/K tanah berada dalam target ${this.describeNutrientTargets(nutrients)}.`,
    };
  }

  private async logNpkStatusIfChanged(
    userId: string,
    deviceId: string,
    evaluation: { status: NutrientStatus; message: string },
  ): Promise<void> {
    if (evaluation.status === 'missing') return;

    const key = `${userId}:${deviceId}`;
    const previousStatus = this.lastNpkState.get(key);
    if (previousStatus === evaluation.status) return;

    this.lastNpkState.set(key, evaluation.status);

    if (evaluation.status === 'low' || evaluation.status === 'high') {
      await this.logActivity(
        userId,
        `Peringatan pupuk otomatis. ${evaluation.message}`,
        'warning',
      );
      await this.notifyIrrigation(userId, {
        title: 'Peringatan pupuk otomatis',
        description: evaluation.message,
        type: 'warning',
      });
      return;
    }

    if (previousStatus && previousStatus !== 'normal') {
      await this.logActivity(
        userId,
        `N/P/K tanah kembali dalam rentang. ${evaluation.message}`,
        'success',
      );
      await this.notifyIrrigation(userId, {
        title: 'N/P/K tanah kembali normal',
        description: evaluation.message,
        type: 'success',
      });
    }
  }

  /**
   * Mirror alert irigasi ke channel notifikasi yang diaktifkan user
   * (push → row + realtime; email → SMTP). Kegagalan notifikasi tidak
   * boleh mengganggu alur kontrol pompa.
   */
  private async notifyIrrigation(
    userId: string,
    input: {
      title: string;
      description: string;
      type: 'info' | 'success' | 'warning' | 'error';
    },
  ): Promise<void> {
    try {
      await this.thresholdAlerts.dispatchAlert(userId, 'irrigation', {
        ...input,
        category: 'irrigation',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Gagal mengirim notifikasi irigasi: ${message}`);
    }
  }

  private describeNutrientTargets(
    nutrients: Array<{ label: string; min: number; max: number }>,
  ): string {
    return `${nutrients
      .map((nutrient) => `${nutrient.label} ${nutrient.min}-${nutrient.max}`)
      .join(', ')} mg/kg`;
  }

  private describeNutrientValues(
    nutrients: Array<{ label: string; value: number | null }>,
  ): string {
    return nutrients
      .map((nutrient) => `${nutrient.label}=${nutrient.value} mg/kg`)
      .join(', ');
  }

  private toFiniteNumber(value: number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private numberOrFallback(
    value: number | null | undefined,
    fallback: number,
  ): number {
    const parsed = this.toFiniteNumber(value);
    return parsed ?? fallback;
  }

  private async sendCommand(
    userId: string,
    deviceId: string,
    turnOn: boolean,
    reason: string,
    config: IrrigationConfig,
    channel: PumpChannel = 'water',
    force = false,
    forcedAction?: IrrigationCommandPayload['action'],
  ): Promise<void> {
    const stateMap =
      channel === 'fertilizer'
        ? this.lastFertilizerPumpState
        : this.lastPumpState;
    const currentState = stateMap.get(deviceId) ?? false;
    if (!force && currentState === turnOn) {
      return;
    }

    stateMap.set(deviceId, turnOn);

    const rows = await this.configRepository.manager.query(
      `SELECT code FROM devices WHERE id = $1`,
      [deviceId],
    );
    const deviceCode = rows[0]?.code as string | undefined;
    const action = forcedAction ?? (turnOn ? 'START' : 'STOP');
    const speed = turnOn
      ? channel === 'fertilizer'
        ? this.numberOrFallback(config.fertilizer_manual_speed, 100)
        : this.numberOrFallback(config.manual_speed, 100)
      : 0;
    const pumpLabel = channel === 'fertilizer' ? 'pupuk' : 'air';

    await this.mqttService.publishIrrigationCommand(
      {
        action,
        mode: 'auto',
        channel,
        speed,
        device_code: deviceCode,
        user_id: userId,
      },
      {
        onTimeout: async (requestId) => {
          await this.logActivity(
            userId,
            `ESP32 belum mengirim ACK untuk perintah irigasi otomatis (${requestId}).`,
            'warning',
          );
          await this.notifyIrrigation(userId, {
            title: 'Perangkat irigasi tidak merespons',
            description: `ESP32 belum mengirim ACK untuk perintah irigasi otomatis (${requestId}).`,
            type: 'warning',
          });
        },
      },
    );

    await this.logActivity(
      userId,
      `Sistem otomatis memerintahkan pompa ${pumpLabel} ${turnOn ? 'NYALA' : 'MATI'}. ${reason}.`,
      turnOn ? 'info' : 'success',
    );
  }

  private async logActivity(
    userId: string,
    description: string,
    type: 'success' | 'info' | 'warning',
  ): Promise<void> {
    const log = this.activityRepository.create({
      user_id: userId,
      description,
      type,
    });
    await this.activityRepository.save(log);
  }
}
