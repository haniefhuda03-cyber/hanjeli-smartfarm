# Hanjeli SmartFarm — Test Case Catalog

> Companion to **PRD.md** and **System_Architecture.md**. Turns the testing strategy into concrete, traceable test cases.
> **Legend:** Priority **P0** (blocker / core flow), **P1** (important), **P2** (edge/nice‑to‑have). Layer: **U**nit, **I**ntegration(API↔DB), **A**PI, **WS**, **MQTT**, **E2E**.
> Each case references the acceptance criteria (ACxx) and verification findings (Vxx) in the main doc where relevant.
> **Pre‑req for all E2E/UI cases:** viewport **≥1024px** (mobile is gated, V6). Default base URL `http://localhost:3001`; API `http://localhost:3000/api/v3`.

---

## 1. Authentication & Authorization

### 1.1 Registration & Email Verification

| ID | P | Layer | Steps | Expected |
|----|---|-------|-------|----------|
| AUTH-REG-01 | P0 | A | `POST /auth/register {name,email(new),password:"StrongPass1"}` | `201`; body `{message, user}`; user `role=Guest`, `email_verified=false`; DB has bcrypt `password_hash` + an `email_verification` `auth_tokens` row. (AC1‑2) |
| AUTH-REG-02 | P0 | A | Register with an email that already exists | `409 "Email sudah digunakan"`; no second row. (AC1) |
| AUTH-REG-03 | P1 | A | Register with email of a **soft‑deleted** user | `409` (lookup uses `withDeleted:true`). |
| AUTH-REG-04 | P1 | A | Register password length 7 / >72 / missing uppercase via API | `400` with `fields[]`. |
| AUTH-REG-05 | P1 | A | Exceed 5 registers/min from same client | `429`. |
| AUTH-VER-01 | P0 | A | `POST /auth/verify-email {token}` with valid token | `200`; user `email_verified=true`; token `used_at` set. (AC4) |
| AUTH-VER-02 | P1 | A | Reuse the same verify token | `400 "Token tidak valid atau sudah kedaluwarsa"`. (AC4) |
| AUTH-VER-03 | P1 | A | Verify with expired token (set `expires_at` in past) | `400`. |
| AUTH-VER-04 | P1 | A | `POST /auth/resend-verification {email}` for unverified user | `200`; new token issued, prior active ones revoked. |
| AUTH-VER-05 | P2 | A | Resend for already‑verified user | `400 "Email sudah terverifikasi"`. |
| AUTH-REG-E2E | P0 | E2E | `/register` → fill valid form, agree terms → submit | Redirect to `/register/verify-email?email=…`; checklist all green enabled submit. |
| AUTH-REG-E2E2 | P1 | E2E | Submit with mismatched confirm / unchecked terms | Submit button disabled; mismatch shows red X icon. |

### 1.2 Login, Refresh, Logout

| ID | P | Layer | Steps | Expected |
|----|---|-------|-------|----------|
| AUTH-LOG-01 | P0 | A | `POST /auth/login` valid creds, 2FA off, verified | `200` `{access_token,refresh_token,token_type:'Bearer',expires_in,user}`. (AC5) |
| AUTH-LOG-02 | P0 | A | Login with wrong password | `401 "Email atau password salah"`. |
| AUTH-LOG-03 | P0 | A | Login with unverified email | `401 "Email belum diverifikasi"`. |
| AUTH-LOG-04 | P1 | A | Login to an OAuth‑only account (no `password_hash`) with a password | `401` (generic). |
| AUTH-LOG-05 | P1 | A | Exceed 5 logins/min | `429`. |
| AUTH-REF-01 | P0 | A | `POST /auth/refresh {refresh_token}` valid | `200` new token pair. (AC9) |
| AUTH-REF-02 | P1 | A | Refresh with an **access** token instead of refresh | `401 "Refresh token tidak valid"`. |
| AUTH-REF-03 | P1 | A | Refresh with malformed/expired refresh token | `401`. |
| AUTH-OUT-01 | P1 | A | `POST /auth/logout` (Bearer) | `200`; outstanding unused/unrevoked `auth_tokens` for the user are revoked. |
| AUTH-LOG-E2E | P0 | E2E | `/login` valid creds | Tokens in `localStorage`; redirect `/home`. |

