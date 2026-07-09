# 📗 Hanjeli SmartFarm — Manual Book

> Panduan lengkap **deployment**, **inisialisasi (migrasi & seed)**, **desain sistem** (Database, API, WebSocket, MQTT, Redis), serta **sinkronisasi Server ↔ ESP32** dan **firmware**.
>
> Semua nilai di dokumen ini sudah diverifikasi terhadap kode aktual (bukan asumsi).

---

## Daftar Isi
1. [Arsitektur Ringkas](#1-arsitektur-ringkas)
2. [Deployment](#2-deployment)
3. [Penggunaan Awal Web — Migrasi & Seed Database](#3-penggunaan-awal-web--migrasi--seed-database)
4. [Desain Database, API, WebSocket, MQTT, Redis, Payload](#4-desain-database-api-websocket-mqtt-redis-payload)
5. [Sinkronisasi Server ↔ ESP32 & Konfigurasi](#5-sinkronisasi-server--esp32--konfigurasi)
6. [Firmware ESP32](#6-firmware-esp32)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Arsitektur Ringkas

```
┌──────────┐   MQTT (QoS1)   ┌───────────────────────────┐  TypeORM   ┌──────────────────────┐
│  ESP32   │ ───────────────►│         BACKEND           │ ─────────► │ PostgreSQL+TimescaleDB │  ← source of truth
│ (sensor+ │ ◄───────────────│        (NestJS)           │            └──────────────────────┘
│  pompa)  │  command/ack    │  ├─ REST API (cache-aside) │  invalidate ┌──────────┐
└──────────┘                 │  ├─ WebSocket /ws (push)   │ ──────────► │  Redis   │
                             │  └─ MQTT ingest+publish    │             └──────────┘
                             └─────────────┬─────────────┘
                                REST + WebSocket
                                           │
                                     ┌─────▼─────┐
                                     │ FRONTEND  │  (Next.js) — HANYA lewat API + WS, tak pernah ke DB
                                     └───────────┘
```

**Prinsip:** Database = **satu-satunya sumber kebenaran**. Frontend tidak pernah menyentuh DB langsung — hanya REST API + WebSocket. Backend hanya memakai **TypeORM** (kecuali cek eksistensi DB sebelum koneksi). Cache **Redis** bersifat cache-aside (isi ulang dari DB saat kedaluwarsa).

---

## 2. Deployment

### 2.1 Prasyarat
| Kebutuhan | Versi | Catatan |
|---|---|---|
| Docker + Docker Compose | terbaru | Menjalankan DB, Redis, MQTT (+ API opsional) |
| Node.js | ≥ 20 | Untuk backend & frontend bila dijalankan di host |
| Arduino IDE | ≥ 2.x | Flash firmware ESP32 (ESP32 core v3.x) |

### 2.2 Struktur repo
| Folder | Isi |
|---|---|
| `hanjeli-be/` | Backend NestJS (API, WebSocket, MQTT, TypeORM) |
| `hanjeli-fe/` | Frontend Next.js |
| `esp32-firmware/` | Firmware `hanjeli_smartfarm.ino` |
| `hanjeli-be/docker-compose.yml` | Infra: db, redis, mqtt, hanjeli-api |

### 2.3 Peta Port
| Layanan | Port host | Keterangan |
|---|---|---|
| Backend API | **3000** | `http://localhost:3000/api/v3`, WS `…/ws`, Swagger `…/api/v3/docs` |
| Frontend | **3001** | `next dev -p 3001` (backend sudah pakai 3000) |
| PostgreSQL/Timescale | **5433** → 5432 | Default compose `DB_PORT=5433` |
| Redis | **6379** | |
| MQTT (Mosquitto) | **1883** | Untuk ESP32 via IP LAN |
| MQTT (alt) | **1884** → 1883 | Untuk backend di host (hindari bentrok mosquitto native Windows) |
| MQTT WebSocket | **9001** | Debug via browser |

### 2.4 Langkah Deployment

#### Opsi A — Infra via Docker, App di host (rekomendasi dev)
```bash
# 1) Nyalakan infrastruktur
cd hanjeli-be
docker compose up -d db redis mqtt

# 2) Siapkan env backend
cp .env.example .env          # lalu isi secret (lihat §2.5)

# 3) Jalankan backend (schema DB otomatis dibuat saat boot — lihat §3)
npm install
npm run start:dev             # http://localhost:3000

# 4) Frontend
cd ../hanjeli-fe
cp .env.example .env.local
npm install
npm run dev -- -p 3001        # http://localhost:3001
```

#### Opsi B — Full stack via Docker (produksi)
```bash
cd hanjeli-be
docker compose --profile production up -d      # db + redis + mqtt + hanjeli-api
docker compose logs -f hanjeli-api
# Reset TOTAL (hapus semua data):  docker compose down -v
```
> Saat memakai profil `production`, container `hanjeli-api` otomatis override: `DB_HOST=db`, `REDIS_HOST=redis`, `MQTT_BROKER_URL=mqtt://mqtt:1883`.

### 2.5 Konfigurasi `.env` Backend (variabel penting)
| Grup | Variabel | Contoh / Catatan |
|---|---|---|
| Server | `PORT` | `3000` |
| | `PUBLIC_BACKEND_URL` | `http://localhost:3000` (dipakai untuk URL avatar) |
| Database | `DB_HOST` / `DB_PORT` | `localhost` / `5433` (host) — di Docker: `db` / `5432` |
| | `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` | `hanjeli_admin` / *(rahasia)* / `hanjeli_smartfarm_db` |
| Keamanan | `BCRYPT_ROUNDS` | `12` |
| | `ENCRYPTION_KEY`, `AUTH_TOKEN_HASH_SECRET`, `TWO_FACTOR_ENCRYPTION_SECRET` | **wajib rahasia kuat & acak** |
| JWT | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `JWT_CHALLENGE_SECRET` | rahasia berbeda per-jenis |
| | `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | mis. `15m` / `7d` |
| Token auth | `AUTH_RESET_TOKEN_EXPIRES_IN` | `30m` (reset password) |
| Frontend | `FRONTEND_ORIGINS` | daftar origin CORS (mis. `http://localhost:3001`) |
| | `FRONTEND_AUTH_CALLBACK_URL` | `http://localhost:3001/auth/callback` |
| SMTP | `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | Gmail: host `smtp.gmail.com`, port `587`, secure `false`, **PASS = App Password 16 digit** |
| Redis | `REDIS_ENABLED` / `REDIS_HOST` / `REDIS_PORT` / `REDIS_KEY_PREFIX` | `true` / `localhost` / `6379` / `hanjeli` |
| MQTT | `MQTT_BROKER_URL` | host: `mqtt://localhost:1884` — Docker: `mqtt://mqtt:1883` |
| | `MQTT_USERNAME` / `MQTT_PASSWORD` | `hanjeli_device` / `hanjeli_mqtt_2026` |
| | `MQTT_IRRIGATION_ACK_TIMEOUT_MS` | `10000` |
| Seed admin | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | Opsional — bila kosong dipakai fallback (§3.3) |
| Google OAuth | `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` | Opsional (login Google) |

### 2.6 Konfigurasi Frontend `.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v3
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v3
NEXT_PUBLIC_WS_URL=http://localhost:3000/ws
```

---

## 3. Penggunaan Awal Web — Migrasi & Seed Database

### 3.1 Migrasi (schema) — **OTOMATIS**
Tidak ada folder `migrations`. Skema dibuat/di-upgrade secara **idempotent** oleh `schema-init.ts` **setiap kali backend boot** (juga oleh CLI `db:setup`). Ekstensi TimescaleDB, tabel, index, hypertable, dan CHECK constraint disiapkan otomatis — tidak perlu perintah migrasi manual.

### 3.2 Seed — 3 jalur
| Jalur | Perintah | Kapan dipakai |
|---|---|---|
| **CLI interaktif** | `npm run db:setup` | Setup pertama manual (tanya email + password; **tanpa konfirmasi ulang**) |
| **CLI non-interaktif (CI)** | `npm run db:setup -- --admin-email=… --admin-password=…` | Otomasi/CI |
| **Auto saat boot / seed:run** | otomatis di startup, atau `npm run seed:run` | Jaring pengaman deploy |

Opsi CLI lain: `--skip-seed` (hanya migrasi), `--skip-dev-seed`, `--reset-password`.

Validasi pada CLI/seed **identik** dengan tab Akun Pengguna: **email pola valid** + **password kuat** (min 8, huruf besar, angka). **Tanpa** konfirmasi password, **tanpa** kata sandi lama, **tanpa** verifikasi SMTP (akun langsung `email_verified=true`).

### 3.3 Kredensial Admin Fallback (jaring pengaman)
Bila deployer lupa mengisi `SEED_ADMIN_*`, admin **tetap dibuat otomatis** dengan default:

| Field | Nilai default |
|---|---|
| Email | `haniefhuda03@gmail.com` |
| Password | `@Admin123` |
| Nama | `Admin` |

> ⚠️ **Idempotent**: tidak menimpa admin yang sudah ada. **Ganti di produksi** lewat `SEED_ADMIN_*` atau ubah password setelah login pertama.

### 3.4 Alur First-Run Web
1. Buka `http://localhost:3001` → **Login** dengan kredensial admin (§3.3 atau `SEED_ADMIN_*`).
2. **Ganti kata sandi** di Profil → Ganti Kata Sandi (mengganti password mencabut semua sesi lama — login ulang dengan yang baru).
3. **Daftarkan perangkat IoT** di Profil → Perangkat IoT: buat perangkat dengan **kode** yang SAMA PERSIS (huruf besar) dengan firmware, mis. sensor `WS004`, pompa `PMP01`. Backend **menolak telemetry dari kode yang belum terdaftar**.
4. Flash firmware ESP32 (§6) → data sensor mulai masuk & tampil realtime.

---

## 4. Desain Database, API, WebSocket, MQTT, Redis, Payload

### 4.1 Skema Database (tabel utama)
| Tabel | Fungsi | Catatan |
|---|---|---|
| `users` | Akun & peran | `UNIQUE(email)`; `password_hash` (bcrypt, nullable utk OAuth); `two_factor_secret` (BYTEA, terenkripsi pgcrypto) |
| `devices` | Perangkat IoT | `code` unik; `status` online/warning/offline; `last_seen_at` |
| `sensor_telemetry` | **Hypertable** time-series | partisi `captured_at`; `sent_at` (ts ESP32, NOT NULL); NPK terpisah; `is_raining` |
| `irrigation_configs` | Mode & ambang irigasi | `active_mode`, `emergency_stop`, threshold N/P/K/air/suhu |
| `irrigation_schedules` | Jadwal penyiraman | hari, waktu, aktif |
| `irrigation_activity_log` | Riwayat aktivitas | info/warning/success |
| `auth_tokens` | Token email-verif/reset/oauth/refresh | `token_hash` (HMAC-SHA256), sekali-pakai, expiry, rotasi/revokasi |
| `recovery_codes` | Kode pemulihan 2FA | bcrypt-hashed |
| `user_preferences`, `user_measurement_units`, `user_notification_prefs`, `user_sensor_thresholds` | Preferensi per-user | |
| `notifications` | Notifikasi/alert | |

### 4.2 REST API + Query Param + Cache TTL
Semua endpoint terlindungi `JwtAuthGuard`. Cache pola **cache-aside**: cek Redis → miss → query DB (TypeORM) → simpan ke Redis (TTL). Key final = `hanjeli:<key>`.

| Endpoint | Query param | Cache key | TTL |
|---|---|---|---|
| `GET /sensors/latest` | — | `sensor:latest:{userId}` | 10s |
| `GET /sensors/overview` | — | `sensor:overview:{userId}` | 10s |
| `GET /sensors/quality-score` | — | `sensor:quality:{userId}` | 30s |
| `GET /sensors/trend` | `param, range, device_id` | `sensor:trend:{userId}:{hash}` | 60s |
| `GET /sensors/stats` | `param, range, device_id` | `sensor:stats:{userId}:{hash}` | 60s |
| `GET /sensors/history` | `page, limit, from, to, device_id` | `sensor:history:{userId}:{hash}` | 30s |
| `GET /sensors/export` | `format, from, to, device_id, header, status*, condition*` | — (stream CSV, tanpa cache) | — |
| `GET /devices` | — / filter | `devices:{userId}` / `:{hash}` | 60s |
| `GET /irrigation/config` | — | `irrigation:config:{userId}` | 10s |
| `GET /irrigation/schedules` | — | `irrigation:schedules:{userId}` | 60s |
| `GET /irrigation/activity` | `limit` | `irrigation:activity:{userId}:{hash}` | 30s |
| `GET /notifications` | filter/paginasi | `notifications:{userId}:{hash}` | 30s |
| `GET /preferences` | — | `preferences:{userId}` | 300s |
| `POST /auth/login` `register` `forgot-password` `reset-password` | body | — | — |

Mutasi (POST/PATCH/DELETE) memanggil `@CacheInvalidate('…:{userId}', '…:{userId}:*')` sehingga cache selalu konsisten dengan DB.

### 4.3 Redis Cache
| Aspek | Nilai |
|---|---|
| Driver | `ioredis` + **fallback memory** (tahan bila Redis mati) |
| Prefix key | `hanjeli` (`REDIS_KEY_PREFIX`) |
| Pola | **cache-aside** — kedaluwarsa → ambil DB → salin ke Redis |
| Invalidasi | pola glob (`scan` + `del`), mis. `sensor:*:{userId}*` |
| Eviction (compose) | `maxmemory 128mb`, `allkeys-lru`, `appendonly yes` |

### 4.4 WebSocket — namespace `/ws` (JWT-authed, kamar per-user)
| Event | Arah | Payload |
|---|---|---|
| `sensor:realtime` | BE→FE | `{ph, soil_moisture, nitrogen, phosphorus, potassium, soil_temperature, is_raining, sent_at, ts}` |
| `device:status` | BE→FE | `{device_code, status, last_seen}` |
| `irrigation:status` | BE→FE | `{mode, emergency, speed, fertilizer_speed, manual_water_enabled, manual_fertilizer_enabled}` |
| `irrigation:emergency` | BE→FE | `{active, ts}` |
| `irrigation:ack` | BE→FE | `{device_code, …, timestamp}` |
| `notification:new` | BE→FE | notifikasi |
| `irrigation:setMode` / `:emergencyStop` / `:resume` / `:manualToggle` | FE→BE | perintah (server **otoritatif**: ditolak saat mode darurat) |

### 4.5 MQTT — Topik & Payload (QoS 1)
| Topik | Arah | Payload |
|---|---|---|
| `hanjeli/sensor/{code}` (legacy `hanjeli/{code}/sensor`) | ESP32→BE | `{code?, ts, ph, moisture, n\|nitrogen, p\|phosphorus, k\|potassium, temp\|temperature, rain\|is_raining}` |
| `hanjeli/device/{code}/status` | ESP32→BE | `{code?, status:'online'\|'warning'\|'offline', ts, message?}` |
| `hanjeli/irrigation/command` | BE→ESP32 | `{action:'START'\|'STOP'\|'EMERGENCY_STOP'\|'RESUME', mode?, channel:'water'\|'fertilizer', speed, device_code?, user_id?, request_id}` |
| `hanjeli/irrigation/ack` (legacy `hanjeli/{code}/irrigation/ack`) | ESP32→BE | `{code?, request_id, action, status:'success'\|'failed'}` |

**Aturan ingest** (`mqtt-sensor.handler.ts`): `ts` **wajib** (tanpa `ts` ditolak); nilai di luar rentang (`ph 0–14`, `moisture 0–100`, `temp −50…80`, `npk ≥0`) → di-NULL-kan per-field (satu sensor rusak tak membuang seluruh reading). **ACK** ditunggu ≤ `MQTT_IRRIGATION_ACK_TIMEOUT_MS` (10s); timeout → dicatat aktivitas `warning` (dashboard: "perangkat tidak merespons").

### 4.6 Contoh Payload
```json
// ESP32 → hanjeli/sensor/WS004
{ "code":"WS004", "ts":1783567890, "ph":6.8, "moisture":55, "n":40, "p":30, "k":35, "temp":25, "rain":0 }
```
```json
// Backend → hanjeli/irrigation/command   (ESP32 balas hanjeli/irrigation/ack {request_id, status})
{ "action":"START", "mode":"manual", "channel":"water", "speed":100, "device_code":"PMP01", "request_id":"01b6…" }
```

---

## 5. Sinkronisasi Server ↔ ESP32 & Konfigurasi

Firmware `hanjeli_smartfarm.ino` **sudah sinkron** dengan kontrak backend. Bukti pemetaan:

| Aspek | Firmware ESP32 | Backend | Sinkron |
|---|---|---|---|
| Topik sensor | `hanjeli/sensor/<SENSOR_CODE>` | subscribe `hanjeli/sensor/+` | ✅ |
| Topik status | `hanjeli/device/<code>/status` | subscribe `hanjeli/device/+/status` | ✅ |
| Topik command | subscribe `hanjeli/irrigation/command` | publish topik sama | ✅ |
| Topik ACK | publish `hanjeli/irrigation/ack` | subscribe topik sama | ✅ |
| Timestamp `ts` | epoch **detik** via NTP, tunggu ≥ 2020 | terima detik/ms, tolak < 2020 | ✅ |
| Key payload | `ph, moisture, n, p, k, temp, rain` | terima alias tsb | ✅ |
| QoS | connect/subscribe **QoS 1** | subscribe **QoS 1** | ✅ |
| LWT (offline) | retained `status:offline` saat putus | `handleDeviceStatus` → offline | ✅ |
| ACK window | balas ≤ 10 dtk | tunggu 10.000 ms | ✅ |
| Emergency | **latch**; hanya `RESUME` melepas | server otoritatif + latch | ✅ |
| Nilai out-of-range | `constrain()` + NAN → tak dikirim | clamp → NULL per-field | ✅ |

### 5.1 Yang HARUS dikonfigurasi di firmware
| Konstanta | Isi |
|---|---|
| `WIFI_SSID`, `WIFI_PASSWORD` | Kredensial WiFi (2.4 GHz) |
| `MQTT_HOST` | **IP LAN** mesin yang menjalankan broker (mis. `192.168.1.10`) — bukan `localhost` |
| `MQTT_PORT` | `1883` |
| `MQTT_USER` / `MQTT_PASS` | `hanjeli_device` / **= `MQTT_PASSWORD` backend** (`hanjeli_mqtt_2026`) |
| `SENSOR_CODE` / `PUMP_CODE` | Harus **sama persis** dengan kode perangkat terdaftar (§3.4), mis. `WS004` / `PMP01` |

### 5.2 Alur sinkronisasi end-to-end
1. ESP32 sync NTP (menunggu waktu valid ≥ 2020) → connect MQTT (dengan LWT offline).
2. Tiap **30 dtk** publish telemetry; tiap **60 dtk** publish heartbeat status.
3. Backend: simpan DB → invalidate Redis → broadcast `sensor:realtime` → evaluasi threshold (alert).
4. User menekan kontrol irigasi (WS) → backend simpan config → publish `command` → ESP32 jalankan pompa → balas `ack` ≤10s → backend relay `irrigation:ack`.

---

## 6. Firmware ESP32

**File:** `esp32-firmware/hanjeli_smartfarm/hanjeli_smartfarm.ino`

### 6.1 Library (Arduino Library Manager)
| Library | Penulis |
|---|---|
| PubSubClient | Nick O'Leary |
| ArduinoJson (v7) | Benoit Blanchon |

> ESP32 core **v3.x** (memakai `ledcAttach`). Untuk core v2.x ganti ke `ledcSetup` + `ledcAttachPin`.

### 6.2 Wiring Pin (default — sesuaikan)
| Fungsi | Pin | Tipe |
|---|---|---|
| Sensor pH | `34` | ADC (analog) |
| Kelembapan tanah | `35` | ADC (capacitive) |
| Sensor hujan (raindrop) | `27` | DO (LOW = basah) |
| Suhu tanah (LM35/NTC) | `32` | ADC |
| Pompa air | `25` | PWM → relay/SSR |
| Pompa pupuk | `26` | PWM → relay/SSR |
| RS485 NPK — RX / TX / DE | `16` / `17` / `4` | UART2 + MAX485 |
| PWM | 5000 Hz, 8-bit | duty 0–255 |

### 6.3 Kalibrasi (WAJIB disesuaikan per modul)
- **pH**: kalibrasi 2 titik (mis. raw 2050 = pH 7.0, raw 1350 = pH 4.0) — ubah rumus `readPh()`.
- **Kelembapan**: `DRY≈3300` (udara), `WET≈1300` (terendam) — ubah `readMoisture()`.
- **Suhu**: contoh LM35 = 10 mV/°C. Untuk **DS18B20** pakai library OneWire+DallasTemperature.
- **NPK**: register JXCT N=`0x001E`, P=`0x001F`, K=`0x0020`, Modbus fungsi `0x03`, addr `0x01`.
- Sensor gagal/NAN → field **tidak dikirim** → backend simpan `NULL` (tidak merusak reading lain).

### 6.4 Flash & Monitor
1. Buka `.ino` di Arduino IDE, pilih board **ESP32 Dev Module**.
2. Isi konfigurasi §5.1, sesuaikan pin & kalibrasi.
3. Upload → buka Serial Monitor **115200 baud**.
4. Verifikasi log: `WiFi OK` → `Waktu tersinkron` → `MQTT terhubung` → `[sensor] {…}`.
5. Cek dashboard: perangkat jadi **online**, kartu sensor terisi realtime.

---

## 7. Troubleshooting

| Gejala | Kemungkinan sebab & solusi |
|---|---|
| Telemetry tak masuk DB | Kode perangkat belum terdaftar / beda huruf besar → daftarkan di Profil → Perangkat IoT (§3.4) |
| Reading ditolak | Payload tanpa `ts` atau `ts` < 2020 → pastikan NTP tersinkron |
| Backend tak terhubung broker (Windows) | Mosquitto native membayangi `127.0.0.1:1883` → pakai `MQTT_BROKER_URL=mqtt://localhost:1884` (port alt Docker) |
| ESP32 tak konek MQTT | `MQTT_HOST` harus IP LAN host (bukan localhost); `MQTT_PASS` harus = `MQTT_PASSWORD` backend |
| Email reset/verifikasi tak terkirim | SMTP `PASS` harus **App Password** Gmail; akun tujuan harus punya password (bukan login-Google) & domain valid |
| Redis mati | Otomatis fallback ke cache memory — API tetap jalan (log warning) |
| Notifikasi "perangkat tidak merespons" | ESP32 tak mengirim ACK ≤10s → cek pompa/relay & koneksi |
| Emergency tak lepas | Kirim `RESUME` (bukan START) — emergency bersifat latch di firmware & server |

---

*Dokumen ini dihasilkan dari verifikasi kode aktual backend, frontend, dan firmware Hanjeli SmartFarm.*
