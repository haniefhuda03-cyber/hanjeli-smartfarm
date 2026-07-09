# Hanjeli SmartFarm — Full System Audit & Infrastructure Design

> **Generated:** 24 Juni 2026
> **Scope:** Bug fixes applied, remaining sync issues, complete infrastructure reference
> **Method:** Direct source-code inspection of `hanjeli-fe` (Next.js 16) dan `hanjeli-be` (NestJS 11)

---

## BAGIAN A: Bug Fixes yang Sudah Diterapkan (7 Fixes)

| #     | Bug                                         | Severity   | File(s)                                           | Status   |
| ----- | ------------------------------------------- | ---------- | ------------------------------------------------- | -------- |
| FIX-1 | Dual Axios instance (two 401-refresh logic) | 🔴 Kritis  | `lib/api/client.ts`, `lib/apiClient.ts` (deleted) | ✅ Fixed |
| FIX-2 | Role type mismatch (`admin` vs `Admin`)     | 🔴 Kritis  | `lib/api/types.ts`                                | ✅ Fixed |
| FIX-3 | Cron MQTT topic mismatch                    | 🔴 Kritis  | `cron/irrigation.cron.ts`                         | ✅ Fixed |
| FIX-4 | Cron timezone (server local vs Jakarta)     | 🔴 Kritis  | `cron/irrigation.cron.ts`                         | ✅ Fixed |
| FIX-5 | Cron multi-device duplicate JOIN            | 🔴 Kritis  | `cron/irrigation.cron.ts`                         | ✅ Fixed |
| FIX-6 | Auto-mode `auto_parameter` hard-locked      | 🔴 Kritis  | `irrigation.service.ts:137-140`                   | ✅ Fixed |
| FIX-7 | 3 Socket.IO → 1 shared connection           | 🟡 Moderat | 3 hooks → `socket-provider.tsx`                   | ✅ Fixed |
| FIX-8 | Hardcoded `recentReadings` dead code        | 🟡 Moderat | `home/page.tsx`                                   | ✅ Fixed |
| FIX-9 | Sensor key `ph_level` vs `ph`               | 🟡 Moderat | `monitoring/page.tsx`, `useSensorSocket.ts`       | ✅ Fixed |

**Verification:** Frontend `tsc --noEmit` → ✅ 0 errors. Backend `nest build` → ✅ 0 errors.

### Detail Perubahan Kode

#### FIX-1: Consolidated Dual Axios Client

- Rewrote `src/lib/api/client.ts` to use `auth-session.ts` helpers (`getAccessToken`, `getRefreshToken`, `storeAuthSession`, `clearAuthSession`) and `runtime-config.ts` (`getApiBaseUrl`).
- Added `getApiErrorMessage()` utility to `src/lib/api/errors.ts` (moved from old `apiClient.ts`).
- Updated 11 files to import from `@/lib/api/client` and `@/lib/api/errors` instead of `@/lib/apiClient`.
- Deleted `src/lib/apiClient.ts`.

#### FIX-3/4/5: Rewrote Cron Job

- `irrigation.cron.ts` now uses `Intl.DateTimeFormat` with `Asia/Jakarta` timezone.
- Changed `mqttService.publish(topic, payload)` → `mqttService.publishIrrigationCommand(payload, { onTimeout })` with actions `START`/`STOP` (not `on`/`off`).
- Added `DISTINCT ON (s.id)` and `d.type = 'pump' AND d.deleted_at IS NULL` to SQL query.
- Extracted `logActivity()` private method with proper signature.

#### FIX-6: Auto-Mode Parameter Fix

- Changed `irrigation.service.ts` from hardcoded `config.auto_parameter = 'soil_moisture'` to `config.auto_parameter = dto.auto_parameter ?? next.auto_parameter ?? 'soil_moisture'` — respects DTO if provided.

#### FIX-7: Shared Socket Provider