### 1.3 Two‑Factor (TOTP) & Recovery

| ID | P | Layer | Steps | Expected |
|----|---|-------|-------|----------|
| 2FA-SET-01 | P0 | A | `POST /auth/2fa/setup` (Bearer, 2FA off) | `200 {secret, otpauth_uri}`; `users.two_factor_secret` (bytea) populated; **not yet enabled**. |
| 2FA-SET-02 | P1 | A | `setup` when 2FA already on | `400 "2FA sudah aktif"`. |
| 2FA-EN-01 | P0 | A | `POST /auth/2fa/enable {token=valid TOTP}` | `200 {message, recovery_codes[8]}`; `two_factor_enabled=true`; 8 bcrypt recovery_codes rows. |
| 2FA-EN-02 | P0 | A | `enable` with wrong TOTP | `401 "Kode 2FA tidak valid"`; stays disabled. |
| 2FA-CHAL-01 | P0 | A | Login with 2FA on | `200 {requires_2fa:true, challenge_token, expires_in}`; **no access token**. (AC6) |
| 2FA-VER-01 | P0 | A | `POST /auth/verify-2fa {challenge_token, token=valid}` | `200` token pair. (AC7) |
| 2FA-VER-02 | P1 | A | verify‑2fa with wrong code | `401`. |
| 2FA-VER-03 | P1 | A | verify‑2fa with expired challenge token | `401`. |
| 2FA-REC-01 | P0 | A | `POST /auth/verify-recovery {challenge_token, code=valid}` | `200` tokens; that code `is_used=true`. (AC8) |
| 2FA-REC-02 | P0 | A | Reuse the same recovery code | `401 "Recovery code tidak valid"`. (AC8) |
| 2FA-DIS-01 | P1 | A | `DELETE /auth/2fa` (Bearer) | `200`; `two_factor_enabled=false`, secret cleared, recovery codes deleted. |
| 2FA-E2E-01 | P0 | E2E | Profile → enable 2FA → scan QR → enter code → see recovery codes → copy/download | QR rendered from `otpauth_uri`; codes downloadable as `hanjeli-recovery-codes.txt`. |
| 2FA-E2E-02 | P0 | E2E | Login (2FA user) → `/login/verify-2fa` → enter OTP | Redirect `/home`; challenge token cleared from sessionStorage. |
| 2FA-E2E-03 | P1 | E2E | On verify‑2fa → "use recovery code" → `/login/recovery` → enter `XXXX-XXXX` | Redirect `/home`. |

### 1.4 Password Reset & Google OAuth

| ID | P | Layer | Steps | Expected |
|----|---|-------|-------|----------|
| PWD-01 | P0 | A | `POST /auth/forgot-password {email=existing}` | `200` generic message; `password_reset` token created + email sent. |
| PWD-02 | P0 | A | forgot‑password for unknown email / OAuth‑only | `200` **identical** generic message (no enumeration). |
| PWD-03 | P0 | A | `POST /auth/reset-password {token, new_password}` valid | `200`; password updated; token `used_at` set; other active reset tokens revoked. |
| PWD-04 | P1 | A | reset with reused/expired token | `400`. |
| PWD-05 | P1 | E2E | `/reset-password` with no `token` query / `token=expired` | Renders "link invalid"/"link expired" states with re‑request CTA. |
| OAUTH-01 | P1 | A/E2E | `GET /auth/google` (stub Google) returning new account | Callback redirects to FE `?type=oauth&access_token&refresh_token&token_type`; user created Guest, `email_verified=true`. (AC10) |
| OAUTH-02 | P1 | A | Returning Google user with 2FA on | Callback redirect carries `requires_2fa=true&challenge_token`. |
| OAUTH-03 | P2 | A | Google account with no email | `401 "Akun Google tidak memiliki email"`. |

