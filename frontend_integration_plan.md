# 🌐 Rencana Integrasi Frontend (hanjeli-fe) ↔ Backend (hanjeli-be)

> **Dokumen Perencanaan berdasarkan panduan 6 Agen (CLAUDE.md)**  
> **Tema Desain:** Organic Vitality (Neumorphism, Glassmorphism, Frost UI, Claymorphism)

---

## Catatan Port Lokal Wajib

Karena Next.js dan NestJS sama-sama biasa memakai port `3000`, integrasi lokal harus dibuat eksplisit agar tidak salah target:

| Layer | Aplikasi | Port Lokal | URL Utama |
| --- | --- | ---: | --- |
| Frontend | Next.js `hanjeli-fe` | `3001` | `http://localhost:3001` |
| Backend | NestJS `hanjeli-be` | `3000` | `http://localhost:3000/api/v3` |
| Realtime | Socket.IO NestJS | `3000` | `http://localhost:3000/ws` |

Aturan praktis:
- `NEXT_PUBLIC_API_URL` selalu menunjuk ke backend REST: `http://localhost:3000/api/v3`.
- Frontend dibuka di browser melalui `http://localhost:3001`, misalnya dengan `npm run dev -- -p 3001`.
- Socket.IO memakai namespace backend `/ws`, bukan `/sensors` atau `/irrigation`.
- Event channel dibedakan lewat nama event, misalnya `sensor:realtime`, `irrigation:manualToggle`, dan `notification:new`.

---

## 🏗️ Fase 1: Fondasi Klien & Jembatan Komunikasi (Agen 1 & 6)

### 1.1 Kebutuhan Pustaka (Tech Updater - Agen 6)
Frontend saat ini sudah memiliki fondasi dependency yang relevan, jadi planning integrasi harus memaksimalkan pustaka yang sudah ada sebelum menambah dependency baru:
- **`axios`**: Sebagai *HTTP Client* tangguh.
- **`swr`**: Untuk _caching_ data REST API secara cerdas di sisi browser.
- **`socket.io-client`**: Untuk terhubung ke *WebSocket Gateway* di backend.
- **`framer-motion`**: Untuk animasi halus pada transisi *loading*, *empty*, dan *data-ready*.
- **`zustand`**: Opsional di fase lanjutan jika data realtime per detik mulai membuat re-render global terlalu berat. Jangan ditambahkan sebelum ada kebutuhan performa yang terukur.

### 1.2 Konfigurasi Akses API (`src/lib/apiClient.ts`) (Agen 1)
Membuat *Axios Interceptor* yang secara otomatis mengambil `JWT_ACCESS_TOKEN` dari *LocalStorage/Cookies* dan menyisipkannya ke `Authorization: Bearer <token>` di setiap request. Jika API melempar *401 Unauthorized*, interceptor ini akan memicu _auto-logout_ atau _refresh token_.

### 1.3 Kontrak Error & Validasi (Agen 2, 3, 5)
- Standarkan pembacaan error backend dari bentuk `{ success, statusCode, message, error, fields, details, path, timestamp }`.
- Jika backend mengirim `fields`, map ke error React Hook Form agar pesan tampil langsung di bawah input.
- Jangan tampilkan stack trace atau detail internal ke user. UI cukup menampilkan pesan operasional yang jelas.

---

## 🔐 Fase 2: Sinkronisasi Autentikasi (Agen 2 & 5)

### 2.1 Menyingkirkan Login Palsu
- Menghubungkan *Form Login* ke endpoint `POST /api/v3/auth/login`.
- Jika berhasil, token disimpan, dan user diarahkan ke `/dashboard`.

### 2.2 UI/UX Respons (Agen 4)
- **Gaya Neumorphism:** *Input field* menggunakan *inner shadow* (*inset*) agar terlihat berongga di layar. Saat pengguna mengetik, bayangan berubah menjadi *Soft Frost UI* (biru kehijauan redup ala Organic Vitality).
- **Loading State:** Tombol "Masuk" berubah menjadi animasi *pulse claymorphism* (empuk) saat menunggu *response* API (< 500ms).

---

