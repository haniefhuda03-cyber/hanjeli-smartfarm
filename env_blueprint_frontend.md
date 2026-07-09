# 🔐 Hanjeli Smart Farm — Environment Variable Blueprint

Dokumen ini membedah rancangan *environment variables* (`.env`) yang digunakan pada sisi **Backend (NestJS)** dan **Frontend (Next.js)**. Konfigurasi ini memastikan agar data rahasia seperti *password*, URL *database*, dan *secret keys* tidak terekspos secara publik.

---

## 0. Peta Port Lokal: Next.js vs NestJS

Saat development lokal, jangan samakan URL frontend dan backend:

| Layer | Aplikasi | Port | Contoh URL |
| --- | --- | ---: | --- |
| Frontend | Next.js `hanjeli-fe` | `3001` | `http://localhost:3001` |
| Backend REST | NestJS `hanjeli-be` | `3000` | `http://localhost:3000/api/v3` |
| Backend Realtime | Socket.IO namespace NestJS | `3000` | `http://localhost:3000/ws` |
| Database | PostgreSQL/TimescaleDB | `5432` | `localhost:5432` |
| Redis | Redis cache/rate limit | `6379` | `localhost:6379` |
| MQTT | Broker lokal opsional | `1883` | `mqtt://localhost:1883` |

Catatan penting:
- `FRONTEND_URL` adalah asal browser/Next.js, bukan API backend.
- `NEXT_PUBLIC_API_URL` adalah base URL REST backend.
- Socket.IO backend memakai namespace tunggal `/ws`; sensor, notifikasi, dan irigasi dibedakan lewat nama event.
- Jika Nest tetap di `3000`, jalankan Next di port lain, misalnya `npm run dev -- -p 3001`.

---

## 1. 🏢 Backend Environment (`hanjeli-be/.env`)

*Backend* adalah pusat kendali aplikasi, sehingga memerlukan banyak *secret keys* dan koneksi infrastruktur.

```env
# ═══════════════════════════════════════════
# HANJELI BACKEND (.env)
# ═══════════════════════════════════════════

# ─── App Configuration ───
NODE_ENV=development             # Gunakan 'production' jika sudah rilis di cloud
PORT=3000                        # Port tempat backend berjalan

# ─── PostgreSQL + TimescaleDB ───
DB_HOST=localhost                # Alamat IP server database (localhost untuk lokal)
DB_PORT=5432                     # Port bawaan PostgreSQL
DB_USERNAME=hanjeli_admin        # Username superuser atau admin database
DB_PASSWORD=your_password_here   # Ganti dengan password DB Anda yang aman
DB_NAME=hanjeli_smartfarm_db     # Nama database tempat schema berada

# ─── Database Pooling ───
DB_POOL_MAX=20                   # Maksimal koneksi serentak agar DB tidak crash
DB_MIGRATIONS_RUN=false          # Set 'true' jika ingin database update otomatis saat server menyala
DB_LOGGING=true                  # Set 'false' di production agar console tidak berisik

# ─── Security & Encryption ───
ENCRYPTION_KEY=super-secret-32-character-key! # (Wajib 32 karakter) untuk enkripsi secret 2FA di database
BCRYPT_ROUNDS=12                 # Tingkat kesulitan hashing password (standar industri: 10-12)

# ─── Auth / JWT Secrets ───
JWT_ACCESS_SECRET=your_access_token_secret_here
JWT_REFRESH_SECRET=your_refresh_token_secret_here
JWT_CHALLENGE_SECRET=your_2fa_challenge_secret_here

# Waktu kadaluarsa token login
JWT_ACCESS_EXPIRES_IN=15m        # Token utama (aman karena cepat kadaluarsa)
JWT_REFRESH_EXPIRES_IN=7d        # Token panjang untuk 'Keep me logged in'
JWT_CHALLENGE_EXPIRES_IN=10m     # Batas waktu OTP / 2FA

# ─── Google OAuth (SSO) ───
GOOGLE_CLIENT_ID=your_gcp_client_id
GOOGLE_CLIENT_SECRET=your_gcp_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v3/auth/google/callback

# ─── Frontend Origins (CORS & Redirects) ───
FRONTEND_URL=http://localhost:3001
FRONTEND_ORIGINS=http://localhost:3001
FRONTEND_AUTH_CALLBACK_URL=http://localhost:3001/auth/callback

# ─── SMTP Email (Nodemailer) ───
# Untuk fitur lupa password dan konfirmasi
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=email_anda@gmail.com
SMTP_PASS=app_password_google_disini
SMTP_FROM="Hanjeli SmartFarm <no-reply@hanjeli.com>"

# ─── Redis (Cache & Rate Limiting) ───
REDIS_ENABLED=true               # Wajib true karena kita pakai di Batch 6!
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=                  # Kosongkan jika redis lokal tanpa password

# ─── Open-Meteo & Lokasi ───
WEATHER_LATITUDE=-7.19           # Lintang Desa Hanjeli, Sukabumi
WEATHER_LONGITUDE=106.61         # Bujur Desa Hanjeli, Sukabumi
WEATHER_CACHE_TTL_SECONDS=900    # Cuaca di-cache 15 menit (agar API meteo tidak diblokir)
WEATHER_CACHE_DRIVER=redis

# ─── MQTT Broker (IoT ESP32) ───
MQTT_ENABLED=true                
MQTT_BROKER_URL=mqtt://test.mosquitto.org  # Ganti dengan broker private (misal EMQX/Mosquitto lokal) di production
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_CLIENT_ID=hanjeli-backend-core
```