### 1.5 Authorization Matrix (P0 — security)

| ID | P | Layer | Steps | Expected |
|----|---|-------|-------|----------|
| AUTHZ-01 | P0 | A | Call each protected GET with **no** token (`/users/me`, `/devices`, `/sensors/overview`, `/irrigation/config`, `/notifications`, `/preferences`, `/weather/current`) | `401` each. (AC31) |
| AUTHZ-02 | P0 | A | Guest token → `GET /users`, `POST /users`, `PUT/DELETE /users/:id` | `403` each. (AC26) |
| AUTHZ-03 | P0 | A | Admin deletes **own** id via `DELETE /users/:id` | `403`. (AC27) |
| AUTHZ-04 | P0 | A | Guest token → `GET/PUT /irrigation/*` | **Currently `200`** (no `@Roles` on irrigation). Document as security finding — FE hides the tab but API does not enforce. |
| AUTHZ-05 | P1 | A | Guest token → `GET /weather/current` | `200` (RolesGuard present but no `@Roles`). |
| AUTHZ-06 | P1 | A | User A token → read/patch User B's notification/device id | `404` (ownership scoping). |
| AUTHZ-07 | P0 | E2E | Visit `/home` with no token | Redirect `/login` (client guard). |
| AUTHZ-08 | P0 | E2E | Guest visits `/users` or `/irrigation` directly | Redirect `/home`; tabs hidden in nav. (V7) |
| AUTHZ-09 | P1 | E2E | `/dev` in production build | Redirect `/` (middleware). |

---

## 2. Sensors & Monitoring

| ID | P | Layer | Steps | Expected |
|----|---|-------|-------|----------|
| SEN-OVR-01 | P0 | A | `GET /sensors/overview` (seeded user, WS004 has data) | `200` latest reading + `parameters[5]` `{key,label,value,unit,status}`; NPK card has `nitrogen/phosphorus/potassium`. (AC11) |
| SEN-OVR-02 | P1 | A | overview for a user with **no** devices/telemetry | `200 null`. |
| SEN-QUA-01 | P0 | A | `GET /sensors/quality-score` | `200 {score(0‑100), status band, reasons[], captured_at, device}`. (AC12) |
| SEN-QUA-02 | P1 | U | Engine: feed pH=9 (out of allowed) | score penalized 20; reason "pH tanah di luar rentang optimal". |
| SEN-QUA-03 | P1 | U | Feed null pH | penalty 8 + "data belum tersedia"; status band per score. |
| SEN-TRD-01 | P0 | A | `GET /sensors/trend?param=ph&range=day` | reads `sensor_hourly_stats`; `200 [{label:ISO,value}]`. (AC13) |
| SEN-TRD-02 | P0 | A | `range=week`/`month` | reads `sensor_daily_stats`. (AC13) |
| SEN-TRD-03 | P1 | A | trend scoped to user's devices only; `device_id` of another user | `404 "Device sensor tidak ditemukan"`. |
| SEN-STA-01 | P1 | A | `GET /sensors/stats?param=soil_moisture&range=week` | `200 {param,range,min,max,avg,sample_count}`. |
| SEN-HIS-01 | P0 | A | `GET /sensors/history?page=1&limit=5` | `200 {data[],meta{page,limit,total,total_pages}}`. (AC14) |
| SEN-HIS-02 | P0 | A | history `from > to` | `400 "Tanggal awal tidak boleh setelah tanggal akhir"`. (AC14) |
| SEN-HIS-03 | P1 | A | history `limit=500` | capped at 100. |
| SEN-EXP-01 | P1 | A | `GET /sensors/export` | `200` `text/csv`, `Content-Disposition: attachment; filename=sensor_history.csv`; header row exactly the 12 columns. (AC15) |
| SEN-CACHE-01 | P1 | A | Two rapid `GET /sensors/overview` | 2nd served from cache (TTL 10s); after a new telemetry insert the cache is busted and value changes. |
| MON-E2E-01 | P0 | E2E | `/monitoring` → switch parameter dropdown + day/week/month | trend + stats refetch and chart updates. |
| MON-E2E-02 | P1 | E2E | history date filter + pagination + export button | rows filter; pages change; export triggers download. |
| HOME-E2E-01 | P0 | E2E | `/home` | 5 sensor cards render; NPK shows N/P/K bars; quality donut + score present; **no humidity card** (V10). |