- Created `src/providers/socket-provider.tsx` with `SocketProvider` context + `useSocket()` hook.
- Added `<SocketProvider>` to `layout.tsx` provider hierarchy (wraps `NotificationProvider`).
- Rewrote `useSensorSocket.ts` to consume shared socket via `useSocket()`.
- Rewrote `useIrrigationSocket.ts` to consume shared socket.
- Refactored `notification-context.tsx` to use shared socket for `notification:new`.

#### FIX-9: Sensor Key Standardization

- Monitoring page: changed `parameterOptions` id from `"ph_level"` → `"ph"`, default `selectedParameter` from `"ph_level"` → `"ph"`.
- Socket mapping: `'ph_level': 'ph'` → `'ph': 'ph'`.
- Removed dead `humidity` field from `RealtimeSensorPayload` interface.
- Added `soil_npk` field to `RealtimeSensorPayload`.

---

## BAGIAN B: Bug yang Masih Tersisa (Frontend ↔ Backend Sync)

### 🔴 KRITIS — Fungsionalitas Broken

#### REMAIN-01: Irrigation Schedule ID Type Mismatch

**File:** `hanjeli-fe/src/app/irrigation/page.tsx`
**Problem:** Frontend `ScheduleEntry.id` declared as `number`, backend returns UUID string.

- `Math.max(...uuids.map(s => s.id))` → `NaN`
- `String(editingScheduleId)` → `"NaN"` → backend 400 error
  **Impact:** Edit/delete irrigation schedule **always fails** against real backend.

---

#### REMAIN-02: Frontend `User` Type Mismatch

**File:** `hanjeli-fe/src/lib/api/types.ts:22-30`
**Problem:**

```
Frontend: avatar?, is2faEnabled?
Backend:  avatar_url, two_factor_enabled, email_verified, google_id, created_at
```

Any code referencing `user.avatar` or `user.is2faEnabled` gets `undefined` at runtime.

---

#### REMAIN-03: `PaginatedData<T>` Meta Shape Wrong

**File:** `hanjeli-fe/src/lib/api/types.ts:13-19`
**Problem:** Declares `meta.lastPage` but backend returns `meta.total_pages`. Type is orphaned (no importers) but any future consumer will break.

---

#### REMAIN-04: Profile Email Change — No Verification Email Sent

**File:** `hanjeli-be/src/modules/users/users.service.ts:107-112`
**Problem:** `updateProfile()` sets `email_verified = false` on email change, but **never sends a verification email**.
**Impact:** User locked out of account after changing email with no re-verification path.

---

### 🟡 MODERAT — Data Integrity, UX, Sync

#### REMAIN-05: Sensor Status `'no_data'`/`'normal'` → False Alarm

**Files:** `hanjeli-be/sensors.service.ts:~517`, `hanjeli-fe/monitoring/page.tsx:~147`
**Problem:** Backend returns `'no_data'` (null) or `'normal'` (fallback). Frontend ternary:

```
optimal → 'Aman', warning → 'Perhatian', else → 'Bahaya'
```

Both `'no_data'` and `'normal'` map to `'Bahaya'` (Danger) — false alarm on monitoring page.

---

#### REMAIN-06: Dead `humidity` in Frontend Notifications

**Files:** `notification-helpers.ts`, `notification-context.tsx`, `toast-icons.tsx`
**Problem:** `humidity` still in frontend `NotificationCategory` type and icon map. Backend migration 15 removed it from DB CHECK constraint.
**Impact:** Dead code; if any code creates `humidity` notification, backend rejects.

---

#### REMAIN-07: Socket Doesn't Re-Auth After Token Refresh

**File:** `hanjeli-fe/src/providers/socket-provider.tsx`
**Problem:** `useEffect` dependency `[]` — auth token frozen at `io()` creation. After 15-min JWT expiry, socket is unauthenticated but still connected.
**Fix:** Listen for `hanjeli:auth-changed` event and reconnect with new token.

---

#### REMAIN-08: WebSocket Alive After JWT Expiry (Backend)

**File:** `hanjeli-be/websocket-auth.service.ts`
**Problem:** Auth only at `handleConnection`. No periodic re-validation. User can control pumps through expired WebSocket.
**Fix:** Periodic token check or per-message validation.

