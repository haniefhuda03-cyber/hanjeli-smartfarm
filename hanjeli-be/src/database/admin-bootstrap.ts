import * as bcrypt from 'bcryptjs';
import { isEmail } from 'class-validator';
import type { DataSource, EntityManager } from 'typeorm';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} from '../common/constants/password.constants.js';

/**
 * Seeding akun admin idempotent — dipakai oleh startup aplikasi (main.ts)
 * HANYA jika SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD tersedia di env
 * (berguna untuk Docker/CI deployment otomatis).
 *
 * Untuk setup pertama kali, gunakan CLI interaktif:
 *   npm run db:setup
 *
 * Sumber konfigurasi opsional: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD,
 * SEED_ADMIN_NAME, SEED_ADMIN_RESET_PASSWORD (env).
 */

const DEFAULT_ADMIN_NAME = 'Admin';
const INSECURE_PLACEHOLDER_PASSWORDS = new Set([
  'change-this-before-seeding',
  'ganti-dengan-password-admin-yang-kuat',
  'change-me',
  'password',
  'admin123',
]);

/**
 * Fallback kredensial admin — dipakai HANYA bila env SEED_ADMIN_* tidak diisi,
 * sebagai jaring pengaman jika orang yang deploy lupa mengonfigurasi (selain
 * jalur CLI `db:setup`). Bersifat idempotent: TIDAK menimpa admin yang sudah
 * ada (password hanya di-set saat pembuatan pertama). Ganti di produksi lewat
 * env SEED_ADMIN_* atau ganti password setelah login pertama.
 */
const DEFAULT_SEED_ADMIN_EMAIL = 'haniefhuda03@gmail.com';
const DEFAULT_SEED_ADMIN_PASSWORD = '@Admin123';

export class AdminBootstrapError extends Error {}

function requiredPassword(): string {
  // Env diutamakan; fallback ke default aman bila deployer belum mengisi.
  const password =
    process.env.SEED_ADMIN_PASSWORD?.trim() || DEFAULT_SEED_ADMIN_PASSWORD;

  if (INSECURE_PLACEHOLDER_PASSWORDS.has(password.toLowerCase())) {
    throw new AdminBootstrapError(
      'SEED_ADMIN_PASSWORD wajib diisi dengan password kuat sebelum seeding admin.',
    );
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new AdminBootstrapError(
      `SEED_ADMIN_PASSWORD minimal ${PASSWORD_MIN_LENGTH} karakter.`,
    );
  }

  // Kebijakan sama dengan aplikasi & tab Akun Pengguna: huruf besar + angka.
  if (!PASSWORD_POLICY_REGEX.test(password)) {
    throw new AdminBootstrapError(`SEED_ADMIN_PASSWORD: ${PASSWORD_POLICY_MESSAGE}`);
  }

  return password;
}

function bcryptRounds(): number {
  const parsed = Number.parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
}

/**
 * Pastikan akun admin ada. Dibuat jika belum ada; jika sudah ada, password
 * TIDAK disentuh kecuali SEED_ADMIN_RESET_PASSWORD=true (agar password yang
 * diganti admin lewat UI tidak di-reset diam-diam setiap boot).
 *
 * Return email admin, atau null bila SEED_ADMIN_EMAIL tidak dikonfigurasi.
 */
export async function ensureAdminUser(
  dataSource: DataSource,
): Promise<string | null> {
  // Env diutamakan; fallback ke default agar admin SELALU ter-seed otomatis
  // (jaring pengaman bila deployer lupa set env / tidak menjalankan CLI).
  const email = (
    process.env.SEED_ADMIN_EMAIL?.trim() || DEFAULT_SEED_ADMIN_EMAIL
  ).toLowerCase();

  // Validasi pola email — konsisten dengan @IsEmail pada DTO & tab Akun Pengguna.
  if (!isEmail(email)) {
    throw new AdminBootstrapError(
      'SEED_ADMIN_EMAIL bukan format email yang valid.',
    );
  }

  await dataSource.transaction(async (manager) => {
    await seedAdmin(manager, email);
  });

  return email;
}