---

## 3. Real‑Time: MQTT ingest & WebSocket

| ID | P | Layer | Steps | Expected |
|----|---|-------|-------|----------|
| MQTT-ING-01 | P0 | MQTT | Publish `hanjeli/sensor/WS004 {ph,moisture,ec,n,p,k,temp,ts}` | `sensor_telemetry` row inserted; device→`online`+`last_seen_at`; caches busted; `sensor:realtime` broadcast to owner's room; engine evaluated. (AC16) |
| MQTT-ING-02 | P1 | MQTT | Publish legacy `hanjeli/WS004/sensor` | same handling. |
| MQTT-ING-03 | P1 | MQTT | Payload with `ph_level` instead of `ph`, `nitrogen/phosphorus/potassium` instead of `n/p/k` | parsed identically; `soil_npk` = sum when explicit npk absent. |
| MQTT-ING-04 | P1 | MQTT | Payload with unknown device `code` | ignored + warn log; no row. |
| MQTT-ING-05 | P1 | MQTT | Missing code (topic + payload) | ignored + warn. |
| MQTT-ING-06 | P1 | MQTT | Malformed JSON | ignored + "Malformed MQTT JSON" log; no crash. |
| MQTT-ING-07 | P2 | MQTT/I | Publish ph=20 (>14) | DB CHECK rejects insert; handler logs error; no row. |
| MQTT-STA-01 | P1 | MQTT | Publish `hanjeli/device/WS004/status {status:'warning',message}` | device status/message updated; `device:status` broadcast; devices cache busted. |
| MQTT-ACK-01 | P0 | MQTT | Engine/gateway sends command → ESP responds `hanjeli/irrigation/ack {request_id, status:'success'}` | pending resolved; `success` activity log; `irrigation:ack` broadcast. |
| MQTT-ACK-02 | P0 | MQTT | Send command, **withhold** ACK 10s | timeout fires; `warning` activity log "belum mengirim ACK". |
| MQTT-ACK-03 | P2 | MQTT | ACK with unknown `request_id` | logged "tanpa request aktif". |
| MQTT-OFF-01 | P1 | MQTT | `MQTT_ENABLED=false` | REST/WS still work; `publish` no‑ops with warn. |
| WS-CON-01 | P0 | WS | Connect to `/ws` with valid access token | joins room `user:<id>`; receives own broadcasts only. |
| WS-CON-02 | P0 | WS | Connect with no/invalid token | `auth:error` then disconnect. |
| WS-ISO-01 | P1 | WS | User A + User B connected; telemetry for A | only A receives `sensor:realtime`. |
| WS-REC-01 | P2 | WS | Drop + reconnect | re‑authenticates, resumes events. |

---

## 4. Irrigation Engine & Control