---

#### REMAIN-09: Dead Code Files (4 files)

- `src/lib/services/mock-api.ts` — never imported
- `src/lib/services/sensor-service.ts` — dead chain
- `src/lib/mock/sensor-fixtures.ts` — stale shapes
- `src/lib/mock/users-fixtures.ts` — never imported

---

#### REMAIN-10: Profile Page Hardcoded Fake Devices

**File:** `hanjeli-fe/src/app/profile/page.tsx:101-107`
`DEFAULT_IOT_DEVICES` with 4 fake devices renders before API loads. **Fix:** Init `[]` + loading skeleton.

---

#### REMAIN-11: Irrigation Page Hardcoded Fake Schedule

**File:** `hanjeli-fe/src/app/irrigation/page.tsx:~280`
`useState([{ id: 1, name: 'Penyiraman Pagi', ... }])` — fake data. **Fix:** Init `[]` + loading state.

---

#### REMAIN-12: `res.data ? res.data : res` Anti-Pattern

**Files:** `auth.ts`, `devices.ts`, `irrigation.ts`, `sensors.ts`, `weather.ts`
Interceptor already unwraps — double-unwrap risks unwrapping non-paginated `.data` fields.

---

#### REMAIN-13: Hardcoded Indonesian Strings (Non-i18n)

Examples: `'Aman'`, `'Perhatian'`, `'Bahaya'`, `'DARURAT'`, `'Penyiraman Pagi'`, `'Belum pernah online'`, `'Tutup notifikasi'`.

---

### 🟠 SECURITY

#### REMAIN-14: Refresh Token Not Rotated

**File:** `hanjeli-be/auth.service.ts:113-119`
Old refresh token stays valid for 7 days after issuing new pair. Stolen token = persistent access.

---

#### REMAIN-15: Google OAuth Tokens in URL Query Params

**File:** `hanjeli-be/auth.controller.ts:133-146`
JWT tokens placed in 302 redirect URL → visible in browser history, server logs, Referer header.

---

#### REMAIN-16: WebSocket CORS `origin: '*'`

**Files:** `sensor.gateway.ts`, `irrigation.gateway.ts`
REST API restricts origins, but WebSocket accepts any. Cross-site WebSocket hijacking possible.

---

#### REMAIN-17: Hardcoded DB Credential Fallback

**File:** `hanjeli-be/config/data-source.ts:10-13`
Default `hanjeli_admin` / `hanjeli_password_super_aman` baked in source. Should throw in production.

---

### ⚡ PERFORMANCE

#### REMAIN-18: Every Sensor Reading → Full Device UPDATE

**File:** `hanjeli-be/mqtt-sensor.handler.ts:86-90`
Each MQTT message (every 5-30s per device) triggers `deviceRepository.save()` — WAL amplification.
**Fix:** Throttle to max once/minute per device.

---

#### REMAIN-19: CSV Export Unbounded

**File:** `hanjeli-be/sensors.service.ts:244-270`
No date range limit. User could request years of data → resource exhaustion.

---

#### REMAIN-20: IrrigationEngine `sendCommand` Redundant DB Query

**File:** `hanjeli-be/irrigation.engine.ts:312-315`
Queries `SELECT code FROM devices WHERE id = $1` per invocation, but caller already has the device.
**Fix:** Pass `device_code` as parameter.

---

### 🔄 DATA STALENESS & LOGIC

#### REMAIN-21: Engine/Cron `logActivity()` No Cache Invalidation

**Files:** `irrigation.engine.ts:362-369`, `irrigation.cron.ts:129`
Activity logged but not invalidated from cache. User sees stale list for up to 30s.

---

#### REMAIN-22: NPK Thresholds Silently Overwritten

**File:** `hanjeli-be/irrigation.service.ts:131-136`
`npk_min/max_threshold` from DTO always overwritten with sum of individual N/P/K.

---

#### REMAIN-23: Pump State Maps Lost on Restart