## 📊 Fase 3: Integrasi Dasbor & Monitoring (Agen 3 & 4)

### 3.1 Custom Hook WebSocket (`useSensorSocket.ts`)
Agen 3 (Bug Hunter) akan memastikan bahwa `socket.disconnect()` dipanggil di dalam fungsi `useEffect cleanup` agar tidak terjadi kebocoran memori (_Memory Leak_) saat pengguna berpindah halaman dari *Monitoring* ke *Profile*.

### 3.2 Alur Data Real-Time
1. Halaman memuat data historis cuaca dan sensor via `GET /api/v3/sensors/trend` menggunakan SWR (Data awal langsung muncul).
2. Socket.IO *connects* ke namespace `http://localhost:3000/ws` dengan handshake `auth: { token }`.
3. Setiap ada *event* `sensor:realtime`, kurva pada grafik (Recharts) akan bergeser mulus secara animasi (tidak perlu me-refresh halaman).

### 3.3 Visualisasi (Agen 4 & 6)
- **Kartu Sensor (Suhu, Kelembapan, pH, NPK):** Menggunakan *Soft UI / Claymorphism*. Jika data melebihi ambang batas (*threshold*), kartu akan berpendar merah lembut (*Red Frost Glassmorphism*).
- **Skeleton Loader:** Saat data awal dimuat, gunakan kerangka kosong bertekstur *Neumorphic inset* dengan pantulan cahaya yang berjalan bolak-balik.

---

## 🚰 Fase 4: Otomasi Irigasi & Hardware Control (Semua Agen)

Fase paling krusial karena melibatkan nyawa sistem irigasi:
1. **Fetch Konfigurasi:** Mengambil data mode `auto`/`manual` dari `GET /api/v3/irrigation/config`.
2. **Tombol "SIRAM SEKARANG" (Manual Mode):** 
   - **Tampilan Awal (OFF):** Tombol timbul *Claymorphism* (tebal, membulat, menonjol).
   - **Saat Ditekan:** Mengirim event WebSocket `irrigation:manualToggle`.
   - **Status (ON):** Tombol melesak ke dalam (*Neumorphic Inset*) dan berwarna biru *cyan* bercahaya (*Soft UI Glow*), menandakan pompa sedang hidup (setelah menerima balasan ACK `irrigation:ack` dari server).
3. **Emergency Stop:** Sebuah tombol dengan desain *Frost Glass* merah tajam namun elegan.

*(Agen 5 memastikan bahwa namespace WebSocket yang dipanggil benar-benar `/ws`, lalu jenis aksi dibedakan lewat event `irrigation:setMode`, `irrigation:emergencyStop`, `irrigation:resume`, dan `irrigation:manualToggle`.)*

---

## ⚙️ Fase 5: Profil, Ambang Batas & Notifikasi (Agen 1 & 2)

### 5.1 Pengaturan Profil (`PUT /api/v3/preferences/sensor-thresholds`)
- Menggantikan *mock data* pada halaman profil untuk menyetel angka kritis (misal: "Beri tahu saya jika pH turun di bawah 5.5").
- **UI:** *Slider* berdesain *Neumorphic* dengan *track* yang bersinar saat digeser (Organic Vitality style).

### 5.2 Lonceng Notifikasi Dropdown
- Integrasi ke `GET /api/v3/notifications`.
- Menangkap notifikasi baru secara *real-time* lewat WebSocket event `notification:new` (membuat lonceng bergetar mulus / CSS *micro-animations*).

---

## 🧩 Fase 6: Planning Tambahan Arsitektur Lapangan (Lampiran)

Bagian ini menambahkan blueprint holistik dari planning terlampir, dengan penyesuaian pada kontrak backend/frontend yang sudah diverifikasi.

