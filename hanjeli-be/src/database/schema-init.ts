import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Hanjeli SmartFarm — Idempotent Schema Initializer.
 *
 * Menggantikan folder migrations: seluruh skema dibuat otomatis jika belum
 * ada, dan database lama di-upgrade in-place (sekali, ditandai lewat
 * schema_metadata) ke bentuk final:
 *   - sensor_telemetry.sent_at TIMESTAMPTZ NOT NULL tanpa default
 *     (waktu pengiriman WAJIB dari payload ESP32, bukan server)
 *   - captured_at tanpa DEFAULT NOW()
 *   - FK sensor_telemetry.device_id ON DELETE CASCADE (hard delete)
 *   - Tanpa kolom deleted_at (soft delete dihapus total)
 *   - auth_tokens.purpose mendukung 'refresh' (rotasi refresh token)
 *
 * Dipanggil dari main.ts sebelum NestFactory.create dan dari CLI db-setup.
 */

const UPGRADE_MARKER_KEY = 'schema_upgrade_v2';
const UPGRADE_V3_MARKER_KEY = 'schema_upgrade_v3';
const SCHEMA_VERSION = '3.0.0';

export async function initializeSchema(dataSource: DataSource): Promise<void> {
  const logger = new Logger('SchemaInit');
  const run = (sql: string): Promise<unknown> => dataSource.query(sql);

  /* ── 1. Extensions ── */
  await run(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await run(`CREATE EXTENSION IF NOT EXISTS timescaledb`);

  /* ── 2. ENUM types ── */
  await run(`
    DO $$ BEGIN CREATE TYPE device_type AS ENUM ('sensor', 'pump', 'camera'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE device_status AS ENUM ('online', 'warning', 'offline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE irrigation_mode AS ENUM ('auto', 'manual', 'scheduled', 'off'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE threshold_direction AS ENUM ('below', 'above'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE scheduled_behavior_type AS ENUM ('manual', 'auto'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE activity_log_type AS ENUM ('success', 'info', 'warning'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  /* ── 3. schema_metadata (dipakai sebagai penanda upgrade) ── */
  await run(`
    CREATE TABLE IF NOT EXISTS schema_metadata (
      key        VARCHAR(100) PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  /* ── 4. Tabel (bentuk final) ── */
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name          VARCHAR(100) NOT NULL,
      email         VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255),
      avatar_url    VARCHAR(500),
      two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
      two_factor_secret  BYTEA,
      email_verified     BOOLEAN NOT NULL DEFAULT false,
      google_id     VARCHAR(255),
      role          VARCHAR(20) NOT NULL DEFAULT 'Guest',
      token_version INTEGER NOT NULL DEFAULT 0,
      password_updated_at TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT uq_users_email     UNIQUE (email),
      CONSTRAINT uq_users_google_id UNIQUE (google_id),
      CONSTRAINT chk_users_role     CHECK (role IN ('Admin', 'Guest'))
    )
  `);

  /* Ensure existing databases get the new column */
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ`);

  await run(`
    CREATE TABLE IF NOT EXISTS recovery_codes (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code       VARCHAR(255) NOT NULL,
      is_used    BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      language              VARCHAR(5) NOT NULL DEFAULT 'id',
      notifications_enabled BOOLEAN NOT NULL DEFAULT true,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT chk_language CHECK (language IN ('id', 'en'))
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_measurement_units (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      preference_id  UUID NOT NULL REFERENCES user_preferences(id) ON DELETE CASCADE,
      parameter_key  VARCHAR(30) NOT NULL,
      unit_value     VARCHAR(20) NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT uq_preference_parameter UNIQUE (preference_id, parameter_key),
      /* 'soil_npk' = grup unit bersama untuk ketiga nilai N, P, K */
      CONSTRAINT chk_parameter_key CHECK (
        parameter_key IN ('soil_temperature', 'soil_moisture', 'ph', 'soil_npk')
      )
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS devices (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name            VARCHAR(200) NOT NULL,
      code            VARCHAR(20) NOT NULL,
      type            device_type NOT NULL,
      status          device_status NOT NULL DEFAULT 'offline',
      last_seen_at    TIMESTAMPTZ,
      warning_message TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT uq_devices_code UNIQUE (code)
    )
  `);

  /*
   * Desain per-parameter (4 kelompok sensor tanah):
   *   1. ph_level                                — pH tanah (0–14)
   *   2. soil_moisture                           — kelembapan tanah (0–100 %)
   *   3. soil_nitrogen / soil_phosphorus /
   *      soil_potassium                          — N, P, K TERPISAH (mg/kg ≥ 0);
   *                                                TIDAK ada kolom agregat NPK
   *   4. soil_temperature                        — suhu tanah (−50…80 °C)
   * Plus konteks pengukuran:
   *   - sent_at    — waktu pengiriman ESP32 (field `ts`) — WAJIB NOT NULL
   *                  tanpa default; reading tanpa timestamp perangkat ditolak
   *   - is_raining — kondisi hujan saat data diambil (dari sensor hujan
   *                  ESP32; NULL bila perangkat tidak melaporkan)
   */
  await run(`
    CREATE TABLE IF NOT EXISTS sensor_telemetry (
      id               BIGSERIAL NOT NULL,
      device_id        UUID NOT NULL,
      captured_at      TIMESTAMPTZ NOT NULL,
      sent_at          TIMESTAMPTZ NOT NULL,
      ph_level         FLOAT8,
      soil_moisture    FLOAT8,
      soil_nitrogen    FLOAT8,
      soil_phosphorus  FLOAT8,
      soil_potassium   FLOAT8,
      soil_temperature FLOAT8,
      is_raining       BOOLEAN,

      CONSTRAINT fk_sensor_telemetry_device
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
      CONSTRAINT chk_ph_level        CHECK (ph_level >= 0 AND ph_level <= 14),
      CONSTRAINT chk_soil_moisture   CHECK (soil_moisture >= 0 AND soil_moisture <= 100),
      CONSTRAINT chk_soil_nitrogen   CHECK (soil_nitrogen >= 0),
      CONSTRAINT chk_soil_phosphorus CHECK (soil_phosphorus >= 0),
      CONSTRAINT chk_soil_potassium  CHECK (soil_potassium >= 0),
      CONSTRAINT chk_soil_temperature CHECK (soil_temperature >= -50 AND soil_temperature <= 80),
      CONSTRAINT pk_sensor_telemetry PRIMARY KEY (id, captured_at)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS irrigation_configs (
      id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                  UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      active_mode              irrigation_mode NOT NULL DEFAULT 'off',
      emergency_stop           BOOLEAN NOT NULL DEFAULT false,
      auto_parameter           VARCHAR(30) NOT NULL DEFAULT 'soil_moisture',
      auto_threshold_value     FLOAT8 NOT NULL DEFAULT 30,
      auto_threshold_direction threshold_direction NOT NULL DEFAULT 'below',
      water_min_threshold      FLOAT8 NOT NULL DEFAULT 30,
      water_max_threshold      FLOAT8 NOT NULL DEFAULT 80,
      npk_min_threshold        FLOAT8 NOT NULL DEFAULT 60,
      npk_max_threshold        FLOAT8 NOT NULL DEFAULT 180,
      nitrogen_min_threshold   FLOAT8 NOT NULL DEFAULT 20,
      nitrogen_max_threshold   FLOAT8 NOT NULL DEFAULT 60,
      phosphorus_min_threshold FLOAT8 NOT NULL DEFAULT 20,
      phosphorus_max_threshold FLOAT8 NOT NULL DEFAULT 60,
      potassium_min_threshold  FLOAT8 NOT NULL DEFAULT 20,
      potassium_max_threshold  FLOAT8 NOT NULL DEFAULT 60,
      manual_water_enabled     BOOLEAN NOT NULL DEFAULT false,
      manual_fertilizer_enabled BOOLEAN NOT NULL DEFAULT false,
      manual_speed             INTEGER NOT NULL DEFAULT 100,
      fertilizer_manual_speed  INTEGER NOT NULL DEFAULT 100,
      scheduled_behavior       scheduled_behavior_type NOT NULL DEFAULT 'manual',
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT chk_auto_parameter CHECK (
        auto_parameter IN (
          'soil_moisture', 'ph', 'soil_nitrogen', 'soil_phosphorus',
          'soil_potassium', 'soil_temperature'
        )
      ),
      CONSTRAINT chk_threshold_value CHECK (auto_threshold_value >= 0),
      CONSTRAINT chk_water_threshold_range CHECK (
        water_min_threshold >= 0
        AND water_max_threshold <= 100
        AND water_min_threshold < water_max_threshold
      ),
      CONSTRAINT chk_npk_threshold_range CHECK (
        npk_min_threshold >= 0
        AND npk_max_threshold >= 0
        AND npk_min_threshold < npk_max_threshold
      ),
      CONSTRAINT chk_nitrogen_threshold_range CHECK (
        nitrogen_min_threshold >= 0
        AND nitrogen_max_threshold >= 0
        AND nitrogen_min_threshold < nitrogen_max_threshold
      ),
      CONSTRAINT chk_phosphorus_threshold_range CHECK (
        phosphorus_min_threshold >= 0
        AND phosphorus_max_threshold >= 0
        AND phosphorus_min_threshold < phosphorus_max_threshold
      ),
      CONSTRAINT chk_potassium_threshold_range CHECK (
        potassium_min_threshold >= 0
        AND potassium_max_threshold >= 0
        AND potassium_min_threshold < potassium_max_threshold
      ),
      CONSTRAINT chk_manual_speed CHECK (manual_speed >= 0 AND manual_speed <= 100),
      CONSTRAINT chk_fertilizer_manual_speed CHECK (fertilizer_manual_speed >= 0 AND fertilizer_manual_speed <= 100)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS irrigation_schedules (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       VARCHAR(100) NOT NULL,
      mon        BOOLEAN NOT NULL DEFAULT false,
      tue        BOOLEAN NOT NULL DEFAULT false,
      wed        BOOLEAN NOT NULL DEFAULT false,
      thu        BOOLEAN NOT NULL DEFAULT false,
      fri        BOOLEAN NOT NULL DEFAULT false,
      sat        BOOLEAN NOT NULL DEFAULT false,
      sun        BOOLEAN NOT NULL DEFAULT false,
      start_time TIME NOT NULL,
      end_time   TIME NOT NULL,
      active     BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT chk_time_range CHECK (start_time < end_time)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS irrigation_activity_logs (
      id          BIGSERIAL NOT NULL,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      description VARCHAR(300) NOT NULL,
      type        activity_log_type NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT pk_irrigation_activity_logs PRIMARY KEY (id, executed_at)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       VARCHAR(200) NOT NULL,
      description TEXT,
      type        notification_type NOT NULL,
      category    VARCHAR(30) NOT NULL DEFAULT 'general',
      read        BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT chk_notification_category CHECK (
        category IN (
          'temperature', 'irrigation', 'soil',
          'wind', 'ph', 'uv', 'device', 'security',
          'auth', 'profile', 'system', 'general'
        )
      )
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose     VARCHAR(30) NOT NULL,
      token_hash  VARCHAR(128) NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ NOT NULL,
      used_at     TIMESTAMPTZ NULL,
      revoked_at  TIMESTAMPTZ NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT chk_auth_tokens_purpose CHECK (
        purpose IN ('email_verification', 'password_reset', 'oauth_exchange', 'refresh')
      )
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_notification_prefs (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category      VARCHAR(30) NOT NULL,
      channel       VARCHAR(10) NOT NULL,
      enabled       BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT uq_user_notif_cat_chan UNIQUE (user_id, category, channel),
      CONSTRAINT chk_notif_category CHECK (category IN ('irrigation', 'sensor', 'system')),
      CONSTRAINT chk_notif_channel CHECK (channel IN ('push', 'email'))
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_sensor_thresholds (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parameter_key   VARCHAR(30) NOT NULL,
      min_value       FLOAT8 NOT NULL,
      max_value       FLOAT8 NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT uq_user_sensor_param UNIQUE (user_id, parameter_key),
      CONSTRAINT chk_threshold_parameter CHECK (
        parameter_key IN (
          'soil_temperature', 'soil_moisture', 'ph',
          'soil_nitrogen', 'soil_phosphorus', 'soil_potassium'
        )
      ),
      CONSTRAINT chk_threshold_range CHECK (min_value < max_value)
    )
  `);

  /* ── 5. Indexes ── */
  await run(`
    CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id ON recovery_codes (user_id);
    CREATE INDEX IF NOT EXISTS idx_user_measurement_units_pref_id ON user_measurement_units (preference_id);
    CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices (user_id);
    CREATE INDEX IF NOT EXISTS idx_irrigation_schedules_user_id ON irrigation_schedules (user_id);
    CREATE INDEX IF NOT EXISTS idx_sensor_telemetry_device_time ON sensor_telemetry (device_id, captured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read_time ON notifications (user_id, read, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_irrigation_activity_logs_user_time ON irrigation_activity_logs (user_id, executed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens (user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_purpose_hash ON auth_tokens (purpose, token_hash);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON auth_tokens (expires_at);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_active ON auth_tokens (user_id, purpose, expires_at) WHERE used_at IS NULL AND revoked_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_user_id ON user_notification_prefs (user_id);
    CREATE INDEX IF NOT EXISTS idx_user_sensor_thresholds_user_id ON user_sensor_thresholds (user_id);
  `);

  /* ── 6. Hypertables ── */
  await run(
    `SELECT create_hypertable('sensor_telemetry', 'captured_at', if_not_exists => TRUE)`,
  );
  await run(
    `SELECT create_hypertable('irrigation_activity_logs', 'executed_at', if_not_exists => TRUE)`,
  );

  /* ── 7. Upgrade sekali-jalan untuk database lama (hasil migrations lama) ── */
  await upgradeLegacySchema(dataSource, logger);
  await upgradeSchemaV3(dataSource, logger);

  /* ── 8. Continuous aggregates + policies ── */
  await ensureContinuousAggregates(dataSource, logger);

  await run(
    `ALTER TABLE sensor_telemetry SET (timescaledb.compress, timescaledb.compress_segmentby = 'device_id')`,
  );
  await run(
    `SELECT add_compression_policy('sensor_telemetry', INTERVAL '30 days', if_not_exists => TRUE)`,
  );
  await run(
    `SELECT add_retention_policy('sensor_telemetry', INTERVAL '365 days', if_not_exists => TRUE)`,
  );

  /* ── 9. Metadata + bersihkan tabel riwayat migrasi TypeORM ── */
  await run(`DROP TABLE IF EXISTS migrations`);
  await run(`
    INSERT INTO schema_metadata (key, value)
    VALUES ('schema_version', '${SCHEMA_VERSION}'), ('timescaledb_setup', 'completed')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `);

  logger.log('Skema database siap (idempotent)');
}

