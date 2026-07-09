# Database Schema — PostgreSQL + TimescaleDB

Canonical data contract for the Hanjeli Smart Farm backend. The FE (mocked today under `src/lib/mock/` + `src/lib/services/`) consumes payloads shaped by these tables.

**Stack:** PostgreSQL 15+ with the **TimescaleDB** extension. High-frequency, append-only telemetry (sensor readings, irrigation events) → hypertables with columnstore compression + continuous aggregates. Mutable relational state (users, devices, schedules, notifications) → regular tables.

**Rules:**
- `snake_case`, lowercase identifiers.
- `TIMESTAMPTZ` everywhere (never `TIMESTAMP`).
- `BIGINT GENERATED ALWAYS AS IDENTITY` for surrogate keys.
- `TEXT` + `CHECK` over `VARCHAR(n)`.
- FK columns are explicitly indexed (PostgreSQL does not auto-index them).
- **No `humidity` / `air_humidity` column** anywhere user-facing. Air humidity was removed from the FE and must not return.

---

## 1. Extensions

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

---

## 2. Relational tables

### 2.1 `users`

```sql
CREATE TABLE users (
    user_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email              TEXT NOT NULL,
    password_hash      TEXT NOT NULL,
    full_name          TEXT NOT NULL,
    role               TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('admin','user','viewer')),
    language           TEXT NOT NULL DEFAULT 'id'
        CHECK (language IN ('id','en')),
    avatar_url         TEXT,
    two_factor_secret  TEXT,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at  TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (LOWER(email));
CREATE INDEX users_created_at_idx ON users (created_at);
```

### 2.2 `user_preferences`

```sql
CREATE TABLE user_preferences (
    user_id               BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    units                 JSONB   NOT NULL DEFAULT
        '{"temperature":"°C","soil_moisture":"%VWC","ph":"pH","soil_ec":"dS/m","soil_npk":"%"}'::jsonb
        CHECK (jsonb_typeof(units) = 'object'),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_preferences_units_gin ON user_preferences USING GIN (units);
```

### 2.3 `recovery_codes`

```sql
CREATE TABLE recovery_codes (
    code_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    code_hash  TEXT   NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX recovery_codes_user_idx ON recovery_codes (user_id) WHERE used_at IS NULL;
```

### 2.4 `zones`

```sql
CREATE TABLE zones (
    zone_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id   BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name       TEXT   NOT NULL,
    location   TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (owner_id, name)
);
CREATE INDEX zones_owner_idx ON zones (owner_id);
```

### 2.5 `devices`

```sql
CREATE TABLE devices (
    device_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    zone_id      BIGINT REFERENCES zones(zone_id) ON DELETE SET NULL,
    code         TEXT   NOT NULL,
    name         TEXT   NOT NULL,
    subtitle     TEXT,
    device_type  TEXT   NOT NULL CHECK (device_type IN ('pump','sensor','camera')),
    status       TEXT   NOT NULL DEFAULT 'offline'
        CHECK (status IN ('online','warning','offline')),
    warning_msg  TEXT,
    last_seen_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (owner_id, code),
    CHECK (status <> 'warning' OR warning_msg IS NOT NULL)
);
CREATE INDEX devices_owner_idx     ON devices (owner_id);
CREATE INDEX devices_zone_idx      ON devices (zone_id);
CREATE INDEX devices_status_idx    ON devices (status) WHERE status <> 'offline';
CREATE INDEX devices_last_seen_idx ON devices (last_seen_at DESC);
```

### 2.6 `irrigation_zone_state`

One row per zone, current irrigation mode + manual settings. Modes are mutually exclusive (single `mode` column).

