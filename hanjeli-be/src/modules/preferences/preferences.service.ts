import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppCacheService } from '../../common/cache/app-cache.service.js';
import {
  MEASUREMENT_UNIT_OPTIONS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PREF_CATEGORIES,
} from '../../common/constants/domain.constants.js';
import { UserMeasurementUnit } from '../../entities/user-measurement-unit.entity.js';
import { UserNotificationPref } from '../../entities/user-notification-pref.entity.js';
import { UserPreference } from '../../entities/user-preference.entity.js';
import { UserSensorThreshold } from '../../entities/user-sensor-threshold.entity.js';
import { UpdateNotificationPrefDto } from './dto/update-notification-pref.dto.js';
import { UpdatePreferenceDto } from './dto/update-preference.dto.js';
import { UpdateSensorThresholdDto } from './dto/update-sensor-threshold.dto.js';
import { UpdateUnitDto } from './dto/update-unit.dto.js';

/* Label default selaras dengan yang ditampilkan API sensor & frontend
   ('soil_npk' = grup unit bersama untuk ketiga nilai N, P, K) */
const DEFAULT_UNITS = [
  { parameter_key: 'soil_temperature', unit_value: '°C' },
  { parameter_key: 'soil_moisture', unit_value: '%' },
  { parameter_key: 'ph', unit_value: 'pH' },
  { parameter_key: 'soil_npk', unit_value: 'mg/kg' },
] as const;

const DEFAULT_THRESHOLDS = [
  { parameter_key: 'soil_temperature', min_value: 20, max_value: 35 },
  { parameter_key: 'soil_moisture', min_value: 30, max_value: 80 },
  { parameter_key: 'ph', min_value: 5.5, max_value: 7.5 },
  { parameter_key: 'soil_nitrogen', min_value: 20, max_value: 60 },
  { parameter_key: 'soil_phosphorus', min_value: 20, max_value: 60 },
  { parameter_key: 'soil_potassium', min_value: 20, max_value: 60 },
] as const;

@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(UserPreference)
    private readonly userPrefRepository: Repository<UserPreference>,
    @InjectRepository(UserMeasurementUnit)
    private readonly unitRepository: Repository<UserMeasurementUnit>,
    @InjectRepository(UserNotificationPref)
    private readonly notifPrefRepository: Repository<UserNotificationPref>,
    @InjectRepository(UserSensorThreshold)
    private readonly thresholdRepository: Repository<UserSensorThreshold>,
    @Optional()
    private readonly cache?: AppCacheService,
  ) {}

  async findAll(userId: string) {
    const preference = await this.ensurePreference(userId);
    await this.ensureDefaults(userId, preference.id);

    const [units, notificationPrefs, thresholds] = await Promise.all([
      this.unitRepository.find({
        where: { preference_id: preference.id },
        order: { parameter_key: 'ASC' },
      }),
      this.notifPrefRepository.find({
        where: { user_id: userId },
        order: { category: 'ASC', channel: 'ASC' },
      }),
      this.thresholdRepository.find({
        where: { user_id: userId },
        order: { parameter_key: 'ASC' },
      }),
    ]);

    return {
      preference,
      units,
      notification_prefs: notificationPrefs,
      sensor_thresholds: thresholds,
    };
  }

  async updatePreference(userId: string, dto: UpdatePreferenceDto) {
    const pref = await this.ensurePreference(userId);

    if (dto.language !== undefined) pref.language = dto.language;
    if (dto.notifications_enabled !== undefined) {
      pref.notifications_enabled = dto.notifications_enabled;
    }

    return this.userPrefRepository.save(pref);
  }

  async updateUnit(userId: string, dto: UpdateUnitDto) {
    this.assertUnitValue(dto.parameter_key, dto.unit_value);
    const pref = await this.ensurePreference(userId);
    let unit = await this.unitRepository.findOne({
      where: { preference_id: pref.id, parameter_key: dto.parameter_key },
    });

    if (!unit) {
      unit = this.unitRepository.create({
        preference_id: pref.id,
        parameter_key: dto.parameter_key,
      });
    }

    unit.unit_value = dto.unit_value;
    return this.unitRepository.save(unit);
  }

  async updateNotificationPref(userId: string, dto: UpdateNotificationPrefDto) {
    let pref = await this.notifPrefRepository.findOne({
      where: { user_id: userId, category: dto.category, channel: dto.channel },
    });

    if (!pref) {
      pref = this.notifPrefRepository.create({
        user_id: userId,
        category: dto.category,
        channel: dto.channel,
      });
    }

    pref.enabled = dto.enabled;
    const saved = await this.notifPrefRepository.save(pref);
    /* Cache preferensi push dipakai ThresholdAlertService/irigasi */
    await this.cache?.invalidate([`notifprefs:${userId}:*`]);
    return saved;
  }

  async updateSensorThreshold(userId: string, dto: UpdateSensorThresholdDto) {
    if (dto.min_value >= dto.max_value) {
      throw new BadRequestException(
        'min_value harus lebih kecil dari max_value',
      );
    }

    let threshold = await this.thresholdRepository.findOne({
      where: { user_id: userId, parameter_key: dto.parameter_key },
    });

    if (!threshold) {
      threshold = this.thresholdRepository.create({
        user_id: userId,
        parameter_key: dto.parameter_key,
      });
    }

    threshold.min_value = dto.min_value;
    threshold.max_value = dto.max_value;

    const saved = await this.thresholdRepository.save(threshold);
    /* Cache threshold dipakai ThresholdAlertService saat evaluasi telemetry */
    await this.cache?.invalidate([`thresholds:${userId}`]);
    return saved;
  }

  private async ensurePreference(userId: string): Promise<UserPreference> {
    const existing = await this.userPrefRepository.findOne({
      where: { user_id: userId },
    });

    if (existing) {
      return existing;
    }

    return this.userPrefRepository.save(
      this.userPrefRepository.create({
        user_id: userId,
        language: 'id',
        notifications_enabled: true,
      }),
    );
  }

  private async ensureDefaults(
    userId: string,
    preferenceId: string,
  ): Promise<void> {
    const [unitCount, notifCount, thresholdCount] = await Promise.all([
      this.unitRepository.count({ where: { preference_id: preferenceId } }),
      this.notifPrefRepository.count({ where: { user_id: userId } }),
      this.thresholdRepository.count({ where: { user_id: userId } }),
    ]);

    if (unitCount === 0) {
      await this.unitRepository.save(
        DEFAULT_UNITS.map((unit) =>
          this.unitRepository.create({
            preference_id: preferenceId,
            ...unit,
          }),
        ),
      );
    }

    if (notifCount === 0) {
      const defaults = NOTIFICATION_PREF_CATEGORIES.flatMap((category) =>
        NOTIFICATION_CHANNELS.map((channel) =>
          this.notifPrefRepository.create({
            user_id: userId,
            category,
            channel,
            enabled: channel === 'push',
          }),
        ),
      );
      await this.notifPrefRepository.save(defaults);
    }

    if (thresholdCount === 0) {
      await this.thresholdRepository.save(
        DEFAULT_THRESHOLDS.map((threshold) =>
          this.thresholdRepository.create({
            user_id: userId,
            ...threshold,
          }),
        ),
      );
    }
  }

  private assertUnitValue(parameterKey: string, unitValue: string): void {
    const allowedUnits = MEASUREMENT_UNIT_OPTIONS[parameterKey];

    if (!allowedUnits?.includes(unitValue)) {
      throw new BadRequestException(
        `Unit ${unitValue} tidak valid untuk ${parameterKey}`,
      );
    }
  }
}