async function seedAdmin(manager: EntityManager, email: string): Promise<void> {
  const name = (process.env.SEED_ADMIN_NAME ?? DEFAULT_ADMIN_NAME).trim();
  const resetPassword = process.env.SEED_ADMIN_RESET_PASSWORD === 'true';
  const existingUsers = (await manager.query(
    `SELECT id, password_hash FROM users WHERE email = $1 LIMIT 1`,
    [email],
  )) as Array<{ id: string; password_hash: string | null }>;
  const existingUser = existingUsers[0];

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;

    await manager.query(
      `
        UPDATE users
        SET role = 'Admin', email_verified = true, updated_at = NOW()
        WHERE id = $1
      `,
      [userId],
    );

    if (resetPassword) {
      const passwordHash = await bcrypt.hash(requiredPassword(), bcryptRounds());
      await manager.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [passwordHash, userId],
      );
    }
  } else {
    const passwordHash = await bcrypt.hash(requiredPassword(), bcryptRounds());
    const inserted = (await manager.query(
      `
        INSERT INTO users (
          name,
          email,
          password_hash,
          email_verified,
          role,
          two_factor_enabled,
          two_factor_secret
        )
        VALUES ($1, $2, $3, true, 'Admin', false, NULL)
        RETURNING id
      `,
      [name, email, passwordHash],
    )) as Array<{ id: string }>;

    userId = inserted[0].id;
  }

  await seedUserDefaults(manager, userId);
}

async function seedUserDefaults(
  manager: EntityManager,
  userId: string,
): Promise<void> {
  const preferenceRows = (await manager.query(
    `
      INSERT INTO user_preferences (user_id, language, notifications_enabled)
      VALUES ($1, 'id', true)
      ON CONFLICT (user_id) DO UPDATE SET updated_at = user_preferences.updated_at
      RETURNING id
    `,
    [userId],
  )) as Array<{ id: string }>;
  const preferenceId = preferenceRows[0].id;

  /* Selaras dengan chk_parameter_key & MEASUREMENT_UNIT_OPTIONS
     ('soil_npk' = grup unit bersama untuk N/P/K) */
  const measurementUnits = [
    ['soil_temperature', '°C'],
    ['soil_moisture', '%'],
    ['ph', 'pH'],
    ['soil_npk', 'mg/kg'],
  ];

  for (const [parameterKey, unitValue] of measurementUnits) {
    await manager.query(
      `
        INSERT INTO user_measurement_units (preference_id, parameter_key, unit_value)
        VALUES ($1, $2, $3)
        ON CONFLICT (preference_id, parameter_key) DO NOTHING
      `,
      [preferenceId, parameterKey, unitValue],
    );
  }

  const notificationPreferences = [
    ['irrigation', 'push', true],
    ['irrigation', 'email', true],
    ['sensor', 'push', true],
    ['sensor', 'email', false],
    ['system', 'push', true],
    ['system', 'email', true],
  ];

  for (const [category, channel, enabled] of notificationPreferences) {
    await manager.query(
      `
        INSERT INTO user_notification_prefs (user_id, category, channel, enabled)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, category, channel) DO NOTHING
      `,
      [userId, category, channel, enabled],
    );
  }

  const thresholds = [
    ['soil_temperature', 20, 35],
    ['soil_moisture', 30, 80],
    ['ph', 5.5, 7.5],
    ['soil_nitrogen', 20, 60],
    ['soil_phosphorus', 20, 60],
    ['soil_potassium', 20, 60],
  ];

  for (const [parameterKey, minValue, maxValue] of thresholds) {
    await manager.query(
      `
        INSERT INTO user_sensor_thresholds (user_id, parameter_key, min_value, max_value)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, parameter_key) DO NOTHING
      `,
      [userId, parameterKey, minValue, maxValue],
    );
  }

  await manager.query(
    `
      INSERT INTO irrigation_configs (
        user_id,
        active_mode,
        auto_parameter,
        auto_threshold_value,
        auto_threshold_direction,
        water_min_threshold,
        water_max_threshold,
        npk_min_threshold,
        npk_max_threshold,
        nitrogen_min_threshold,
        nitrogen_max_threshold,
        phosphorus_min_threshold,
        phosphorus_max_threshold,
        potassium_min_threshold,
        potassium_max_threshold,
        manual_water_enabled,
        manual_fertilizer_enabled,
        manual_speed,
        fertilizer_manual_speed,
        scheduled_behavior
      )
      VALUES ($1, 'off', 'soil_moisture', 30, 'below', 30, 80, 60, 180, 20, 60, 20, 60, 20, 60, false, false, 100, 100, 'manual')
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId],
  );
}
