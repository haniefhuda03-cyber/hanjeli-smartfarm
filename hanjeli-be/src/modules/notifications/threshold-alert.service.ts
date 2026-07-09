import {
  Inject,
  Injectable,
  Logger,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppCacheService } from '../../common/cache/app-cache.service.js';
import { NotificationCategory } from '../../common/constants/domain.constants.js';
import { SensorTelemetry } from '../../entities/sensor-telemetry.entity.js';
import { User } from '../../entities/user.entity.js';
import { UserNotificationPref } from '../../entities/user-notification-pref.entity.js';
import { UserSensorThreshold } from '../../entities/user-sensor-threshold.entity.js';
import { AuthEmailService } from '../auth/auth-email.service.js';
import {
  CreateNotificationInput,
  NotificationsService,
} from './notifications.service.js';

/** TTL cache threshold/pref — data preferensi jarang berubah */
const PREF_CACHE_TTL_SECONDS = 60;
/** Jeda minimal antar alert untuk parameter yang sama (anti-spam) */
const ALERT_DEDUPE_TTL_SECONDS = 15 * 60;

interface ParamDisplay {
  label: string;
  unit: string;
  category: NotificationCategory;
  read: (telemetry: SensorTelemetry) => number | null;
}

const PARAM_DISPLAY: Record<string, ParamDisplay> = {
  soil_temperature: {
    label: 'Suhu tanah',
    unit: '°C',
    category: 'temperature',
    read: (t) => t.soil_temperature,
  },
  soil_moisture: {
    label: 'Kelembapan tanah',
    unit: '%',
    category: 'soil',
    read: (t) => t.soil_moisture,
  },
  ph: {
    label: 'pH tanah',
    unit: '',
    category: 'ph',
    read: (t) => t.ph_level,
  },
  soil_nitrogen: {
    label: 'Nitrogen (N) tanah',
    unit: ' mg/kg',
    category: 'soil',
    read: (t) => t.soil_nitrogen,
  },
  soil_phosphorus: {
    label: 'Fosfor (P) tanah',
    unit: ' mg/kg',
    category: 'soil',
    read: (t) => t.soil_phosphorus,
  },
  soil_potassium: {
    label: 'Kalium (K) tanah',
    unit: ' mg/kg',
    category: 'soil',
    read: (t) => t.soil_potassium,
  },
};

/**
 * Menerbitkan notifikasi saat pembacaan sensor keluar dari ambang batas
 * yang dikonfigurasi user (user_sensor_thresholds) — sebelumnya kedua
 * tabel preferensi ini tersimpan tapi tidak pernah dipakai oleh alur apa pun.
 */
@Injectable()
export class ThresholdAlertService {
  private readonly logger = new Logger(ThresholdAlertService.name);

  constructor(
    @InjectRepository(UserSensorThreshold)
    private readonly thresholdRepository: Repository<UserSensorThreshold>,
    @InjectRepository(UserNotificationPref)
    private readonly notifPrefRepository: Repository<UserNotificationPref>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => AuthEmailService))
    private readonly emailService: AuthEmailService,
    @Optional()
    private readonly cache?: AppCacheService,
  ) {}

  /**
   * Kirim satu alert lewat channel yang diaktifkan user:
   *  - push  → row `notifications` + event WS `notification:new`
   *  - email → SMTP (kegagalan email tidak mengganggu pipeline sensor)
   */
  async dispatchAlert(
    userId: string,
    prefCategory: 'sensor' | 'irrigation' | 'system',
    input: CreateNotificationInput,
  ): Promise<void> {
    const [pushEnabled, emailEnabled] = await Promise.all([
      this.isChannelEnabled(userId, prefCategory, 'push'),
      this.isChannelEnabled(userId, prefCategory, 'email'),
    ]);

    if (pushEnabled) {
      await this.notificationsService.createAndBroadcast(userId, input);
    }

    if (emailEnabled) {
      try {
        const user = await this.usersRepository.findOne({
          where: { id: userId },
        });
        if (user?.email) {
          await this.emailService.sendNotificationEmail(
            user.email,
            input.title,
            input.description ?? '',
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Gagal mengirim email notifikasi: ${message}`);
      }
    }
  }

  async evaluateTelemetry(
    userId: string,
    telemetry: SensorTelemetry,
  ): Promise<void> {
    try {
      const thresholds = await this.getThresholds(userId);

      for (const threshold of thresholds) {
        const display = PARAM_DISPLAY[threshold.parameter_key];
        if (!display) continue;

        const value = display.read(telemetry);
        if (value === null) continue;
        if (value >= threshold.min_value && value <= threshold.max_value) {
          continue;
        }

        const dedupeKey = `notif:alert:${userId}:${threshold.parameter_key}`;
        if (await this.cache?.get(dedupeKey)) continue;
        await this.cache?.set(dedupeKey, '1', ALERT_DEDUPE_TTL_SECONDS);

        const direction = value < threshold.min_value ? 'di bawah' : 'di atas';
        await this.dispatchAlert(userId, 'sensor', {
          title: `${display.label} di luar ambang batas`,
          description: `${display.label} terbaca ${value}${display.unit}, ${direction} rentang aman ${threshold.min_value}–${threshold.max_value}${display.unit}.`,
          type: 'warning',
          category: display.category,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Gagal mengevaluasi threshold alert: ${message}`);
    }
  }

  /** Cek preferensi channel notifikasi user (default: push aktif, email mati) */
  async isChannelEnabled(
    userId: string,
    category: 'sensor' | 'irrigation' | 'system',
    channel: 'push' | 'email',
  ): Promise<boolean> {
    const cacheKey = `notifprefs:${userId}:${category}:${channel}`;
    const cached = await this.cache?.get<boolean>(cacheKey);
    if (cached !== null && cached !== undefined) return cached;

    const pref = await this.notifPrefRepository.findOne({
      where: { user_id: userId, category, channel },
    });
    const enabled = pref?.enabled ?? channel === 'push';

    await this.cache?.set(cacheKey, enabled, PREF_CACHE_TTL_SECONDS);
    return enabled;
  }

  private async getThresholds(userId: string): Promise<UserSensorThreshold[]> {
    const cacheKey = `thresholds:${userId}`;
    const cached = await this.cache?.get<UserSensorThreshold[]>(cacheKey);
    if (cached) return cached;

    const thresholds = await this.thresholdRepository.find({
      where: { user_id: userId },
    });

    await this.cache?.set(cacheKey, thresholds, PREF_CACHE_TTL_SECONDS);
    return thresholds;
  }
}