| ID | P | Layer | Steps | Expected |
|----|---|-------|-------|----------|
| IRR-CFG-01 | P0 | A | `GET /irrigation/config` for user with none | auto‑creates default `off` config; `200`. (AC17) |
| IRR-CFG-02 | P1 | A | `PUT /irrigation/config {water_min:90,water_max:80}` | `400` (min<max). (AC22) |
| IRR-CFG-03 | P1 | A | `PUT {manual_water_enabled:true, manual_fertilizer_enabled:true}` | `400` (mutual exclusivity). (AC21) |
| IRR-CFG-04 | P1 | A | `PUT {auto_parameter:'ph'}` then GET | persisted value is forced back to `soil_moisture` (V8). |
| IRR-ENG-01 | P0 | U | auto mode, moisture < water_min | water pump START command + `info` log. (AC18) |
| IRR-ENG-02 | P0 | U | auto mode, moisture > water_max | water pump STOP + `success` log. (AC18) |
| IRR-ENG-03 | P1 | U | moisture within [min,max], pump previously on | stays on (hysteresis, no new command). (AC18) |
| IRR-ENG-04 | P0 | U | any of N/P/K < min | fertilizer START; water forced OFF; `warning` log on transition. (AC19) |
| IRR-ENG-05 | P1 | U | N/P/K > max | fertilizer held off; `warning` log. (AC19) |
| IRR-ENG-06 | P1 | U | N/P/K return to normal after low/high | `success` "kembali dalam rentang" log (deduped). |
| IRR-ENG-07 | P0 | U | `emergency_stop=true` + telemetry | both pumps forced OFF (`EMERGENCY_STOP`), engine returns early regardless of mode. (AC20) |
| IRR-ENG-08 | P1 | U | `active_mode != 'auto'` (not emergency) | engine no‑ops. |
| IRR-SCH-01 | P0 | A | `POST /irrigation/schedules` with no day true | `400 "Pilih minimal satu hari"`. (AC23) |
| IRR-SCH-02 | P0 | A | schedule `start_time >= end_time` | `400`. (AC23) |
| IRR-SCH-03 | P1 | A | valid create/update/delete | `201/200`; activity log written; schedules cache busted. |
| IRR-CRON-01 | P1 | MQTT | Set user `active_mode='scheduled'`, schedule starting this minute; wait for cron | **Investigate (V3):** command published to `hanjeli/${code}/irrigation/cmd` which ESP32 may not subscribe; activity log written. |
| IRR-CRON-02 | P2 | I | scheduled user with **2 devices** | **Investigate (V4):** duplicate commands/logs (one per device). |
| IRR-WS-01 | P0 | WS | emit `irrigation:setMode {mode:'auto', config}` | config persisted, RESUME water cmd, `irrigation:status` broadcast, returns `{success,config}`. |
| IRR-WS-02 | P0 | WS | emit `irrigation:emergencyStop` | `emergency_stop=true`, EMERGENCY_STOP both channels, `irrigation:emergency{active:true}` + status. (AC20) |
| IRR-WS-03 | P0 | WS | emit `irrigation:resume` | `emergency_stop=false`, RESUME, `irrigation:emergency{active:false}`. |
| IRR-WS-04 | P1 | WS | `irrigation:manualToggle {active:true, channel:'fertilizer'}` while water on | water forced off, fertilizer on (mutual exclusion), activity log. |
| IRR-E2E-01 | P0 | E2E | `/irrigation` toggle Auto/Scheduled/Manual | modes mutually exclusive; emergency banner disables controls. |
| IRR-E2E-02 | P1 | E2E | manual water + fertilizer toggles | enabling one disables the other in UI. |
| IRR-E2E-03 | P1 | E2E | add/edit/delete schedule via modal | requires ≥1 day; start auto‑clamps end. |

---

## 5. Devices