**File:** `hanjeli-be/irrigation.engine.ts:18-20`
In-memory `Map`s → reset to empty on restart. Possible pump-state desync.

---

#### REMAIN-24: Mode Switch to `auto` Doesn't Stop Fertilizer Pump

**File:** `hanjeli-be/irrigation.gateway.ts:70-88`
Only `water` channel gets MQTT command on mode switch. Fertilizer pump keeps running.

---

#### REMAIN-25: Double Cache Invalidation on updateConfig

**Files:** `irrigation.service.ts:144` + `irrigation.controller.ts:44`
Service `cache.invalidate()` + controller `@CacheInvalidate` → same key invalidated twice.

---

### Priority Matrix

| Priority  | Issue(s)                                      | Impact                    |
| --------- | --------------------------------------------- | ------------------------- |
| 🔴 **P0** | REMAIN-01, REMAIN-04                          | Core functionality broken |
| 🔴 **P1** | REMAIN-14, 15, 16, 17                         | Security vulnerabilities  |
| 🟡 **P2** | REMAIN-05, 07, 08, 10, 11, 21, 24             | Data integrity, UX, sync  |
| ⚡ **P3** | REMAIN-06, 09, 12, 13, 18, 19, 20, 22, 23, 25 | Cleanup, performance      |

---

## BAGIAN C: Desain Lengkap Infrastruktur

### C.1 REST API — Complete Endpoint Map

**Base path:** `/api/v3` (global prefix)
**Swagger:** `/api/v3/docs`
**Health:** `GET /` (excluded from prefix)

#### Auth Module (`/auth`) — Public endpoints

| Method | Endpoint                    | Throttle    | Request                      | Response                                                                                   |
| ------ | --------------------------- | ----------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| POST   | `/auth/register`            | 5/min       | `{ name, email, password }`  | `{ message }` + send email                                                                 |
| POST   | `/auth/login`               | 5/min       | `{ email, password }`        | `{ user, access_token, refresh_token, expires_in }` or `{ requires_2fa, challenge_token }` |
| POST   | `/auth/refresh`             | 30/min      | `{ refresh_token }`          | `{ access_token, refresh_token, expires_in }`                                              |
| POST   | `/auth/verify-email`        | 10/min      | `{ token }`                  | `{ message }`                                                                              |
| POST   | `/auth/resend-verification` | 3/min       | `{ email }`                  | `{ message }`                                                                              |
| POST   | `/auth/forgot-password`     | 3/min       | `{ email }`                  | `{ message }`                                                                              |
| POST   | `/auth/reset-password`      | 5/min       | `{ token, new_password }`    | `{ message }`                                                                              |
| POST   | `/auth/2fa/setup`           | 5/min 🔒JWT | —                            | `{ secret, otpauth_uri, qr_code_url }`                                                     |
| POST   | `/auth/2fa/enable`          | 5/min 🔒JWT | `{ token }` (6-digit)        | `{ recovery_codes: string[8] }`                                                            |
| POST   | `/auth/verify-2fa`          | 5/min       | `{ challenge_token, token }` | `{ user, access_token, refresh_token }`                                                    |
| POST   | `/auth/verify-recovery`     | 5/min       | `{ challenge_token, code }`  | `{ user, access_token, refresh_token }`                                                    |
| DELETE | `/auth/2fa`                 | 5/min 🔒JWT | —                            | `{ message }`                                                                              |
| POST   | `/auth/logout`              | — 🔒JWT     | —                            | `{ message }`                                                                              |
| GET    | `/auth/google`              | —           | Google OAuth                 | 302 → Google                                                                               |
| GET    | `/auth/google/callback`     | —           | Google callback              | 302 → frontend                                                                             |

#### Users Module (`/users`) — 🔒JWT

