# 🌱 Hanjeli SmartFarm

Platform IoT pertanian pintar untuk budidaya hanjeli: pemantauan sensor tanah realtime (pH, kelembapan, N-P-K, suhu), kontrol irigasi otomatis/terjadwal/manual berbasis ESP32, notifikasi ambang batas (push realtime + email), dan dasbor web dwibahasa (ID/EN).

```
┌─────────┐  MQTT   ┌───────────┐  TypeORM  ┌──────────────────────┐
│  ESP32  │────────▶│ Mosquitto │           │ PostgreSQL 16        │
│ (sensor │◀────────│  (Docker) │           │ + TimescaleDB        │
│ + pompa)│  cmd/ack└─────┬─────┘           │ (hypertable+agregat) │
└─────────┘               │                 └──────────▲───────────┘
                          ▼                            │
                   ┌─────────────┐    cache     ┌──────┴──────┐
                   │  Backend    │◀────────────▶│    Redis    │
                   │  NestJS 11  │              └─────────────┘
                   │  :3000      │
                   └──┬───────┬──┘
              REST /api/v3    │ Socket.IO /ws
                   ▼          ▼
              ┌─────────────────────┐
              │ Frontend Next.js 16 │  :3001 (dev)
              │ React 19 + Tailwind │
              └─────────────────────┘
```

**Struktur repo**

| Folder | Isi |
|---|---|
| `hanjeli-be/` | Backend NestJS: REST API, MQTT ingestion, WebSocket gateway, mesin irigasi, notifikasi, schema auto-init |
| `hanjeli-fe/` | Frontend Next.js: landing page, dashboard, monitoring, irigasi, profil |
| `esp32-firmware/` | Firmware Arduino ESP32 siap pakai (sensor tanah + rain + kontrol pompa + ACK) |

**Peta port**