/**
 * Upgrade in-place database yang dibuat oleh folder migrations lama.
 * Dijalankan sekali; ditandai lewat schema_metadata agar boot berikutnya
 * tidak memindai ulang tabel telemetry.
 */
async function upgradeLegacySchema(
  dataSource: DataSource,
  logger: Logger,
): Promise<void> {
  const run = (sql: string): Promise<unknown> => dataSource.query(sql);

  const marker = await dataSource.query(
    `SELECT value FROM schema_metadata WHERE key = $1`,
    [UPGRADE_MARKER_KEY],
  );
  if (marker[0]?.value === 'completed') return;

  logger.log('Meng-upgrade skema database lama…');

  /* Pause job compression/retention selama DDL, decompress chunk terkompresi
     (SET NOT NULL / FK swap ditolak selama chunk masih terkompresi). */
  await run(`
    SELECT alter_job(job_id, scheduled => false)
    FROM timescaledb_information.jobs
    WHERE hypertable_name = 'sensor_telemetry'
      AND proc_name IN ('policy_compression', 'policy_retention')
  `);
  await run(`
    SELECT decompress_chunk(format('%I.%I', chunk_schema, chunk_name)::regclass, true)
    FROM timescaledb_information.chunks
    WHERE hypertable_name = 'sensor_telemetry' AND is_compressed
  `);

  /* sent_at: tambah → backfill dari captured_at (sekali, bukan default) → NOT NULL */
  await run(
    `ALTER TABLE sensor_telemetry ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ`,
  );
  await run(
    `UPDATE sensor_telemetry SET sent_at = captured_at WHERE sent_at IS NULL`,
  );
  await run(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sensor_telemetry' AND column_name = 'sent_at' AND is_nullable = 'YES'
      ) THEN
        ALTER TABLE sensor_telemetry ALTER COLUMN sent_at SET NOT NULL;
      END IF;
    END $$
  `);
  await run(
    `ALTER TABLE sensor_telemetry ALTER COLUMN captured_at DROP DEFAULT`,
  );

  /* FK device_id: RESTRICT → CASCADE (hard delete device menghapus telemetry-nya) */
  await run(`
    DO $$
    DECLARE fk_name text;
    BEGIN
      SELECT conname INTO fk_name
      FROM pg_constraint
      WHERE conrelid = 'sensor_telemetry'::regclass
        AND contype = 'f'
        AND confrelid = 'devices'::regclass
        AND confdeltype <> 'c';
      IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE sensor_telemetry DROP CONSTRAINT %I', fk_name);
        ALTER TABLE sensor_telemetry
          ADD CONSTRAINT fk_sensor_telemetry_device
          FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;
      END IF;
    END $$
  `);

  /* Soft delete dihapus total: purge row terhapus lalu drop kolom.
     Urutan: schedules → devices (cascade telemetry) → users (cascade sisanya). */
  await run(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'irrigation_schedules' AND column_name = 'deleted_at') THEN
        DELETE FROM irrigation_schedules WHERE deleted_at IS NOT NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'deleted_at') THEN
        DELETE FROM devices WHERE deleted_at IS NOT NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'deleted_at') THEN
        DELETE FROM users WHERE deleted_at IS NOT NULL;
      END IF;
    END $$
  `);
  await run(`
    DROP INDEX IF EXISTS idx_users_active;
    DROP INDEX IF EXISTS idx_devices_active;
    DROP INDEX IF EXISTS idx_schedules_active;
    ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
    ALTER TABLE devices DROP COLUMN IF EXISTS deleted_at;
    ALTER TABLE irrigation_schedules DROP COLUMN IF EXISTS deleted_at;
  `);

  /* Kolom yang ditambahkan migrasi lama (aman untuk DB parsial) */
  await run(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'Guest';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE sensor_telemetry ADD COLUMN IF NOT EXISTS soil_nitrogen FLOAT8;
    ALTER TABLE sensor_telemetry ADD COLUMN IF NOT EXISTS soil_phosphorus FLOAT8;
    ALTER TABLE sensor_telemetry ADD COLUMN IF NOT EXISTS soil_potassium FLOAT8;
  `);

  /* auth_tokens.purpose harus memuat 'refresh' (rotasi refresh token) */
  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'auth_tokens'::regclass
          AND conname = 'chk_auth_tokens_purpose'
          AND pg_get_constraintdef(oid) LIKE '%refresh%'
      ) THEN
        ALTER TABLE auth_tokens DROP CONSTRAINT IF EXISTS chk_auth_tokens_purpose;
        ALTER TABLE auth_tokens ADD CONSTRAINT chk_auth_tokens_purpose CHECK (
          purpose IN ('email_verification', 'password_reset', 'oauth_exchange', 'refresh')
        );
      END IF;
    END $$
  `);

  /* Harmonisasi label unit lama */
  await run(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'user_measurement_units'::regclass
          AND conname = 'chk_parameter_key'
          AND pg_get_constraintdef(oid) LIKE '%soil_ec%'
      ) THEN
        DELETE FROM user_measurement_units WHERE parameter_key = 'soil_ec';
        ALTER TABLE user_measurement_units DROP CONSTRAINT IF EXISTS chk_parameter_key;
        ALTER TABLE user_measurement_units ADD CONSTRAINT chk_parameter_key CHECK (
          parameter_key IN ('temperature', 'soil_moisture', 'ph', 'soil_npk')
        );
      END IF;
    END $$
  `);
  await run(
    `UPDATE user_measurement_units SET unit_value = '%' WHERE parameter_key = 'soil_moisture' AND unit_value = '%VWC'`,
  );
  await run(
    `DELETE FROM auth_tokens WHERE expires_at < NOW() - INTERVAL '30 days'`,
  );

  /* Aktifkan kembali job yang di-pause */
  await run(`
    SELECT alter_job(job_id, scheduled => true)
    FROM timescaledb_information.jobs
    WHERE hypertable_name = 'sensor_telemetry'
      AND proc_name IN ('policy_compression', 'policy_retention')
  `);

  await run(`
    INSERT INTO schema_metadata (key, value)
    VALUES ('${UPGRADE_MARKER_KEY}', 'completed')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `);
  logger.log('Upgrade skema lama selesai');
}

/**
 * Upgrade v3 — perombakan model parameter sensor (sekali-jalan):
 *   - Kolom-kolom legacy dihapus dari schema
 *   - Kolom agregat soil_npk dibuang — N, P, K adalah tiga nilai terpisah
 *   - temperature → soil_temperature (di telemetry, threshold, unit, config)
 *   - is_raining ditambahkan (kondisi hujan saat pengambilan data)
 *   - Continuous aggregate dibangun ulang per-nutrien
 */
async function upgradeSchemaV3(
  dataSource: DataSource,
  logger: Logger,
): Promise<void> {
  const run = (sql: string): Promise<unknown> => dataSource.query(sql);

  const marker = (await dataSource.query(
    `SELECT value FROM schema_metadata WHERE key = $1`,
    [UPGRADE_V3_MARKER_KEY],
  )) as Array<{ value: string }>;
  if (marker[0]?.value === 'completed') return;

  logger.log('Meng-upgrade skema ke v3 (Perombakan sensor & agregat, penambahan is_raining)…');

  /* Pause job + decompress chunk (DDL kolom ditolak pada chunk terkompresi) */
  await run(`
    SELECT alter_job(job_id, scheduled => false)
    FROM timescaledb_information.jobs
    WHERE hypertable_name = 'sensor_telemetry'
      AND proc_name IN ('policy_compression', 'policy_retention')
  `);
  await run(`
    SELECT decompress_chunk(format('%I.%I', chunk_schema, chunk_name)::regclass, true)
    FROM timescaledb_information.chunks
    WHERE hypertable_name = 'sensor_telemetry' AND is_compressed
  `);

  /* Aggregate lama bergantung pada kolom yang berubah — drop dulu,
     dibangun ulang oleh ensureContinuousAggregates setelah upgrade ini. */
  await run(`DROP MATERIALIZED VIEW IF EXISTS sensor_hourly_stats CASCADE`);
  await run(`DROP MATERIALIZED VIEW IF EXISTS sensor_daily_stats CASCADE`);

  /* Kolom telemetry */
  await run(`ALTER TABLE sensor_telemetry DROP COLUMN IF EXISTS soil_ec`);
  await run(`ALTER TABLE sensor_telemetry DROP COLUMN IF EXISTS soil_npk`);
  await run(`ALTER TABLE sensor_telemetry ADD COLUMN IF NOT EXISTS is_raining BOOLEAN`);
  await run(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sensor_telemetry' AND column_name = 'temperature'
      ) THEN
        ALTER TABLE sensor_telemetry RENAME COLUMN temperature TO soil_temperature;
      END IF;
    END $$
  `);

  /* Threshold notifikasi: temperature→soil_temperature; soil_npk dipecah
     menjadi tiga baris per-nutrien (min/max dibagi 3, pembulatan). */
  await run(`ALTER TABLE user_sensor_thresholds DROP CONSTRAINT IF EXISTS chk_threshold_parameter`);
  await run(`UPDATE user_sensor_thresholds SET parameter_key = 'soil_temperature' WHERE parameter_key = 'temperature'`);
  await run(`
    INSERT INTO user_sensor_thresholds (user_id, parameter_key, min_value, max_value)
    SELECT user_id, nutrient, ROUND(min_value / 3.0), ROUND(max_value / 3.0)
    FROM user_sensor_thresholds
    CROSS JOIN (VALUES ('soil_nitrogen'), ('soil_phosphorus'), ('soil_potassium')) AS n(nutrient)
    WHERE parameter_key = 'soil_npk'
    ON CONFLICT (user_id, parameter_key) DO NOTHING
  `);
  await run(`DELETE FROM user_sensor_thresholds WHERE parameter_key = 'soil_npk'`);
  await run(`
    ALTER TABLE user_sensor_thresholds ADD CONSTRAINT chk_threshold_parameter CHECK (
      parameter_key IN (
        'soil_temperature', 'soil_moisture', 'ph',
        'soil_nitrogen', 'soil_phosphorus', 'soil_potassium'
      )
    )
  `);

  /* Unit pengukuran: temperature→soil_temperature ('soil_npk' tetap sebagai
     grup unit bersama untuk N/P/K) */
  await run(`ALTER TABLE user_measurement_units DROP CONSTRAINT IF EXISTS chk_parameter_key`);
  await run(`UPDATE user_measurement_units SET parameter_key = 'soil_temperature' WHERE parameter_key = 'temperature'`);
  await run(`
    ALTER TABLE user_measurement_units ADD CONSTRAINT chk_parameter_key CHECK (
      parameter_key IN ('soil_temperature', 'soil_moisture', 'ph', 'soil_npk')
    )
  `);

  /* irrigation_configs.auto_parameter (kolom kompat lama) */
  await run(`ALTER TABLE irrigation_configs DROP CONSTRAINT IF EXISTS chk_auto_parameter`);
  await run(`UPDATE irrigation_configs SET auto_parameter = 'soil_moisture' WHERE auto_parameter IN ('soil_ec', 'soil_npk')`);
  await run(`UPDATE irrigation_configs SET auto_parameter = 'soil_temperature' WHERE auto_parameter = 'temperature'`);
  await run(`
    ALTER TABLE irrigation_configs ADD CONSTRAINT chk_auto_parameter CHECK (
      auto_parameter IN (
        'soil_moisture', 'ph', 'soil_nitrogen', 'soil_phosphorus',
        'soil_potassium', 'soil_temperature'
      )
    )
  `);

  /* Aktifkan kembali job yang di-pause */
  await run(`
    SELECT alter_job(job_id, scheduled => true)
    FROM timescaledb_information.jobs
    WHERE hypertable_name = 'sensor_telemetry'
      AND proc_name IN ('policy_compression', 'policy_retention')
  `);

  await run(`
    INSERT INTO schema_metadata (key, value)
    VALUES ('${UPGRADE_V3_MARKER_KEY}', 'completed')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `);
  logger.log('Upgrade skema v3 selesai');
}