| Method | Endpoint           | Roles | Cache      | Response                 |
| ------ | ------------------ | ----- | ---------- | ------------------------ |
| GET    | `/users/me`        | Any   | 300s       | `PublicUser`             |
| PUT    | `/users/me`        | Any   | Invalidate | Updated `PublicUser`     |
| POST   | `/users/me/avatar` | Any   | Invalidate | `{ avatar_url }`         |
| DELETE | `/users/me`        | Any   | Invalidate | `{ message }`            |
| GET    | `/users`           | Admin | 120s       | Paginated `PublicUser[]` |
| POST   | `/users`           | Admin | Invalidate | `PublicUser`             |
| PUT    | `/users/:id`       | Admin | Invalidate | `PublicUser`             |
| DELETE | `/users/:id`       | Admin | Invalidate | `{ message }`            |

#### Devices Module (`/devices`) — 🔒JWT

| Method | Endpoint       | Cache      | Description                               |
| ------ | -------------- | ---------- | ----------------------------------------- |
| GET    | `/devices`     | 60s        | List user's devices                       |
| GET    | `/devices/:id` | 60s        | Get single device                         |
| POST   | `/devices`     | Invalidate | Create device                             |
| PUT    | `/devices/:id` | Invalidate | Update device                             |
| DELETE | `/devices/:id` | Invalidate | Soft-delete (blocked if telemetry exists) |

#### Sensors Module (`/sensors`) — 🔒JWT

| Method | Endpoint                 | Cache | Query Params                    |
| ------ | ------------------------ | ----- | ------------------------------- |
| GET    | `/sensors/latest`        | 10s   | —                               |
| GET    | `/sensors/overview`      | 10s   | —                               |
| GET    | `/sensors/quality-score` | 30s   | —                               |
| GET    | `/sensors/trend`         | 60s   | `?param&range&device_id`        |
| GET    | `/sensors/stats`         | 60s   | `?param&range&device_id`        |
| GET    | `/sensors/history`       | 30s   | `?page&limit&from&to&device_id` |
| GET    | `/sensors/export`        | —     | `?page&limit&from&to&device_id` |

**`param` allowed values:** `ph`, `ph_level`, `soil_moisture`, `soil_ec`, `soil_npk`, `temperature`
**`range` allowed:** `day` (hourly aggregates), `week`/`month` (daily aggregates)

#### Irrigation Module (`/irrigation`) — 🔒JWT

| Method | Endpoint                    | Cache      | Response                         |
| ------ | --------------------------- | ---------- | -------------------------------- |
| GET    | `/irrigation/config`        | 10s        | `IrrigationConfig` (auto-create) |
| PUT    | `/irrigation/config`        | Invalidate | Updated config                   |
| GET    | `/irrigation/schedules`     | 60s        | `IrrigationSchedule[]`           |
| POST   | `/irrigation/schedules`     | Invalidate | Created schedule                 |
| PUT    | `/irrigation/schedules/:id` | Invalidate | Updated schedule                 |
| DELETE | `/irrigation/schedules/:id` | Invalidate | Soft-delete                      |
| GET    | `/irrigation/activity`      | 30s        | Paginated activity logs          |

#### Notifications Module (`/notifications`) — 🔒JWT

| Method | Endpoint                  | Cache      | Response   |
| ------ | ------------------------- | ---------- | ---------- |
| GET    | `/notifications`          | 30s        | Paginated  |
| PATCH  | `/notifications/read-all` | Invalidate | —          |
| PATCH  | `/notifications/:id/read` | Invalidate | Updated    |
| DELETE | `/notifications`          | Invalidate | Delete all |
| DELETE | `/notifications/:id`      | Invalidate | Delete one |

#### Preferences Module (`/preferences`) — 🔒JWT

| Method | Endpoint                          | Cache      | Description                     |
| ------ | --------------------------------- | ---------- | ------------------------------- |
| GET    | `/preferences`                    | 300s       | Get all (auto-create)           |
| PUT    | `/preferences`                    | Invalidate | Language, notifications_enabled |
| PUT    | `/preferences/units`              | Invalidate | Measurement unit                |
| PUT    | `/preferences/notification-prefs` | Invalidate | Per-category notif prefs        |
| PUT    | `/preferences/sensor-thresholds`  | Invalidate | Custom thresholds               |