---

## 2. 🖥️ Frontend Environment (`hanjeli-fe/.env.local`)

*Frontend* (Next.js) mengekspos variabelnya ke peramban (*browser*) pengguna. Maka dari itu, **KITA TIDAK BOLEH MENYIMPAN PASSWORD ATAU SECRET APAPUN DI SINI**. Semua variabel yang perlu dibaca oleh React harus berawalan `NEXT_PUBLIC_`.

```env
# ═══════════════════════════════════════════
# HANJELI FRONTEND (.env.local)
# ═══════════════════════════════════════════

# ─── Core Settings ───
NEXT_PUBLIC_APP_NAME="Hanjeli Smart Farm"
NEXT_PUBLIC_APP_VERSION="1.0.0"

# ─── REST API Endpoint ───
# Rute backend NestJS. Ini bukan URL halaman frontend.
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v3

# ─── WebSockets Endpoints (Realtime) ───
# Socket.IO memakai namespace backend /ws.
# Gunakan URL HTTP agar socket.io-client bisa melakukan handshake dan upgrade transport.
NEXT_PUBLIC_WS_URL=http://localhost:3000/ws

# ─── Local Dev Port Note ───
# Port server Next.js tidak diatur oleh NEXT_PUBLIC_*.
# Untuk menghindari bentrok dengan NestJS di 3000, jalankan:
# npm run dev -- -p 3001

# ─── Opsi Tambahan (Opsional di Masa Depan) ───
# Jika kita mengimplementasikan NextAuth.js nanti, kita butuh ini:
# NEXTAUTH_URL=http://localhost:3001
# NEXTAUTH_SECRET=secret_khusus_frontend
```

---

### Cara Penggunaan di Lapangan

1. **Local Development (Laptop Anda):**
   Gunakan `.env` (untuk backend) dan `.env.local` (untuk frontend). File-file ini sudah masuk dalam `.gitignore` sehingga tidak akan terunggah (*leak*) ke GitHub secara tak sengaja.

2. **Production (Contoh: Vercel & DigitalOcean):**
   Anda tidak mengunggah file `.env`. Anda akan melakukan *copy-paste* variabel-variabel di atas secara manual ke dalam menu **Environment Variables** di dasbor *Vercel* (untuk frontend) atau panel *VPS/Docker* Anda (untuk backend).

