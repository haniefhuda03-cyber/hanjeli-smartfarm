/**
 * Admin user seeder — ORM-based, idempotent.
 *
 * Creates the initial admin user with all required defaults:
 * - User record (Admin role, email verified)
 * - User preferences (language, notifications)
 * - Measurement units (5 parameters)
 * - Notification preferences (3 categories × 2 channels)
 * - Sensor thresholds (4 parameters)
 * - Irrigation config (default values)
 *
 * Password is received from CLI prompt, never stored in env files.
 */
import * as bcrypt from 'bcryptjs';
import type { DataSource, EntityManager } from 'typeorm';
import { User } from '../../entities/user.entity.js';
import { UserPreference } from '../../entities/user-preference.entity.js';
import { UserMeasurementUnit } from '../../entities/user-measurement-unit.entity.js';
import { UserNotificationPref } from '../../entities/user-notification-pref.entity.js';
import { UserSensorThreshold } from '../../entities/user-sensor-threshold.entity.js';
import { IrrigationConfig } from '../../entities/irrigation-config.entity.js';
import type { Seeder, SeederResult } from './seeder.interface.js';

/** Default bcrypt rounds — strong but not excessively slow */
const DEFAULT_BCRYPT_ROUNDS = 12;

/** Default admin values */
const DEFAULTS = {
  email: 'admin@hanjeli.local',
  name: 'Hanjeli Admin',
} as const;

/**
 * Measurement unit defaults — selaras dengan chk_parameter_key &
 * MEASUREMENT_UNIT_OPTIONS (EC dihapus dari semua permukaan).
 */
const MEASUREMENT_UNITS: Array<{ key: string; value: string }> = [
  { key: 'soil_temperature', value: '°C' },
  { key: 'soil_moisture', value: '%' },
  { key: 'ph', value: 'pH' },
  { key: 'soil_npk', value: 'mg/kg' },
];

/**
 * Notification preference defaults (3 categories × 2 channels = 6 rows).
 */
const NOTIFICATION_PREFS: Array<{
  category: string;
  channel: string;
  enabled: boolean;
}> = [
  { category: 'irrigation', channel: 'push', enabled: true },
  { category: 'irrigation', channel: 'email', enabled: true },
  { category: 'sensor', channel: 'push', enabled: true },
  { category: 'sensor', channel: 'email', enabled: false },
  { category: 'system', channel: 'push', enabled: true },
  { category: 'system', channel: 'email', enabled: true },
];

/**
 * Sensor threshold defaults (4 parameters).
 * These define the min/max safe range for each sensor.
 */
const SENSOR_THRESHOLDS: Array<{
  key: string;
  min: number;
  max: number;
}> = [
  { key: 'soil_temperature', min: 20, max: 35 },
  { key: 'soil_moisture', min: 30, max: 80 },
  { key: 'ph', min: 5.5, max: 7.5 },
  { key: 'soil_nitrogen', min: 20, max: 60 },
  { key: 'soil_phosphorus', min: 20, max: 60 },
  { key: 'soil_potassium', min: 20, max: 60 },
];

export class AdminSeeder implements Seeder {
  readonly name = 'AdminSeeder';

  async run(
    dataSource: DataSource,
    options?: Record<string, string>,
  ): Promise<SeederResult[]> {
    const results: SeederResult[] = [];

    const email = (options?.email ?? DEFAULTS.email).trim().toLowerCase();
    const name = (options?.name ?? DEFAULTS.name).trim();
    const password = options?.password;
    const resetPassword = options?.resetPassword === 'true';

    await dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);

      /* ── Check if admin already exists ── */
      const existing = await userRepo.findOne({ where: { email } });

      let userId: string;

      if (existing) {
        /* Admin exists — update role/verification but keep password */
        existing.name = name;
        existing.role = 'Admin';
        existing.email_verified = true;
        existing.two_factor_enabled = false;
        existing.two_factor_secret = null;

        if (resetPassword && password) {
          existing.password_hash = await hashPassword(password);
          results.push({
            message: `Admin password reset for "${email}"`,
            changed: true,
          });
        }

        await userRepo.save(existing);
        userId = existing.id;

        results.push({
          message: `Admin "${email}" already exists — role/status updated`,
          changed: true,
        });
      } else {
        /* Create new admin */
        if (!password) {
          throw new Error(
            'Password wajib diisi untuk membuat admin baru. ' +
              'Gunakan interactive prompt atau --admin-password flag.',
          );
        }

        const newUser = userRepo.create({
          name,
          email,
          password_hash: await hashPassword(password),
          role: 'Admin',
          email_verified: true,
          two_factor_enabled: false,
          two_factor_secret: null,
          google_id: null,
          avatar_url: null,
        });

        const saved = await userRepo.save(newUser);
        userId = saved.id;

        results.push({
          message: `Admin "${email}" created`,
          changed: true,
        });
      }

      /* ── Seed user defaults ── */
      const prefResult = await this.seedPreferences(manager, userId);
      results.push(...prefResult);

      const unitResult = await this.seedMeasurementUnits(manager, userId);
      results.push(...unitResult);

      const notifResult = await this.seedNotificationPrefs(manager, userId);
      results.push(...notifResult);

      const threshResult = await this.seedSensorThresholds(manager, userId);
      results.push(...threshResult);