#### Weather Module (`/weather`) — 🔒JWT

| Method | Endpoint           | Cache | Response                                   |
| ------ | ------------------ | ----- | ------------------------------------------ |
| GET    | `/weather/current` | 900s  | Open-Meteo weather data (global cache key) |

---

### C.2 WebSocket Design (Socket.IO)

#### Architecture

```
┌──────────────────────────────────────────────────┐
│   Single Socket.IO Connection → /ws              │
│   (Shared via SocketProvider context)            │
│                                                  │
│   Auth: JWT from handshake.auth.token            │
│   Room: user:{userId}                            │
│   On auth failure: emit auth:error + disconnect  │
└──────────────────────────────────────────────────┘
        │                      │
        ▼                      ▼
┌── SensorGateway ──┐   ┌── IrrigationGateway ──────┐
│ Server→Client:    │   │ Client→Server:             │
│  sensor:realtime  │   │  irrigation:setMode        │
│  device:status    │   │  irrigation:emergencyStop  │
│  notification:new │   │  irrigation:resume         │
│                   │   │  irrigation:manualToggle   │
│                   │   │ Server→Client:             │
│                   │   │  irrigation:ack            │
│                   │   │  irrigation:status         │
│                   │   │  irrigation:emergency      │
└───────────────────┘   └────────────────────────────┘
```

#### RealtimeSensorPayload

```typescript
{
  device_code: string;
  temperature?: number;
  soil_moisture?: number;
  ph?: number;
  ec?: number;
  soil_npk?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ts: number;
}
```

#### Irrigation Commands (Client→Server)

| Event                      | Payload                                               |
| -------------------------- | ----------------------------------------------------- |
| `irrigation:setMode`       | `{ mode, config? }`                                   |
| `irrigation:emergencyStop` | —                                                     |
| `irrigation:resume`        | —                                                     |
| `irrigation:manualToggle`  | `{ active, speed?, channel?: 'water'\|'fertilizer' }` |

---

### C.3 MQTT Design

#### Topic Map

| Topic                        | Direction          | Purpose                       |
| ---------------------------- | ------------------ | ----------------------------- |
| `hanjeli/sensor/+`           | In (ESP32→Server)  | Sensor telemetry              |
| `hanjeli/+/sensor`           | In (legacy)        | Legacy sensor                 |
| `hanjeli/device/+/status`    | In (ESP32→Server)  | Device online/offline/warning |
| `hanjeli/irrigation/command` | Out (Server→ESP32) | Pump commands + request_id    |
| `hanjeli/irrigation/ack`     | In (ESP32→Server)  | Command ACK                   |
| `hanjeli/+/irrigation/ack`   | In (legacy)        | Legacy ACK                    |

#### Command Payload (Server→ESP32)

```typescript
{
  action: 'START' | 'STOP' | 'EMERGENCY_STOP' | 'RESUME',
  mode?: 'auto' | 'manual' | 'scheduled' | 'off',
  channel?: 'water' | 'fertilizer',
  speed?: number,           // 0-100
  device_code?: string,
  user_id?: string,
  ts: number,               // auto
  request_id: string        // UUID v4
}
```

#### ACK Tracking Flow

```
publishIrrigationCommand()
  → generates request_id (UUID)
  → add to pendingCommands Map (timeout default 10s)
  → publish to hanjeli/irrigation/command

ESP32 → publishes ACK to hanjeli/irrigation/ack
MqttIrrigationHandler → matches request_id → clears timer
On timeout → onTimeout → log activity warning
```

---

### C.4 Cache Design (Redis + In-Memory Fallback)

```
Dual-layer:
  Layer 1: In-Memory Map (always active)
  Layer 2: Redis ioredis (when REDIS_ENABLED=true)
Key prefix: hanjeli (configurable)
Pattern delete: Redis SCAN+glob / Memory regex
```

#### Complete TTL Map