/**
 * Continuous aggregates untuk grafik tren (hourly = "day", daily = "week/month").
 * CREATE MATERIALIZED VIEW ... timescaledb.continuous tidak boleh berada dalam
 * transaction block, jadi dicek manual lalu dibuat sebagai statement tunggal.
 *
 * materialized_only = false + refresh policy: tanpa keduanya (kondisi lama),
 * view tidak pernah ter-refresh dan grafik tren selalu kosong/basi.
 */
async function ensureContinuousAggregates(
  dataSource: DataSource,
  logger: Logger,
): Promise<void> {
  const run = (sql: string): Promise<unknown> => dataSource.query(sql);

  const aggregates: Array<{ name: string; bucket: string }> = [
    { name: 'sensor_hourly_stats', bucket: '1 hour' },
    { name: 'sensor_daily_stats', bucket: '1 day' },
  ];

  for (const { name, bucket } of aggregates) {
    const exists = await dataSource.query(
      `SELECT 1 FROM timescaledb_information.continuous_aggregates WHERE view_name = $1`,
      [name],
    );

    if (exists.length === 0) {
      await run(`
        CREATE MATERIALIZED VIEW ${name}
        WITH (timescaledb.continuous) AS
        SELECT
          device_id,
          time_bucket('${bucket}', captured_at) AS bucket,
          AVG(ph_level)         AS avg_ph,
          MAX(ph_level)         AS max_ph,
          MIN(ph_level)         AS min_ph,
          AVG(soil_moisture)    AS avg_moisture,
          MAX(soil_moisture)    AS max_moisture,
          MIN(soil_moisture)    AS min_moisture,
          AVG(soil_nitrogen)    AS avg_nitrogen,
          MAX(soil_nitrogen)    AS max_nitrogen,
          MIN(soil_nitrogen)    AS min_nitrogen,
          AVG(soil_phosphorus)  AS avg_phosphorus,
          MAX(soil_phosphorus)  AS max_phosphorus,
          MIN(soil_phosphorus)  AS min_phosphorus,
          AVG(soil_potassium)   AS avg_potassium,
          MAX(soil_potassium)   AS max_potassium,
          MIN(soil_potassium)   AS min_potassium,
          AVG(soil_temperature) AS avg_soil_temperature,
          MAX(soil_temperature) AS max_soil_temperature,
          MIN(soil_temperature) AS min_soil_temperature
        FROM sensor_telemetry
        GROUP BY device_id, bucket
        WITH NO DATA
      `);
      logger.log(`Continuous aggregate ${name} dibuat`);
    }

    /* Realtime aggregation: query menyertakan data terbaru yang belum termaterialisasi */
    await run(
      `ALTER MATERIALIZED VIEW ${name} SET (timescaledb.materialized_only = false)`,
    );
  }

  await run(`
    SELECT add_continuous_aggregate_policy('sensor_hourly_stats',
      start_offset => INTERVAL '3 days',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '30 minutes',
      if_not_exists => TRUE)
  `);
  await run(`
    SELECT add_continuous_aggregate_policy('sensor_daily_stats',
      start_offset => INTERVAL '90 days',
      end_offset => INTERVAL '1 day',
      schedule_interval => INTERVAL '6 hours',
      if_not_exists => TRUE)
  `);
}