3. **Checklist Anti Salah Port:**
   - Browser membuka Next.js di `http://localhost:3001`.
   - Request API dari browser menuju `http://localhost:3000/api/v3`.
   - Socket.IO connect ke `http://localhost:3000/ws`.
   - Jangan memakai `ws://localhost:3000/sensors` atau `ws://localhost:3000/irrigation`, karena backend memakai namespace `/ws`.

---

## 3. 🗺️ Roadmap Sinkronisasi (Hanjeli Frontend & Backend)

**Tujuan Utama**
Menjadikan `hanjeli-fe` sepenuhnya memakai API nyata dari `hanjeli-be`, mengganti mock/static data bertahap, sambil mempertahankan gaya visual “Organic Vitality” neumorphic dari `CLAUDE.md`: soft surface, natural green palette, glass/soft UI seperlunya, responsif, aksesibel, dan tetap terasa seperti dashboard operasional, bukan landing page.

**Fase 1: Fondasi API Frontend**

1. Tambahkan konfigurasi env frontend:
   - `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v3`
   - `NEXT_PUBLIC_WS_URL=http://localhost:3000/ws`
   *(Catatan: Perhatikan port backend `3000` berbeda dengan frontend `3001` agar tidak bentrok)*

2. Buat layer API terpusat:
   - `src/lib/api/client.ts`
   - `src/lib/api/types.ts`
   - `src/lib/api/errors.ts`
   - `src/lib/api/auth.ts`
   - `src/lib/api/query-keys.ts`

3. Standarkan response handling:
   - sukses: data langsung dikonsumsi component/hook
   - error backend: `{ success:false, statusCode, message, error, fields, details, path, timestamp }`
   - `fields` dari backend dipetakan ke form errors React Hook Form

4. Tambahkan data-fetching modern:
   - rekomendasi: `@tanstack/react-query`
   - pakai cache TTL selaras backend, misalnya sensors latest 10 detik, weather 15 menit, preferences 5 menit
   - mutations melakukan invalidate query terkait

**Fase 2: Auth dan Session**

1. Sinkronkan halaman auth:
   - `/login` ke `POST /auth/login`
   - `/register` ke `POST /auth/register`
   - `/register/verify-email` ke `POST /auth/verify-email`
   - `/forgot-password` ke `POST /auth/forgot-password`
   - `/reset-password` ke `POST /auth/reset-password`
   - `/login/verify-2fa` ke `POST /auth/verify-2fa`
   - `/login/recovery` ke `POST /auth/verify-recovery`

2. Buat session manager:
   - simpan `access_token`, `refresh_token`, `expires_in`, dan sanitized `user`
   - auto refresh via `POST /auth/refresh`
   - saat 401, coba refresh satu kali, lalu logout jika gagal

3. Route protection:
   - dashboard, monitoring, irrigation, profile, users wajib login
   - halaman `/users` hanya untuk role admin/manager sesuai roles backend
   - guest diarahkan ke login dengan callback URL

4. Google OAuth:
   - tombol login diarahkan ke `GET /auth/google`
   - callback frontend menangani hasil redirect sesuai kontrak backend

**Fase 3: Ganti Mock Data Per Halaman**

1. Home dashboard:
   - weather dari `GET /weather/current`
   - sensor ringkasan dari `GET /sensors/overview`
   - sensor terbaru dari `GET /sensors/latest`
   - quality score dari `GET /sensors/quality-score`
   - devices dari `GET /devices`
   - notifications dari `GET /notifications`

2. Monitoring:
   - trend chart dari `GET /sensors/trend?param=&range=`
   - stats dari `GET /sensors/stats?param=&range=`
   - table history dari `GET /sensors/history?from=&to=&page=&limit=`
   - export CSV dari `GET /sensors/export?...&format=csv`