| Endpoint                     | Key Pattern                           | TTL  |
| ---------------------------- | ------------------------------------- | ---- |
| GET `/users/me`              | `user:profile:{userId}`               | 300s |
| GET `/users`                 | `users:list:{hash}`                   | 120s |
| GET `/devices`               | `devices:{userId}`                    | 60s  |
| GET `/devices/:id`           | `devices:{userId}:{hash}`             | 60s  |
| GET `/sensors/latest`        | `sensor:latest:{userId}`              | 10s  |
| GET `/sensors/overview`      | `sensor:overview:{userId}`            | 10s  |
| GET `/sensors/quality-score` | `sensor:quality:{userId}`             | 30s  |
| GET `/sensors/trend`         | `sensor:trend:{userId}:{hash}`        | 60s  |
| GET `/sensors/stats`         | `sensor:stats:{userId}:{hash}`        | 60s  |
| GET `/sensors/history`       | `sensor:history:{userId}:{hash}`      | 30s  |
| GET `/irrigation/config`     | `irrigation:config:{userId}`          | 10s  |
| GET `/irrigation/schedules`  | `irrigation:schedules:{userId}`       | 60s  |
| GET `/irrigation/activity`   | `irrigation:activity:{userId}:{hash}` | 30s  |
| GET `/notifications`         | `notifications:{userId}:{hash}`       | 30s  |
| GET `/preferences`           | `preferences:{userId}`                | 300s |
| GET `/weather/current`       | `weather:current` (global)            | 900s |

#### Invalidation Triggers

| Trigger             | Keys Invalidated                         |
| ------------------- | ---------------------------------------- |
| Profile write       | `user:profile:{userId}`, `users:list:*`  |
| Device CRUD         | `devices:{userId}`, `devices:{userId}:*` |
| Irrigation config   | `irrigation:config:{userId}`             |
| Irrigation schedule | `irrigation:schedules:{userId}`          |
| MQTT telemetry      | `sensor:*:{userId}`, `devices:{userId}*` |
| Notification write  | `notifications:{userId}:*`               |
| Preferences write   | `preferences:{userId}`                   |

---

### C.5 Database Schema (PostgreSQL 15 + TimescaleDB)

#### 13 Tables (11 relational + 2 hypertables)

```
users (UUID PK, soft-delete)
├── auth_tokens (FK→users CASCADE)
├── recovery_codes (FK→users CASCADE)
├── user_preferences (FK→users UNIQUE 1:1)
│   ├── user_measurement_units (FK→preferences)
│   ├── user_notification_prefs (FK→users)
│   └── user_sensor_thresholds (FK→users)
├── devices (FK→users, soft-delete)
│   └── sensor_telemetry ★ HYPERTABLE (FK→devices RESTRICT)
├── irrigation_configs (FK→users UNIQUE 1:1)
├── irrigation_schedules (FK→users, soft-delete)
├── irrigation_activity_logs ★ HYPERTABLE (FK→users)
└── notifications (FK→users)
```

#### 19 Migrations

| #   | Migration                    | Purpose                          |
| --- | ---------------------------- | -------------------------------- |
| 1   | CreateEnums                  | 7 ENUM types                     |
| 2   | CreateUsersTable             | `users` + pgcrypto               |
| 3   | CreateRecoveryCodes          | `recovery_codes`                 |
| 4   | CreateUserPreferences        | `user_preferences`               |
| 5   | CreateUserMeasurementUnits   | `user_measurement_units`         |
| 6   | CreateDevicesTable           | `devices`                        |
| 7   | CreateSensorTelemetry        | `sensor_telemetry` + CHECKs      |
| 8   | CreateIrrigationConfigs      | `irrigation_configs`             |
| 9   | CreateIrrigationSchedules    | `irrigation_schedules`           |
| 10  | CreateIrrigationActivityLogs | `irrigation_activity_logs`       |
| 11  | CreateNotifications          | `notifications`                  |
| 12  | CreateIndexes                | Composite indexes                |
| 13  | SetupTimescaleDB             | Hypertables + views + policies   |
| 14  | SeedInitialData              | Dev data (skipped in production) |
| 15  | Batch1EntityFoundation       | role, drop humidity, daily stats |
| 16  | CreateAuthTokens             | `auth_tokens` table              |
| 17  | AddIrrigationThresholdRanges | Range + manual pump columns      |
| 18  | AddSensorNpkComponents       | N/P/K individual columns         |
| 19  | SetIrrigationDefaultsOff     | Safe defaults (mode=off)         |