```sql
CREATE TABLE irrigation_zone_state (
    zone_id          BIGINT PRIMARY KEY REFERENCES zones(zone_id) ON DELETE CASCADE,
    mode             TEXT NOT NULL DEFAULT 'auto'
        CHECK (mode IN ('auto','scheduled','manual','idle')),
    emergency_stop   BOOLEAN NOT NULL DEFAULT FALSE,
    manual_speed_pct SMALLINT NOT NULL DEFAULT 100
        CHECK (manual_speed_pct BETWEEN 0 AND 100),
    manual_behavior  TEXT NOT NULL DEFAULT 'auto'
        CHECK (manual_behavior IN ('auto','manual')),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.7 `irrigation_auto_rules`

```sql
CREATE TABLE irrigation_auto_rules (
    rule_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    zone_id      BIGINT NOT NULL REFERENCES zones(zone_id) ON DELETE CASCADE,
    parameter_id TEXT   NOT NULL
        CHECK (parameter_id IN ('ph','soil_moisture','soil_ec','soil_npk','temperature')),
    direction    TEXT   NOT NULL CHECK (direction IN ('below','above')),
    threshold    DOUBLE PRECISION NOT NULL,
    enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (zone_id, parameter_id)
);
CREATE INDEX irrigation_auto_rules_zone_idx ON irrigation_auto_rules (zone_id);
```

### 2.8 `irrigation_schedules`

```sql
CREATE TABLE irrigation_schedules (
    schedule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    zone_id     BIGINT NOT NULL REFERENCES zones(zone_id) ON DELETE CASCADE,
    name        TEXT   NOT NULL,
    days        TEXT[] NOT NULL
        CHECK (days <@ ARRAY['mon','tue','wed','thu','fri','sat','sun']::TEXT[]),
    start_time  TIME   NOT NULL,
    end_time    TIME   NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time >= start_time)
);
CREATE INDEX irrigation_schedules_zone_idx   ON irrigation_schedules (zone_id);
CREATE INDEX irrigation_schedules_active_idx ON irrigation_schedules (zone_id) WHERE active;
CREATE INDEX irrigation_schedules_days_gin   ON irrigation_schedules USING GIN (days);
```

### 2.9 `notifications`

Backs the Home bell panel + sonner toasts. The FE mirrors the latest 50 in `localStorage` under `hanjeli_notifications`.

```sql
CREATE TABLE notifications (
    notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title           TEXT   NOT NULL,
    description     TEXT,
    severity        TEXT   NOT NULL CHECK (severity IN ('info','success','warning','error')),
    category        TEXT   NOT NULL
        CHECK (category IN (
            'temperature','irrigation','soil','wind','ph','uv',
            'device','security','auth','profile','system','general'
        )),   -- NO 'humidity'
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx
    ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_user_created_idx
    ON notifications (user_id, created_at DESC);
```

---

## 3. Hypertables (TimescaleDB)

### 3.1 `sensor_readings`

Raw telemetry. Wide-row layout — one row per device per capture, all 5 parameters in columns.

```sql
CREATE TABLE sensor_readings (
    recorded_at       TIMESTAMPTZ NOT NULL,
    device_id         BIGINT      NOT NULL,
    zone_id           BIGINT      NOT NULL,
    ph                DOUBLE PRECISION,
    soil_moisture_pct DOUBLE PRECISION,
    ec_ms_cm          DOUBLE PRECISION,
    temperature_c     DOUBLE PRECISION,
    npk_n             DOUBLE PRECISION,
    npk_p             DOUBLE PRECISION,
    npk_k             DOUBLE PRECISION,
    metadata          JSONB
) WITH (
    tsdb.hypertable,
    tsdb.partition_column   = 'recorded_at',
    tsdb.enable_columnstore = true,
    tsdb.segmentby          = 'device_id',
    tsdb.orderby            = 'recorded_at DESC',
    tsdb.sparse_index       = 'minmax(ph),minmax(soil_moisture_pct),minmax(ec_ms_cm),minmax(temperature_c),minmax(npk_n),minmax(npk_p),minmax(npk_k)'
);

SELECT set_chunk_time_interval('sensor_readings', INTERVAL '1 day');

CREATE INDEX sensor_readings_zone_time_idx
    ON sensor_readings (zone_id, recorded_at DESC);
```

Choices:
- `recorded_at` as partition column — natural time axis, never updated.
- `segmentby = device_id` — every FE query filters by device/zone first; high row density per device per day-chunk.
- No PK — insert-heavy pattern. Add `PRIMARY KEY (device_id, recorded_at)` only if strict de-dup becomes required.
- Columnstore on; default 7-day compression policy auto-created.

### 3.2 `irrigation_events`

Activity log feeding the Irrigation → Recent Activity feed.

```sql
CREATE TABLE irrigation_events (
    occurred_at  TIMESTAMPTZ NOT NULL,
    zone_id      BIGINT      NOT NULL,
    event_type   TEXT        NOT NULL
        CHECK (event_type IN (
            'irrigation_started','irrigation_completed','irrigation_scheduled',
            'irrigation_skipped_rain','auto_triggered','manual_override',
            'emergency_stop','system_resumed'
        )),
    severity     TEXT        NOT NULL DEFAULT 'info'
        CHECK (severity IN ('info','success','warning','error')),
    duration_s   INTEGER,
    triggered_by TEXT        NOT NULL DEFAULT 'system'
        CHECK (triggered_by IN ('system','schedule','auto_rule','user')),
    user_id      BIGINT,
    details      JSONB
) WITH (
    tsdb.hypertable,
    tsdb.partition_column   = 'occurred_at',
    tsdb.enable_columnstore = true,
    tsdb.segmentby          = 'zone_id',
    tsdb.orderby            = 'occurred_at DESC'
);

SELECT set_chunk_time_interval('irrigation_events', INTERVAL '7 days');

CREATE INDEX irrigation_events_zone_time_idx
    ON irrigation_events (zone_id, occurred_at DESC);
CREATE INDEX irrigation_events_type_time_idx
    ON irrigation_events (event_type, occurred_at DESC);
```

### 3.3 Retention (commented — agree with operator first)

```sql
-- SELECT add_retention_policy('sensor_readings',   INTERVAL '365 days');
-- SELECT add_retention_policy('irrigation_events', INTERVAL '2 years');
```

---

## 4. Continuous aggregates

Two views cover the monitoring page's day / week / month toggle: hourly for the day view, daily for week+month.

### 4.1 `sensor_readings_hourly`

```sql
CREATE MATERIALIZED VIEW sensor_readings_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket(INTERVAL '1 hour', recorded_at) AS bucket,
    device_id, zone_id,
    COUNT(*)               AS sample_count,
    AVG(ph)                AS avg_ph,
    MIN(ph)                AS min_ph,
    MAX(ph)                AS max_ph,
    AVG(soil_moisture_pct) AS avg_soil_moisture_pct,
    MIN(soil_moisture_pct) AS min_soil_moisture_pct,
    MAX(soil_moisture_pct) AS max_soil_moisture_pct,
    AVG(ec_ms_cm)          AS avg_ec_ms_cm,
    MIN(ec_ms_cm)          AS min_ec_ms_cm,
    MAX(ec_ms_cm)          AS max_ec_ms_cm,
    AVG(temperature_c)     AS avg_temperature_c,
    MIN(temperature_c)     AS min_temperature_c,
    MAX(temperature_c)     AS max_temperature_c,
    AVG(npk_n)             AS avg_npk_n,
    AVG(npk_p)             AS avg_npk_p,
    AVG(npk_k)             AS avg_npk_k
FROM sensor_readings
GROUP BY bucket, device_id, zone_id;

SELECT add_continuous_aggregate_policy('sensor_readings_hourly',
    start_offset      => NULL,
    end_offset        => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes');

ALTER MATERIALIZED VIEW sensor_readings_hourly SET (
    timescaledb.enable_columnstore,
    timescaledb.segmentby = 'device_id, zone_id',
    timescaledb.orderby   = 'bucket DESC'
);
CALL add_columnstore_policy('sensor_readings_hourly', after => INTERVAL '3 days');

CREATE INDEX sensor_readings_hourly_device_bucket_idx
    ON sensor_readings_hourly (device_id, bucket DESC);
CREATE INDEX sensor_readings_hourly_zone_bucket_idx
    ON sensor_readings_hourly (zone_id,   bucket DESC);
```

### 4.2 `sensor_readings_daily`

```sql
CREATE MATERIALIZED VIEW sensor_readings_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket(INTERVAL '1 day', recorded_at) AS bucket,
    device_id, zone_id,
    COUNT(*)                                                    AS sample_count,
    AVG(ph)                                                     AS avg_ph,
    MIN(ph)                                                     AS min_ph,
    MAX(ph)                                                     AS max_ph,
    PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY ph)            AS median_ph,
    AVG(soil_moisture_pct)                                      AS avg_soil_moisture_pct,
    MIN(soil_moisture_pct)                                      AS min_soil_moisture_pct,
    MAX(soil_moisture_pct)                                      AS max_soil_moisture_pct,
    AVG(ec_ms_cm)                                               AS avg_ec_ms_cm,
    MIN(ec_ms_cm)                                               AS min_ec_ms_cm,
    MAX(ec_ms_cm)                                               AS max_ec_ms_cm,
    AVG(temperature_c)                                          AS avg_temperature_c,
    MIN(temperature_c)                                          AS min_temperature_c,
    MAX(temperature_c)                                          AS max_temperature_c,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY temperature_c) AS p95_temperature_c,
    AVG(npk_n)                                                  AS avg_npk_n,
    AVG(npk_p)                                                  AS avg_npk_p,
    AVG(npk_k)                                                  AS avg_npk_k