| ID | P | Layer | Steps | Expected |
|----|---|-------|-------|----------|
| DEV-01 | P0 | A | `POST /devices {name, code:'#ws010', type:'sensor'}` | `201`; code normalized to `WS010`; default status `offline`. (AC24) |
| DEV-02 | P0 | A | create with existing code (incl soft‑deleted) | `409 "Kode device sudah digunakan"`. (AC24) |
| DEV-03 | P0 | A | `DELETE /devices/:id` where device has telemetry (e.g. WS004) | `409` (history protection). (AC25) |
| DEV-04 | P1 | A | `DELETE` a device with **no** telemetry | `200`; soft‑deleted. |
| DEV-05 | P1 | A | `GET /devices/:id` of another user's device | `404`. |
| DEV-06 | P2 | A | create `status:'online'` | `last_seen_at` set to now. |

---

## 6. Users (Admin) & Profile

| ID | P | Layer | Steps | Expected |
|----|---|-------|-------|----------|
| USR-01 | P0 | A | Admin `GET /users?q=admin&role=Admin&page=1&limit=20` | `200 {data[],meta}` filtered. |
| USR-02 | P0 | A | Admin `POST /users {name,email,password,role}` | `201`; created `email_verified=true`. |
| USR-03 | P1 | A | Admin `PUT /users/:id {role:'Admin'}` | `200`; role updated. |
| USR-04 | P1 | A | Admin `POST /users` with duplicate email | `409`. |
| USR-E2E-01 | P0 | E2E | `/users` (admin) create/edit/delete | optimistic update + list invalidation; search + role filter + 5/page client pagination. |
| USR-E2E-02 | P1 | E2E | admin tries to delete own row | blocked / `403` surfaced. |
| PRF-01 | P0 | A | `GET /users/me` (Bearer) | `200` PublicUser (no `password_hash`). |
| PRF-02 | P0 | A | `PUT /users/me {password, currentPassword=correct}` | `200`; password changed. |
| PRF-03 | P0 | A | `PUT /users/me {password}` without `currentPassword` | `401 "Kata sandi saat ini diperlukan"`. |
| PRF-04 | P1 | A | `PUT /users/me {email:new}` | `200`; `email_verified=false`. (AC28) |
| PRF-05 | P1 | A | `POST /users/me/avatar` valid PNG ≤2MB | `200`; `avatar_url` absolute under `/uploads/avatars/`; file served. |
| PRF-06 | P1 | A | avatar non‑image or >2MB | `400`. |
| PRF-07 | P0 | A | `DELETE /users/me {password=correct, twoFactorToken (if 2FA)}` | `200`; soft‑deleted. (Flow L) |
| PRF-08 | P1 | A | `DELETE /users/me` wrong password | `401`. |
| PRF-E2E-01 | P1 | E2E | Profile → change password / edit profile / units / thresholds panels | each saves + toasts success. |
| PRF-E2E-02 | P2 | E2E | Profile email‑change "send token"/"confirm" step | **Note V5:** these are UI‑only/mocked — no backend token is verified; document actual behaviour. |
| PRF-E2E-03 | P0 | E2E | delete account: type‑confirm + password (+2FA) | session cleared; redirect `/login`. |

---

## 7. Preferences, Notifications, Weather

| ID | P | Layer | Steps | Expected |
|----|---|-------|-------|----------|
| PREF-01 | P0 | I | First `GET /preferences` for a fresh user | seeds 5 units + 6 notif prefs + 4 thresholds; returns all. (AC29) |
| PREF-02 | P1 | A | `PUT /preferences/units {parameter_key:'temperature', unit_value:'°F'}` | `200`. |
| PREF-03 | P1 | A | unit not in allow‑list (e.g. temperature `'kelvin'`) | `400`. (AC30) |
| PREF-04 | P1 | A | `PUT /preferences/sensor-thresholds {min>=max}` | `400`. (AC30) |
| PREF-05 | P2 | A | `PUT /preferences/notification-prefs {category,channel,enabled}` | upsert; `200`. |
| PREF-06 | P2 | A | FE `updateSensorThresholds` sends an **array** | **Mismatch:** API expects single object; verify behaviour (V/§2.7.7). |
| NOT-01 | P0 | A | `GET /notifications?limit=50` | `200 {data[],meta}`. |
| NOT-02 | P1 | A | `PATCH /notifications/:id/read` then `read-all` | item then all marked read; counts update. |
| NOT-03 | P1 | A | `DELETE /notifications/:id` and `DELETE /notifications` | single + bulk delete; `404` for other user's id. |
| NOT-WS-01 | P0 | WS/E2E | server emits `notification:new` | single Sonner toast (deduped within 2s) + bell ring + persisted item. |
| WEA-01 | P1 | A | `GET /weather/current` (Open‑Meteo reachable) | `200` `source:'open-meteo'`, cached second call. |
| WEA-02 | P1 | A | Open‑Meteo unreachable (mock failure) | `200` fallback (24°C/"Cerah"/`source:'fallback'`). |