---

### C.6 Environment Variables

#### Backend (`hanjeli-be/.env`)

| Variable                       | Default                     | Purpose               |
| ------------------------------ | --------------------------- | --------------------- |
| `DB_HOST`                      | localhost                   | PostgreSQL host       |
| `DB_PORT`                      | 5433                        | PostgreSQL port       |
| `DB_USERNAME`                  | hanjeli_admin               | DB user               |
| `DB_PASSWORD`                  | hanjeli_password_super_aman | DB password           |
| `DB_NAME`                      | hanjeli_smartfarm_db        | Database              |
| `JWT_ACCESS_SECRET`            | (must set)                  | Access token key      |
| `JWT_REFRESH_SECRET`           | (must set)                  | Refresh token key     |
| `JWT_CHALLENGE_SECRET`         | (must set)                  | 2FA challenge key     |
| `TWO_FACTOR_ENCRYPTION_SECRET` | (must set)                  | pgcrypto for TOTP     |
| `AUTH_TOKEN_HASH_SECRET`       | (must set)                  | HMAC for email tokens |
| `SEED_ADMIN_EMAIL`             | admin@hanjeli.local         | Seed admin            |
| `SEED_ADMIN_PASSWORD`          | (must set, min 8)           | Seed password         |
| `REDIS_ENABLED`                | false                       | Enable Redis          |
| `MQTT_ENABLED`                 | false                       | Enable MQTT           |
| `MQTT_BROKER_URL`              | mqtt://localhost:1883       | Broker URL            |
| `FRONTEND_ORIGINS`             | http://localhost:3001       | CORS origins          |
| `SMTP_HOST`                    | smtp.example.com            | SMTP server           |

#### Frontend (`hanjeli-fe/.env.local`)

| Variable              | Default                      | Purpose       |
| --------------------- | ---------------------------- | ------------- |
| `NEXT_PUBLIC_API_URL` | http://localhost:3000/api/v3 | API URL       |
| `NEXT_PUBLIC_WS_URL`  | http://localhost:3000/ws     | WebSocket URL |

---

## BAGIAN D: Database Bootstrap Script

**One-liner untuk setup dari nol:**

```bash
docker compose up -d && cd hanjeli-be && npm install && npm run db:setup
```

`db:setup` menjalankan:

1. `npm run build` (compile TS)
2. `npx typeorm migration:run` (19 migrations)
3. `node dist/database/seed.js` (admin + defaults)

**Verification:**

```bash
# Cek hypertables
docker exec -it hanjeli-timescaledb psql -U hanjeli_admin -d hanjeli_smartfarm_db \
  -c "SELECT hypertable_name FROM timescaledb_information.hypertables;"
# Expected: sensor_telemetry, irrigation_activity_logs

# Cek admin user
docker exec -it hanjeli-timescaledb psql -U hanjeli_admin -d hanjeli_smartfarm_db \
  -c "SELECT email, role, email_verified FROM users;"
```

---

## BAGIAN E: Rekomendasi Fix Selanjutnya

Prioritas berdasarkan impact ke fungsionalitas:

1. **REMAIN-01** (Schedule ID type) — edit/delete irrigation schedule selalu gagal
2. **REMAIN-04** (Email change lockout) — user terkunci setelah ganti email
3. **REMAIN-05** (Sensor status false alarm) — monitoring page false danger
4. **REMAIN-14** (Refresh token rotation) — security
5. **REMAIN-07/08** (Socket JWT re-auth) — WebSocket stale after token expiry
6. **REMAIN-06** (Dead humidity) — cleanup
7. **REMAIN-09** (Dead code files) — cleanup