FROM sensor_readings
GROUP BY bucket, device_id, zone_id;

SELECT add_continuous_aggregate_policy('sensor_readings_daily',
    start_offset      => NULL,
    end_offset        => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

ALTER MATERIALIZED VIEW sensor_readings_daily SET (
    timescaledb.enable_columnstore,
    timescaledb.segmentby = 'device_id, zone_id',
    timescaledb.orderby   = 'bucket DESC'
);
CALL add_columnstore_policy('sensor_readings_daily', after => INTERVAL '7 days');

CREATE INDEX sensor_readings_daily_device_bucket_idx
    ON sensor_readings_daily (device_id, bucket DESC);
CREATE INDEX sensor_readings_daily_zone_bucket_idx
    ON sensor_readings_daily (zone_id,   bucket DESC);
```

### 4.3 Aggregate retention (commented)

```sql
-- SELECT add_retention_policy('sensor_readings_hourly', INTERVAL '2 years');
-- SELECT add_retention_policy('sensor_readings_daily',  INTERVAL '5 years');
```

---

## 5. FE → table mapping

| FE artifact                                  | Source                                                                            |
|----------------------------------------------|-----------------------------------------------------------------------------------|
| Home — 5-sensor grid                         | latest row per device from `sensor_readings` (or `sensor_readings_hourly`)        |
| Home — IoT device list                       | `devices`                                                                         |
| Home — notification bell                     | `notifications WHERE user_id = $me ORDER BY created_at DESC`                      |
| Monitoring — `sensorOverview` cards          | latest `sensor_readings_hourly` per device                                        |
| Monitoring — parameter summary (max/min/avg) | aggregate over `sensor_readings_daily` for the selected range                     |
| Monitoring — trend graph (day / week / month)| `sensor_readings_hourly` (day) / `sensor_readings_daily` (week, month)            |
| Monitoring — history table                   | `sensor_readings` joined to `devices` for names                                   |
| Irrigation — mode toggles + emergency stop   | `irrigation_zone_state`                                                           |
| Irrigation — auto-mode thresholds            | `irrigation_auto_rules`                                                           |
| Irrigation — schedule list                   | `irrigation_schedules`                                                            |
| Irrigation — recent activity feed            | `irrigation_events ORDER BY occurred_at DESC LIMIT n`                             |
| Profile — language, 2FA, name/email          | `users`                                                                           |
| Profile — measurement units + notif toggle   | `user_preferences`                                                                |
| Profile — IoT device management              | `devices`                                                                         |

---

## 6. Invariants the backend MUST uphold

1. Parameter IDs (`ph`, `soil_moisture`, `soil_ec`, `soil_npk`, `temperature`) are stable across DB, FE i18n keys, and aggregate column names. Do not rename.
2. **No `humidity` / `air_humidity` column** on any reading, aggregate, irrigation, or notification payload that surfaces to user-facing pages.
3. `irrigation_schedules.end_time >= start_time` (enforced by CHECK).
4. `irrigation_zone_state.mode` is mutually exclusive — toggling one mode clears the others at the application layer.
5. `irrigation_zone_state.emergency_stop = TRUE` overrides `mode` (treat as paused).
6. `devices.status = 'warning'` ⇒ `warning_msg IS NOT NULL` (enforced by CHECK).
7. `recovery_codes` stored hashed; consumed by setting `used_at`.
8. All timestamps are `TIMESTAMPTZ` in UTC; the FE formats with the user's locale.

---

## 7. Verification (post-migration)

```sql
SELECT hypertable_name FROM timescaledb_information.hypertables;

SELECT * FROM hypertable_compression_stats('sensor_readings');
SELECT * FROM hypertable_compression_stats('irrigation_events');

SELECT view_name, materialization_hypertable_name
FROM timescaledb_information.continuous_aggregates;

SELECT job_id, application_name, schedule_interval, hypertable_name
FROM timescaledb_information.jobs
ORDER BY job_id;
```