---

## 8. Cross‑Cutting (resilience, security, error envelope)

| ID | P | Layer | Steps | Expected |
|----|---|-------|-------|----------|
| X-ERR-01 | P0 | A | Any validation failure | `{success:false,statusCode,message,error:'Bad Request',fields[],details[],path,timestamp}`. (AC32) |
| X-ERR-02 | P1 | A | Force a 500 (e.g. DB down) | generic `"Terjadi kesalahan pada server"`; stack logged server‑side only. |
| X-AUTH-REFRESH-01 | P0 | E2E | Let access token expire, trigger any API call | interceptor refreshes once via `/auth/refresh`, retries original request transparently — **test both Axios clients** (V2). |
| X-AUTH-REFRESH-02 | P0 | E2E | Refresh token also invalid | session cleared + redirect `/login` (not on auth pages). |
| X-SESS-01 | P1 | E2E | Reload after login | session restored from `localStorage`. |
| X-SESS-02 | P1 | E2E | Logout | tokens+user cleared; redirect `/login`. |
| X-RES-01 | P1 | I | Redis off (`REDIS_ENABLED=false`) | app works via in‑memory cache; no errors. |
| X-RES-02 | P1 | I | SMTP unset, trigger verification email | `503 "Konfigurasi SMTP belum lengkap"` only on email actions. |
| X-CORS-01 | P1 | A | Request from a non‑allow‑listed origin with credentials | blocked by CORS; allowed origins succeed. (AC33) |
| X-SEC-01 | P1 | A | Inspect responses | helmet headers present; CSP off in non‑prod. |
| X-SEC-02 | P2 | WS | WS gateway `cors.origin:'*'` | document as security review item. |
| X-I18N-01 | P2 | E2E | Toggle language id↔en | all strings re‑render; default `id`. |
| X-MOBILE-01 | P1 | E2E | Open any page at <1024px | maintenance overlay shown (V6). |

---

## 9. Suggested execution order (smoke → full)

1. **Smoke (P0 only):** AUTH-REG-01/02, AUTH-VER-01, AUTH-LOG-01/03, 2FA-CHAL-01/2FA-VER-01, AUTHZ-01/02/03, SEN-OVR-01, MQTT-ING-01, MQTT-ACK-01/02, IRR-ENG-01/02/07, IRR-WS-02, DEV-03, PREF-01, NOT-WS-01, X-AUTH-REFRESH-01.
2. **Core (P0+P1):** all of §1–§7 P0/P1.
3. **Full (incl P2 + edge):** add resilience, i18n, CORS, V‑finding investigations (IRR-CRON-01/02, IRR-CFG-04, PRF-E2E-02, PREF-06, AUTHZ-04).

> **V‑finding regression bundle** (must be triaged before sign‑off): `IRR-CRON-01` (V3 topic mismatch), `IRR-CRON-02` (V4 duplicate commands), `IRR-CFG-04` (V8 auto param lock), `AUTHZ-04` (irrigation lacks `@Roles`), `PRF-E2E-02` (V5 mocked email OTP), `PREF-06` (thresholds payload shape).

---

*End of catalog.*