| Komponen | URL / Port |
|---|---|
| Frontend | `http://localhost:3001` (dev — **jangan** 3000, dipakai backend) |
| Backend REST | `http://localhost:3000/api/v3` |
| Swagger (dokumentasi API interaktif) | `http://localhost:3000/api/v3/docs` |
| Backend WebSocket | `http://localhost:3000/ws` |
| TimescaleDB/PostgreSQL | `localhost:5433` |
| Redis | `localhost:6379` |
| MQTT (perangkat ESP32) | `<IP-server>:1883` |
| MQTT (backend di host Windows dev) | `localhost:1884` (lihat Troubleshooting) |

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Setup Development (dari nol sampai jalan)](#2-setup-development-dari-nol-sampai-jalan)
3. [Konfigurasi Environment (.env)](#3-konfigurasi-environment-env)
4. [Database: Schema Auto-Init (tanpa migrations)](#4-database-schema-auto-init-tanpa-migrations)
5. [Setup ESP32 + Kontrak Payload MQTT](#5-setup-esp32--kontrak-payload-mqtt)
6. [Mekanisme API (REST)](#6-mekanisme-api-rest)
7. [Mekanisme WebSocket (Realtime)](#7-mekanisme-websocket-realtime)
8. [Mekanisme Redis (Cache)](#8-mekanisme-redis-cache)
9. [Mesin Irigasi (Auto / Terjadwal / Manual)](#9-mesin-irigasi-auto--terjadwal--manual)
10. [Notifikasi (Push + Email) & Ambang Batas](#10-notifikasi-push--email--ambang-batas)
11. [Unit Pengukuran & Konversi](#11-unit-pengukuran--konversi)
12. [Grafik Tren: Cara Max/Min/Avg Dihitung](#12-grafik-tren-cara-maxminavg-dihitung)
13. [Keamanan](#13-keamanan)
14. [Deployment Produksi](#14-deployment-produksi)
15. [Pengujian](#15-pengujian)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Prasyarat

| Kebutuhan | Versi | Untuk |
|---|---|---|
| Node.js | ≥ 20 | Backend & frontend |
| npm | ≥ 10 | Package manager |
| Docker + Docker Compose | terbaru | PostgreSQL/TimescaleDB, Redis, Mosquitto |
| Git | terbaru | Version control |

> **Windows**: pastikan **tidak ada** service Mosquitto native yang berjalan di port 1883 — lihat [Troubleshooting](#16-troubleshooting).

---

## 2. Setup Development (dari nol sampai jalan)

### 2.1 Backend

```bash
cd hanjeli-be
npm install

# Salin & isi environment (lihat bagian 3)
cp .env.example .env

# Buat kredensial broker MQTT (menulis docker/mosquitto/password.txt)
node generate-mqtt-password.js

# Nyalakan infrastruktur (DB port host 5433, Redis 6379, MQTT 1883/1884)
docker compose up -d db redis mqtt

# Jalankan backend — database, seluruh skema, DAN akun admin
# dibuat OTOMATIS saat boot (tidak ada perintah migrasi/seed terpisah)
npm run start:dev
```

Backend siap di `http://localhost:3000` — Swagger di `http://localhost:3000/api/v3/docs`.

Yang terjadi otomatis di setiap boot (idempotent, aman diulang):

1. **Database dibuat** bila belum ada (koneksi ke DB maintenance `postgres`).
2. **Seluruh skema dibuat/di-upgrade** oleh `src/database/schema-init.ts` — 13 tabel, hypertable TimescaleDB, continuous aggregate, kebijakan kompresi & retensi.
3. **Akun admin di-seed** dari `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (dibuat jika belum ada; password TIDAK di-reset kecuali `SEED_ADMIN_RESET_PASSWORD=true`).

### 2.2 Frontend

```bash
cd hanjeli-fe
npm install
cp .env.example .env.local   # isi: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL

# Port 3001 (backend memakai 3000; CORS & callback OAuth sudah mengizinkan 3001)
npx next dev -p 3001
```

Buka `http://localhost:3001` → login dengan akun admin dari `.env` backend.

### 2.3 Verifikasi cepat

```bash
# Kirim satu pembacaan sensor uji lewat broker Docker
docker exec hanjeli-mqtt mosquitto_pub -h localhost \
  -u hanjeli_device -P <MQTT_PASSWORD> \
  -t 'hanjeli/sensor/WS004' \
  -m "{\"code\":\"WS004\",\"ts\":$(date +%s),\"ph\":6.5,\"moisture\":45,\"n\":30,\"p\":25,\"k\":40,\"temp\":27}"
```

Tile di halaman **Monitoring** harus terupdate realtime dalam ±1 detik.

---

## 3. Konfigurasi Environment (.env)

### Backend (`hanjeli-be/.env`)

| Variabel | Contoh | Keterangan |
|---|---|---|
| `NODE_ENV` | `development` \| `production` | Mode aplikasi (produksi mengaktifkan CSP, mematikan seed data dev) |
| `PORT` | `3000` | Port HTTP backend |
| `DB_HOST` / `DB_PORT` | `localhost` / `5433` | Host & port PostgreSQL (compose memetakan 5433→5432) |
| `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` | — | Kredensial DB — **wajib acak & kuat di produksi** |
| `ENCRYPTION_KEY` | string acak ≥48 char | Kunci induk fallback derivasi secret |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `JWT_CHALLENGE_SECRET` | string acak | Penandatangan JWT — **masing-masing unik & acak** |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `15m` / `7d` | Umur token |
| `TWO_FACTOR_ENCRYPTION_SECRET` | string acak | Enkripsi at-rest secret TOTP (pgcrypto) — **jangan diganti setelah ada user 2FA** |
| `AUTH_TOKEN_HASH_SECRET` | string acak | HMAC token sekali-pakai (verifikasi email, reset, refresh-jti) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | — | Akun admin yang dibuat otomatis saat boot |
| `SEED_ADMIN_RESET_PASSWORD` | `false` | `true` = paksa reset password admin ke nilai env pada boot berikutnya (sekali pakai, kembalikan ke `false`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | — | OAuth Google (callback: `<BE>/api/v3/auth/google/callback`) |
| `FRONTEND_URL` / `FRONTEND_ORIGINS` | `https://app.contoh.id` | Allow-list CORS (REST + WebSocket), pisahkan koma |
| `FRONTEND_AUTH_CALLBACK_URL` | `<FE>/auth/callback` | Tujuan redirect OAuth & tautan email |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | Gmail: `smtp.gmail.com:587` + App Password | Email verifikasi, reset password, notifikasi channel email |
| `REDIS_ENABLED/HOST/PORT/PASSWORD/KEY_PREFIX` | `true`/`localhost`/`6379`/—/`hanjeli` | Cache (fallback otomatis ke memori bila Redis mati) |
| `MQTT_BROKER_URL` | `mqtt://localhost:1884` | **Dev Windows: 1884** (lihat Troubleshooting); produksi Docker: `mqtt://mqtt:1883` |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | `hanjeli_device` / — | Harus cocok dengan `docker/mosquitto/password.txt` **dan firmware ESP32** |
| `WEATHER_LATITUDE/LONGITUDE` | koordinat lahan | Sumber cuaca Open-Meteo |
| `PUBLIC_BACKEND_URL` | `https://api.contoh.id` | Base URL publik untuk URL avatar |

Cara membuat secret acak: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

### Frontend (`hanjeli-fe/.env.local`)

| Variabel | Contoh | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000/api/v3` | Base URL REST |
| `NEXT_PUBLIC_WS_URL` | `http://localhost:3000/ws` | Endpoint Socket.IO |

---

## 4. Database: Schema Auto-Init (tanpa migrations)

Tidak ada folder migrations dan tidak ada perintah migrasi — **seluruh DDL idempotent** ada di `hanjeli-be/src/database/schema-init.ts` dan berjalan otomatis sebelum server menerima traffic. Database lama di-upgrade sekali-jalan (ditandai `schema_metadata.schema_upgrade_v2`).

Tabel utama:

| Tabel | Peran |
|---|---|
| `users` | Akun (role Admin/Guest, `token_version` = epoch sesi untuk revoke) |
| `sensor_telemetry` | **Hypertable TimescaleDB** — partisi `captured_at`. Kolom per-parameter: `ph_level`, `soil_moisture`, `soil_nitrogen`/`soil_phosphorus`/`soil_potassium` (N-P-K **terpisah**, tanpa kolom agregat), `soil_temperature`, `is_raining` (kondisi hujan), **`sent_at NOT NULL` tanpa default** (wajib dari `ts` ESP32); FK device `ON DELETE CASCADE` |
| `sensor_hourly_stats` / `sensor_daily_stats` | Continuous aggregate (realtime + refresh policy 30 mnt/6 jam) untuk grafik tren |
| `devices` | Perangkat IoT (`sensor`/`pump`/`camera`, kode unik) |
| `irrigation_configs` / `irrigation_schedules` / `irrigation_activity_logs` | Mode irigasi, jadwal, log aktivitas (hypertable) |
| `notifications` | Notifikasi user |
| `user_preferences` + `user_measurement_units` + `user_notification_prefs` + `user_sensor_thresholds` | Bahasa, unit, channel notifikasi, ambang batas |
| `auth_tokens` | Token sekali-pakai ter-hash (verifikasi email, reset, oauth_exchange, **refresh** untuk rotasi) |
| `recovery_codes` | Kode pemulihan 2FA (bcrypt) |

Kebijakan data: kompresi chunk > 30 hari, retensi telemetry 365 hari. **Semua penghapusan bersifat HARD DELETE** — hapus device menghapus seluruh telemetrinya; hapus akun menghapus seluruh data terkait secara permanen (tidak ada soft delete/restore).

Menambah kolom di masa depan: tulis DDL idempotent baru (`ADD COLUMN IF NOT EXISTS` / DO-block guarded) di `schema-init.ts`; untuk backfill berat sekali-jalan gunakan marker `schema_metadata` baru (`schema_upgrade_v3`, dst.).

---

## 5. Setup ESP32 + Kontrak Payload MQTT

### 5.1 Koneksi broker

- **Host**: IP mesin/server yang menjalankan Docker (mis. `192.168.1.10`), **port `1883`**, protokol MQTT 3.1.1/5, QoS 1.
- **Autentikasi wajib**: username `hanjeli_device`, password = `MQTT_PASSWORD` (sinkron dengan `docker/mosquitto/password.txt`; regenerasi via `node generate-mqtt-password.js`).
- Perangkat harus punya **waktu yang benar** (NTP) — timestamp `ts` wajib dikirim.

### 5.2 ESP32 → Server: data sensor

**Topic**: `hanjeli/sensor/<KODE_DEVICE>` — kode device harus sudah terdaftar di menu Profil → Perangkat IoT (mis. `WS004`).

```json
{
  "code": "WS004",
  "ts": 1783075527,
  "ph": 6.9,
  "moisture": 52.4,
  "n": 33,
  "p": 27,
  "k": 41,
  "temp": 26.5,
  "rain": 0
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `code` | string | opsional* | Kode device (*bisa diambil dari topic) |
| `ts` | number | **WAJIB** | Epoch **detik atau milidetik** (keduanya diterima otomatis). Tanpa `ts` / `ts` tidak masuk akal (< 2020 atau > 1 jam ke depan) → **reading DIBUANG** dengan log warning — tidak ada fallback ke jam server |
| `ph` | number | opsional | 0–14 (alias: `ph_level`) |
| `moisture` | number | opsional | 0–100 % (alias: `soil_moisture`) |
| `n`, `p`, `k` | number | opsional | mg/kg ≥ 0 (alias: `nitrogen`, `phosphorus`, `potassium`) — **tiga nilai terpisah**, tidak ada nilai NPK gabungan |
| `temp` | number | opsional | −50…80 °C (alias: `temperature`, `soil_temperature`) |
| `rain` | 0/1/bool | opsional | Kondisi hujan saat pengambilan data (alias: `is_raining`, `raining`); tampil di riwayat sebagai "Hujan"/"Tidak Hujan" |

Nilai di luar rentang **di-NULL-kan per-field** (satu sensor rusak tidak membuang pembacaan lain).

### 5.3 ESP32 → Server: status perangkat

**Topic**: `hanjeli/device/<KODE_DEVICE>/status`

```json
{ "code": "PMP01", "status": "online", "ts": 1783075527, "message": null }
```

`status`: `online` | `warning` | `offline`; `message`: teks peringatan opsional.

### 5.4 Server → ESP32: perintah irigasi (SUBSCRIBE topic ini!)

**Topic**: `hanjeli/irrigation/command`

```json
{
  "request_id": "3f2b9c1e-...-uuid",
  "action": "START",
  "mode": "auto",
  "channel": "water",
  "speed": 80,
  "device_code": "PMP01",
  "user_id": "uuid-user"
}
```

| Field | Nilai | Keterangan |
|---|---|---|
| `action` | `START` \| `STOP` \| `RESUME` \| `EMERGENCY_STOP` | Perintah pompa |
| `channel` | `water` \| `fertilizer` | Pompa air atau pupuk |
| `speed` | 0–100 | Kecepatan pompa (%) |
| `request_id` | uuid | **Kembalikan di ACK** — server menunggu 10 detik |

### 5.5 ESP32 → Server: ACK perintah

**Topic**: `hanjeli/irrigation/ack` — kirim **maksimal 10 detik** setelah menerima perintah; tanpa ACK server mencatat peringatan + notifikasi "Perangkat irigasi tidak merespons" ke user.

```json
{ "code": "PMP01", "request_id": "3f2b9c1e-...", "action": "START", "status": "success" }
```

`status`: `success`/`ok` = berhasil; selain itu = gagal.

### 5.6 Firmware siap pakai

Firmware lengkap tersedia di **`esp32-firmware/hanjeli_smartfarm/hanjeli_smartfarm.ino`** — tinggal isi kredensial WiFi/MQTT + kode perangkat lalu upload dari Arduino IDE (library: `PubSubClient`, `ArduinoJson`). Fitur: NTP (ts wajib), pembacaan pH/kelembapan/suhu analog terkalibrasi, N-P-K via RS485 Modbus (register sensor JXCT), sensor hujan (raindrop DO), status online/offline via LWT, subscribe perintah irigasi, kendali 2 pompa PWM (air & pupuk) dengan latch EMERGENCY_STOP, dan balasan ACK otomatis.

---

## 6. Mekanisme API (REST)

Base URL: `http://<host>:3000/api/v3` — semua endpoint (kecuali `GET /` health) butuh header `Authorization: Bearer <access_token>`. Rate limit global 10 req/menit + limit ketat di endpoint auth. Dokumentasi interaktif: **`/api/v3/docs`** (Swagger).

| Area | Endpoint utama |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh` (rotasi sekali-pakai), `/auth/logout`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/2fa/setup|enable`, `/auth/verify-2fa`, `/auth/verify-recovery`, `GET /auth/google` (OAuth) |
| Users | `GET/PUT /users/me`, `POST /users/me/avatar`, `DELETE /users/me` (hard delete + password + 2FA); Admin: `GET/POST /users`, `PUT/DELETE /users/:id` |
| Sensors | `GET /sensors/overview`, `/latest`, `/quality-score`, `/trend?param&range`, `/stats?param&range`, `/history?page&limit&from&to`, `/export?format=csv` |
| Devices | `GET/POST /devices`, `PUT/DELETE /devices/:id` (hard delete berkaskade ke telemetry) |
| Irrigation | `GET/PUT /irrigation/config`, CRUD `/irrigation/schedules`, `GET /irrigation/activity` |
| Notifications | `GET /notifications`, `PATCH /:id/read`, `PATCH /read-all`, `DELETE /:id`, `DELETE /` |
| Preferences | `GET /preferences`, `PUT /preferences` (bahasa), `PUT /preferences/units`, `/notification-prefs`, `/sensor-thresholds` |
| Weather | `GET /weather/current` (Open-Meteo, cache 15 menit) |

**Alur token**: login → `{access_token (15m), refresh_token (7h), expires_in, user}`. Saat access kedaluwarsa, FE otomatis `POST /auth/refresh` (**single-flight** — banyak request 401 paralel berbagi satu refresh). Refresh token **sekali-pakai**: reuse ≤ 60 dtk (race antar-tab) = 401 biasa; reuse setelahnya = indikasi pencurian → **seluruh sesi user diinvalidasi**.

**Contoh payload yang diterima frontend** — `GET /sensors/overview`:

```json
{
  "id": "18", "device_id": "uuid", "device": {"id":"uuid","code":"WS004","name":"Soil Station"},
  "captured_at": "2026-07-03T10:45:27.000Z",
  "sent_at":     "2026-07-03T10:45:27.000Z",
  "ph_level": 6.9, "soil_moisture": 52.4,
  "soil_nitrogen": 33, "soil_phosphorus": 27, "soil_potassium": 41,
  "soil_temperature": 26.5, "is_raining": false,
  "parameters": [
    { "key": "ph", "label": "pH Tanah", "value": 6.9, "unit": "pH", "status": "optimal" },
    { "key": "soil_moisture", "label": "Kelembaban Tanah", "value": 52.4, "unit": "%", "status": "optimal" },
    { "key": "npk", "label": "Kadar NPK (N, P, K)", "unit": "mg/kg", "status": "optimal",
      "nitrogen": 33, "phosphorus": 27, "potassium": 41 },
    { "key": "soil_temperature", "label": "Suhu Tanah", "value": 26.5, "unit": "°C", "status": "optimal" }
  ]
}
```

---

## 7. Mekanisme WebSocket (Realtime)

Socket.IO namespace **`/ws`**, transport websocket, CORS allow-list sama dengan REST.

**Autentikasi**: kirim access token di handshake — `io(url, { auth: { token } })`. Token invalid → event `auth:error` + disconnect. Tiap koneksi bergabung ke room privat `user:<id>` — data user lain tidak pernah bocor antar-room. Logout / hapus akun **memutus paksa** semua socket user tersebut.

**Event server → client**

| Event | Payload | Kapan |
|---|---|---|
| `sensor:realtime` | `{device_code, ph, soil_moisture, nitrogen, phosphorus, potassium, soil_temperature, is_raining, sent_at (ISO), ts (epoch ms)}` | Setiap reading MQTT tersimpan |
| `device:status` | `{code, status, lastSeen}` | Status perangkat berubah |
| `notification:new` | `{id, title, description, type, category, read, created_at}` | Notifikasi baru dibuat |
| `irrigation:status` | konfigurasi irigasi terkini | Mode/konfig berubah |
| `irrigation:emergency` | `{active, ts}` | Emergency stop / resume |

**Event client → server**: `irrigation:setMode`, `irrigation:manualToggle`, `irrigation:emergencyStop`, `irrigation:resume`.

FE membuat ulang koneksi otomatis saat login/logout/refresh token (event internal `hanjeli:auth-changed`) — realtime langsung hidup tanpa reload halaman.

---

## 8. Mekanisme Redis (Cache)

Redis dipakai sebagai **cache baca + dedupe** (bukan pub/sub) dengan **fallback otomatis ke memori** bila Redis mati — aplikasi tetap berfungsi penuh.

| Kelompok key (prefix `hanjeli:`) | Isi | Invalidasi |
|---|---|---|
| `sensor:latest|overview|quality|trend|stats|history:<userId>…` | Respons endpoint sensor | Setiap reading MQTT baru milik user tsb |
| `devices:<userId>…` | Daftar perangkat | CRUD device / status MQTT |
| `preferences:<userId>`, `user:profile:*` | Preferensi & profil | PUT terkait |
| `thresholds:<userId>`, `notifprefs:<userId>:<kategori>:<channel>` | Ambang batas & channel notifikasi (TTL 60 dtk) | PUT preferensi terkait |
| `notif:alert:<userId>:<param>` | **Dedupe alert** (TTL 15 menit) | Kedaluwarsa sendiri |
| `weather:current` | Cuaca Open-Meteo (TTL 15 menit) | Kedaluwarsa sendiri |

---

## 9. Mesin Irigasi (Auto / Terjadwal / Manual)

Satu sumber kebenaran: `irrigation_configs` (mode saling eksklusif; `emergency_stop` menimpa semuanya).

- **Auto** — dievaluasi pada **setiap reading sensor masuk**: kelembapan < `water_min` → pompa air ON; > `water_max` → OFF. N/P/K di bawah target → pompa **pupuk** ON (diprioritaskan; pompa air ditunda). Semua keputusan dikirim via MQTT + dicatat di log aktivitas.
- **Terjadwal** — cron per menit mencocokkan hari (mon–sun) + `start_time`/`end_time` jadwal aktif → START/STOP.
- **Manual** — toggle pompa air/pupuk + kecepatan dari UI (via WebSocket).
- **Emergency stop** — mematikan kedua pompa dan dipaksakan ulang pada setiap reading sampai di-resume.

Setiap perintah menunggu **ACK ≤ 10 detik** dari ESP32; tanpa ACK → log peringatan + notifikasi "Perangkat irigasi tidak merespons".

---

## 10. Notifikasi (Push + Email) & Ambang Batas

**Pemicu**: (1) nilai sensor keluar dari `user_sensor_thresholds` (dapat diatur per parameter di Profil — default: suhu 20–35 °C, kelembapan 30–80 %, pH 5.5–7.5, N/P/K masing-masing 20–60 mg/kg); (2) peristiwa irigasi (NPK rendah/tinggi/normal kembali, ACK timeout). **Anti-spam**: dedupe 15 menit per parameter per user.

**Channel per kategori** (`sensor` / `irrigation` / `system`), diatur di Profil → Notifikasi:

| Channel | Default | Mekanisme |
|---|---|---|
| **Push** | ON | Row `notifications` + event WS `notification:new` → toast + lonceng |
| **Email** | OFF | Dikirim via SMTP ke email akun (template merek Hanjeli). Toggle tersimpan ke backend dan langsung berlaku |

> Default email = OFF adalah desain yang disengaja (menghindari spam inbox). Begitu diaktifkan, alert berikutnya ikut terkirim ke email.

---

## 11. Unit Pengukuran & Konversi

Backend selalu **menyimpan & mengirim nilai kanonik**: suhu °C, kelembapan %, NPK mg/kg, pH. Frontend mengonversi tampilan sesuai preferensi user (Profil → Satuan Pengukuran, tersimpan di `user_measurement_units`):

| Parameter | Pilihan | Konversi |
|---|---|---|
| Suhu tanah (`soil_temperature`) | °C, °F | °F = °C × 9/5 + 32 (dihitung nyata di semua tampilan & grafik) |
| N, P, K (grup unit `soil_npk`) | mg/kg, ppm | 1 : 1 — satu pilihan unit berlaku untuk ketiga nilai |
| Kelembapan | % | — |
| pH | pH | — |

Ekspor CSV selalu kanonik agar data mentah konsisten antar-user.

---

## 12. Grafik Tren: Cara Max/Min/Avg Dihitung

Grafik & ringkasan **tidak** memindai jutaan baris mentah — memakai **continuous aggregate TimescaleDB**:

1. Setiap reading masuk hypertable `sensor_telemetry`.
2. TimescaleDB memelihara `sensor_hourly_stats` (bucket 1 jam — untuk rentang **Hari**) dan `sensor_daily_stats` (bucket 1 hari — untuk **Minggu/Bulan**), masing-masing menyimpan `avg_x`, `max_x`, `min_x` per bucket per device. Mode *realtime aggregation* + refresh policy (30 menit / 6 jam) menjamin data terbaru selalu ikut.
3. Endpoint `/sensors/stats` menghitung dalam rentang terpilih: **Max = MAX(max per-bucket)** dan **Min = MIN(min per-bucket)** — nilai ekstrem **eksak**; **Avg = AVG(avg per-bucket)** — rata-rata dari rata-rata bucket. Karena ESP32 mengirim pada interval tetap, tiap bucket berisi jumlah sampel yang hampir sama sehingga hasilnya praktis identik dengan rata-rata mentah (deviasi hanya muncul bila ada bucket yang datanya bolong parah).
4. `/sensors/trend` mengembalikan deret `avg` per bucket → digambar Recharts; titik realtime dari WebSocket ditempelkan di ujung kurva pada rentang "Hari".

---

## 13. Keamanan

| Lapisan | Mekanisme |
|---|---|
| Autentikasi | JWT access 15 menit + refresh 7 hari **sekali-pakai (rotasi)**; reuse ≤60 dtk = race antar-tab (401 biasa), reuse setelahnya = indikasi pencurian → semua sesi dibunuh; `token_version` (epoch) mematikan seluruh token saat logout/reset password; sesi: idle timeout 30 menit + plafon absolut 12 jam sejak login |
| Password & 2FA | bcrypt (12 rounds); TOTP dengan secret terenkripsi pgcrypto at-rest; 8 kode pemulihan sekali-pakai (bcrypt); aksi sensitif (hapus akun) re-autentikasi password + 2FA + ketik konfirmasi |
| Token di URL | **Tidak ada kredensial/PII di address bar**: kode OAuth & token email dikirim via **URL fragment** (tidak pernah tercatat di server/proxy/Referer) lalu langsung dihapus dari address bar; token reset & challenge 2FA berpindah lewat sessionStorage |
| Injection | SQL: seluruh query parameterized (TypeORM + placeholder `$1`) — tidak ada konkatenasi input; XSS: React auto-escape, tanpa `dangerouslySetInnerHTML`, CSP aktif di produksi (helmet); validasi input global `ValidationPipe` (whitelist + forbidNonWhitelisted — field asing ditolak 400) |
| Akses URL langsung | Gate server-side (Next proxy — tidak bisa dilewati dengan mematikan JS) + RouteGuard client (prasyarat sessionStorage untuk halaman sensitif: verify-2fa, recovery, forgot/reset password, verify-email); `/reset-password` dapat diakses dalam status login **apa pun** asalkan membawa token reset yang sah |
| API | Semua endpoint di balik `JwtAuthGuard`; role Admin via `RolesGuard`; rate limit (login 5/mnt, forgot 3/mnt, global 10/mnt); CORS allow-list identik untuk REST & WebSocket |
| IoT | Broker MQTT wajib autentikasi; reading tanpa timestamp perangkat ditolak; nilai mustahil di-NULL-kan; perintah irigasi menunggu ACK; device tak dikenal diabaikan |
| Data | Hard delete permanen berkaskade; token sekali-pakai disimpan sebagai HMAC (bukan plaintext); header keamanan helmet |

---

## 14. Deployment Produksi

### 14.1 Full stack Docker (disarankan)

```bash
cd hanjeli-be

# 1. .env produksi: NODE_ENV=production, semua secret ACAK BARU,
#    FRONTEND_ORIGINS=https://domain-fe, MQTT_BROKER_URL=mqtt://mqtt:1883
# 2. Kredensial broker: node generate-mqtt-password.js  (samakan dengan firmware!)

docker compose --profile production up -d --build
# → db + redis + mqtt + hanjeli-api  (schema & admin dibuat otomatis saat boot)
```

Frontend:

```bash
cd hanjeli-fe
# .env.local produksi: NEXT_PUBLIC_API_URL=https://api.domain/api/v3
#                      NEXT_PUBLIC_WS_URL=https://api.domain/ws
npm run build && npm run start        # atau deploy ke Vercel/PM2
```

### 14.2 Checklist produksi

- [ ] Semua secret `.env` unik & acak (JANGAN memakai nilai contoh/dev)
- [ ] `NODE_ENV=production` (mengaktifkan CSP; seed data dev otomatis nonaktif)
- [ ] HTTPS via reverse proxy (Caddy/Nginx/Traefik) di depan FE & BE — cookie marker otomatis `secure`
- [ ] Reverse proxy meneruskan **WebSocket upgrade** ke path `/ws` backend
- [ ] Port DB (5433) & Redis (6379) **tidak** diekspos ke internet (hapus mapping `ports:` bila satu host)
- [ ] Port MQTT 1883 hanya dibuka ke jaringan perangkat (LAN/VPN), bukan publik
- [ ] `SEED_ADMIN_RESET_PASSWORD=false` setelah boot pertama
- [ ] Rotasi berkala: Google OAuth secret (Cloud Console), SMTP App Password, MQTT password (serentak dengan firmware)
- [ ] Backup terjadwal: `docker exec hanjeli-db pg_dump -U <user> <db> > backup.sql`
- [ ] Pantau log: `docker compose logs -f hanjeli-api`

### 14.3 Contoh Nginx (potongan)

```nginx
location /api/v3/ { proxy_pass http://127.0.0.1:3000; }
location /ws/ {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
location /uploads/ { proxy_pass http://127.0.0.1:3000; }
location / { proxy_pass http://127.0.0.1:3001; }   # frontend
```

---

## 15. Pengujian

```bash
# Backend
cd hanjeli-be
npm run build                     # gerbang TypeScript
npx tsc -p tsconfig.json --noEmit # typecheck termasuk file spec
npm test                          # 55 unit test (auth, mqtt, sensors, irrigation, notifications, ...)

# Frontend
cd hanjeli-fe
npx tsc --noEmit                  # typecheck
npm run lint                      # eslint
npm run build                     # production build
```

Uji e2e manual tercepat: jalankan stack dev (§2) lalu publish payload MQTT (§2.3) dan amati halaman Monitoring; uji auth: `POST /auth/refresh` dua kali dengan token yang sama (kedua harus 401); uji hard delete: hapus device ber-telemetry (200 + seluruh riwayat ikut hilang).

---

## 16. Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Data ESP32 tidak pernah masuk padahal broker menerima | **Dua broker di port 1883** — Windows: service Mosquitto native mengikat `127.0.0.1:1883` dan membayangi broker Docker untuk koneksi localhost | Matikan service `mosquitto` Windows (services.msc, Run as Administrator → Stop + Startup type: Disabled) **atau** biarkan `MQTT_BROKER_URL=mqtt://localhost:1884` (port alternatif compose yang menembus langsung ke broker Docker) |
| Log "Telemetry tanpa timestamp perangkat (ts) ditolak" | Firmware tidak mengirim `ts` | Aktifkan NTP di ESP32 dan sertakan `ts` (epoch detik/ms) |
| "Telemetry for unknown device code ignored" | Kode device belum terdaftar | Tambahkan device (kode sama persis, huruf besar) di Profil → Perangkat IoT |
| Semua sesi tiba-tiba logout | Refresh token dipakai ulang > 60 detik setelah rotasi (indikasi pencurian) — atau memang token bocor | Login ulang; periksa klien/skrip lama yang menyimpan refresh token basi |
| Email verifikasi/notifikasi tidak terkirim | SMTP belum dikonfigurasi / App Password Gmail salah | Isi `SMTP_*` di `.env`; Gmail memerlukan **App Password** (bukan password akun) |
| Grafik tren kosong | Belum ada telemetry pada rentang tsb | Kirim data; aggregate ter-refresh realtime + policy 30 mnt/6 jam |
| Login Google gagal redirect | `GOOGLE_CALLBACK_URL` / `FRONTEND_AUTH_CALLBACK_URL` tidak cocok dengan console Google / port FE | Samakan ketiganya (BE callback, FE callback, Authorized redirect URI di Google Console) |
| Port bentrok 3000/3001/5433/6379/1883 | Aplikasi lain memakai port | Ubah mapping di `.env` / docker-compose |
| `Database belum siap (percobaan x/30)` saat boot | Container DB belum sehat | Normal — backend menunggu hingga ±90 detik; cek `docker compose ps` |

---

*Dokumen ini menjelaskan kondisi kode per Juli 2026. Swagger (`/api/v3/docs`) selalu mencerminkan kontrak API terkini.*