### 6.1 Arsitektur Data & Backend Readiness (Agen 1 & 6)
- **Database Time-Series:** Data sensor pH, kelembapan, suhu, EC, dan NPK perlu diperlakukan sebagai data deret waktu. Jika TimescaleDB sudah tersedia di environment, pastikan query grafik/histori frontend tetap memakai endpoint backend yang sudah merangkum data, bukan query langsung dari browser.
- **Redis Cache:** Frontend harus menghormati TTL backend. Contoh: `sensors/latest` pendek, `weather/current` lebih panjang, dan `preferences` stabil. Jangan melakukan polling agresif jika WebSocket sudah menyediakan update.
- **WebSockets & Event-Driven:** Hindari polling terus-menerus untuk data sensor dan status irigasi. REST dipakai untuk initial load, WebSocket dipakai untuk update setelah halaman aktif.
- **MQTT Broker:** Tetap berada di belakang backend. Frontend tidak boleh terhubung langsung ke broker MQTT, karena auth, sanitasi payload, dan validasi anomali harus melalui backend.

### 6.2 Kualitas, Sanitasi & Keamanan (Agen 2 & 3)
- **Strict Typing:** Gunakan tipe TypeScript untuk setiap payload REST dan WebSocket. Payload sensor yang belum lengkap harus diperlakukan sebagai partial data, bukan menyebabkan UI crash.
- **Validasi Form:** Zod tetap dipakai di frontend. `class-validator` tetap menjadi tanggung jawab backend.
- **Memory Leak Guard:** Semua socket listener wajib dibersihkan di `useEffect cleanup` dengan `socket.off(...)` dan `socket.disconnect()` sesuai kebutuhan halaman.
- **Rate Limiting Awareness:** Saat backend mengembalikan `429`, tampilkan pesan ramah dan jangan auto-retry agresif.
- **Pre-commit/Test Gate:** Sebelum implementasi besar, targetkan `npm run lint`, `npm run build`, dan smoke test halaman auth/dashboard/irrigation.

### 6.3 UX & Resiliensi UI (Agen 4)
- **Optimistic UI:** Tombol irigasi boleh memberi feedback instan, tetapi status final harus menunggu `irrigation:ack` atau `irrigation:status`.
- **Graceful Degradation:** Jika WebSocket putus, UI tetap menampilkan data REST terakhir dengan label "reconnecting" atau "data terakhir".
- **Skeleton Loading:** Skeleton harus mengikuti dimensi kartu asli agar layout tidak melompat.
- **Organic Vitality Style:** Gunakan soft shadow, inset state untuk kontrol aktif, warna hijau natural sebagai aksen utama, dan red frost/glass hanya untuk kondisi bahaya.

### 6.4 Edge Cases Hardware (Agen 5)
- **Heartbeat/Last Seen:** UI harus membedakan data segar dan data usang. Jika sensor lama tidak update, tampilkan status offline atau stale.
- **Sanitasi Anomali:** Jika nilai sensor di luar batas wajar, tampilkan badge "perlu validasi" atau "anomali", bukan langsung menganggap data valid.
- **Fallback Operasional:** Emergency stop harus tetap mudah terlihat, namun tidak boleh tertukar dengan tombol aksi biasa.

---

## 📅 Rencana Urutan Eksekusi (*Roadmap*)

1. **Sprint 0:** Rapikan port lokal dan environment, pastikan Next berjalan di `3001` dan Nest di `3000`.
2. **Sprint 1 (Fase 1 & 2):** Setup *API Client*, JWT Token, Login/Register *Flow*.
3. **Sprint 2 (Fase 3):** Menyambungkan Dasbor, Grafik, dan WebSockets Sensor.
4. **Sprint 3 (Fase 4):** Menghidupkan panel Irigasi dan interaksi MQTT melalui WebSockets backend.
5. **Sprint 4 (Fase 5):** Penghalusan UX Profil, Notifikasi, dan sentuhan *micro-animations* final.
6. **Sprint 5 (Fase 6):** Hardening edge cases hardware, stale/offline state, dan QA performa realtime.

---

**Kesimpulan dari Tim 6 Agen:**  
Misi ini tidak hanya sekadar "membuat tombol berfungsi", melainkan menghapus 100% data *dummy* sambil mempertahankan esensi estetika eksklusif **"Organic Vitality Neumorphism"**. Kesalahan *parsing*, kebocoran memori memori, maupun data halusinasi tidak akan dibiarkan lolos di lapisan *Frontend* ini.

---

## 🗺️ Detail Roadmap Sinkronisasi Tambahan

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