      const irrigResult = await this.seedIrrigationConfig(manager, userId);
      results.push(...irrigResult);

      /* ── Cleanup recovery codes (fresh start) ── */
      await manager
        .createQueryBuilder()
        .delete()
        .from('recovery_codes')
        .where('user_id = :userId', { userId })
        .execute();
    });

    return results;
  }

  /* ────────────────────────────────────────────── */
  /*  Private seeder methods (all ORM + idempotent) */
  /* ────────────────────────────────────────────── */

  private async seedPreferences(
    manager: EntityManager,
    userId: string,
  ): Promise<SeederResult[]> {
    const repo = manager.getRepository(UserPreference);
    const existing = await repo.findOne({ where: { user_id: userId } });

    if (existing) {
      return [{ message: 'User preferences already exist', changed: false }];
    }

    const pref = repo.create({
      user_id: userId,
      language: 'id',
      notifications_enabled: true,
    });
    await repo.save(pref);

    return [{ message: 'User preferences created', changed: true }];
  }

  private async seedMeasurementUnits(
    manager: EntityManager,
    userId: string,
  ): Promise<SeederResult[]> {
    const prefRepo = manager.getRepository(UserPreference);
    const unitRepo = manager.getRepository(UserMeasurementUnit);

    const pref = await prefRepo.findOne({ where: { user_id: userId } });
    if (!pref) {
      return [
        { message: 'Skipped units — no preference record', changed: false },
      ];
    }

    let insertedCount = 0;

    for (const unit of MEASUREMENT_UNITS) {
      const existing = await unitRepo.findOne({
        where: { preference_id: pref.id, parameter_key: unit.key },
      });

      if (!existing) {
        const newUnit = unitRepo.create({
          preference_id: pref.id,
          parameter_key: unit.key,
          unit_value: unit.value,
        });
        await unitRepo.save(newUnit);
        insertedCount++;
      }
    }

    return [
      {
        message:
          insertedCount > 0
            ? `${insertedCount} measurement units created`
            : 'Measurement units already exist',
        changed: insertedCount > 0,
      },
    ];
  }

  private async seedNotificationPrefs(
    manager: EntityManager,
    userId: string,
  ): Promise<SeederResult[]> {
    const repo = manager.getRepository(UserNotificationPref);

    let insertedCount = 0;

    for (const pref of NOTIFICATION_PREFS) {
      const existing = await repo.findOne({
        where: {
          user_id: userId,
          category: pref.category,
          channel: pref.channel,
        },
      });

      if (!existing) {
        const newPref = repo.create({
          user_id: userId,
          category: pref.category,
          channel: pref.channel,
          enabled: pref.enabled,
        });
        await repo.save(newPref);
        insertedCount++;
      }
    }

    return [
      {
        message:
          insertedCount > 0
            ? `${insertedCount} notification prefs created`
            : 'Notification prefs already exist',
        changed: insertedCount > 0,
      },
    ];
  }

  private async seedSensorThresholds(
    manager: EntityManager,
    userId: string,
  ): Promise<SeederResult[]> {
    const repo = manager.getRepository(UserSensorThreshold);

    let insertedCount = 0;

    for (const thresh of SENSOR_THRESHOLDS) {
      const existing = await repo.findOne({
        where: { user_id: userId, parameter_key: thresh.key },
      });

      if (!existing) {
        const newThresh = repo.create({
          user_id: userId,
          parameter_key: thresh.key,
          min_value: thresh.min,
          max_value: thresh.max,
        });
        await repo.save(newThresh);
        insertedCount++;
      }
    }

    return [
      {
        message:
          insertedCount > 0
            ? `${insertedCount} sensor thresholds created`
            : 'Sensor thresholds already exist',
        changed: insertedCount > 0,
      },
    ];
  }

  private async seedIrrigationConfig(
    manager: EntityManager,
    userId: string,
  ): Promise<SeederResult[]> {
    const repo = manager.getRepository(IrrigationConfig);
    const existing = await repo.findOne({ where: { user_id: userId } });

    if (existing) {
      return [{ message: 'Irrigation config already exists', changed: false }];
    }

    const config = repo.create({
      user_id: userId,
      active_mode: 'off',
      emergency_stop: false,
      auto_parameter: 'soil_moisture',
      auto_threshold_value: 30,
      auto_threshold_direction: 'below',
      water_min_threshold: 30,
      water_max_threshold: 80,
      npk_min_threshold: 60,
      npk_max_threshold: 180,
      nitrogen_min_threshold: 20,
      nitrogen_max_threshold: 60,
      phosphorus_min_threshold: 20,
      phosphorus_max_threshold: 60,
      potassium_min_threshold: 20,
      potassium_max_threshold: 60,
      manual_water_enabled: false,
      manual_fertilizer_enabled: false,
      manual_speed: 100,
      fertilizer_manual_speed: 100,
      scheduled_behavior: 'manual',
    });
    await repo.save(config);

    return [{ message: 'Irrigation config created', changed: true }];
  }
}

/* ── Helper ── */

async function hashPassword(password: string): Promise<string> {
  const rounds = Number(process.env.BCRYPT_ROUNDS) || DEFAULT_BCRYPT_ROUNDS;
  return bcrypt.hash(password, rounds);
}