3. Irrigation:
   - config dari `GET /irrigation/config`
   - schedules dari `GET /irrigation/schedules`
   - activity dari `GET /irrigation/activity`
   - command realtime via WebSocket untuk mode, emergency stop, resume, manual toggle

4. Profile:
   - user profile dari `GET /users/me`
   - update profile via `PUT /users/me`
   - preferences dari `GET /preferences`
   - update units, notification prefs, sensor thresholds via endpoint preferences
   - 2FA setup/enable/disable memakai endpoint auth

5. Users admin:
   - list dari `GET /users`
   - create/update/delete dari endpoint `/users`
   - tampilkan empty, loading, error, dan permission state dengan komponen UI yang sudah ada

**Fase 4: Realtime Sync**

1. Tambahkan `socket.io-client`.

2. Buat hook realtime:
   - `src/hooks/use-realtime.ts`
   - connect ke `/ws`
   - token dikirim via handshake `auth.token`
   - cleanup listener saat unmount

3. Event yang dipakai:
   - `sensor:realtime` update cards dan charts
   - `device:status` update status perangkat
   - `notification:new` tampilkan toast dan update notification list
   - `irrigation:status`, `irrigation:emergency`, `irrigation:ack` untuk irrigation UI

**Fase 5: Data Mapping dan Konsistensi Tipe**

1. Buat mapper agar nama backend dan UI rapi:
   - `ph_level` ke `ph`
   - `soil_moisture`, `soil_ec`, `soil_npk`, `temperature`
   - pagination backend `total_pages` dipetakan ke pagination UI

2. Hindari akses langsung ke struktur mentah backend di component.
   Component cukup konsumsi tipe UI yang sudah dimap.

3. Semua mock lama dipertahankan sementara sebagai fallback dev, lalu dihapus bertahap setelah endpoint terkait stabil.

**Fase 6: Style dan UX**

1. Pertahankan sistem visual yang sudah ada:
   - `dashboard-layout`
   - `components/ui`
   - `components/ui-states`
   - warna hijau natural, soft shadows, neumorphic surfaces
   - radius dan spacing konsisten

2. Jangan ubah dashboard menjadi hero/landing.
   UI harus tetap padat, mudah discan, dan cocok untuk petani/admin yang memantau kondisi farm.

3. Setiap area data wajib punya:
   - loading skeleton dengan ukuran stabil
   - empty state yang jelas
   - error state dengan retry
   - stale/reconnecting state untuk realtime

4. Form auth/profile/users:
   - field errors dari backend tampil dekat input
   - tombol disabled saat submit
   - success/error toast via `sonner`
   - copy tetap sederhana dan user-friendly

5. Responsiveness:
   - mobile tidak boleh overlap
   - chart/table punya layout alternatif
   - toolbar dan filter memakai icon lucide, select, tabs, segmented control sesuai kebutuhan

**Fase 7: Security dan Quality Gate**

1. Jangan taruh secret di `NEXT_PUBLIC_*`.
2. Semua request protected wajib Bearer token.
3. Logout harus clear token, user cache, dan socket.
4. Cegah duplicate submit di mutation.
5. Validasi form tetap pakai Zod.
6. Tambahkan test untuk:
   - auth flow
   - API client error parser
   - data mapper sensor/weather/irrigation
   - protected route behavior
   - minimal Playwright smoke untuk login dan dashboard

**Urutan Eksekusi Yang Disarankan**

1. API client, env, error parser, token/session manager.
2. Auth pages sampai login/register/reset/2FA berfungsi.
3. React Query provider dan hooks utama.
4. Home dashboard real data.
5. Monitoring real data plus export.
6. Irrigation REST plus WebSocket commands.
7. Profile, preferences, users admin.
8. Realtime events global.
9. Polish style, states, responsive QA, dan test.

Dengan urutan ini, frontend bisa tetap stabil secara visual sambil mock data diganti satu per satu ke backend nyata.
