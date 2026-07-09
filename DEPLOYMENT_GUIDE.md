# Panduan Deployment & Hosting: Hanjeli SmartFarm

Panduan ini ditujukan bagi Administrator atau DevOps yang akan melakukan *deploy* (merilis) aplikasi Hanjeli SmartFarm ke server produksi (VPS/Cloud). 

Karena alasan **Keamanan** dan **Efisiensi**, file konfigurasi rahasia (`.env`), *dependencies* (`node_modules/`), dan hasil kompilasi (`dist/`, `.next/`) **dikecualikan dari GitHub (.gitignore)**. Panduan ini menjelaskan langkah demi langkah cara membangun ulang elemen-elemen tersebut secara aman di server produksi.

---

## 1. Persyaratan Server (System Requirements)
Pastikan VPS/Server Anda (berbasis Ubuntu/Debian disarankan) telah menginstal komponen berikut:
- **Node.js**: v18 atau v20 LTS.
- **PostgreSQL**: v14 atau lebih baru (Sistem Database Utama).
- **TimescaleDB**: Ekstensi PostgreSQL yang WAJIB untuk telemetri sensor.
- **Eclipse Mosquitto**: MQTT Broker untuk IoT ESP32.
- **Redis (Opsional)**: Untuk *caching* cuaca Open-Meteo.
- **Nginx**: Sebagai *Reverse Proxy* & Web Server.
- **PM2**: `npm install -g pm2` (Untuk menjaga aplikasi tetap hidup).
- **Git**: Untuk menarik (*pull*) kode dari repositori.

---

## 2. Mengambil Kode dari GitHub (Clone)
Masuk ke terminal server Anda dan tarik kode sumber (*source code*) murni dari GitHub:

```bash
cd /var/www
git clone https://github.com/haniefhuda03-cyber/hanjeli-smartfarm.git
cd hanjeli-smartfarm
```
*(Catatan: Folder ini tidak akan memiliki `.env`, `node_modules`, maupun folder build)*

---

## 3. Rekonstruksi Lingkungan (Environment Variables)
Karena file `.env` dirahasiakan, Anda WAJIB membuatnya secara manual di server.

### A. Backend (`hanjeli-be/.env`)
Masuk ke folder backend dan buat file `.env`:
```bash
cd /var/www/hanjeli-smartfarm/hanjeli-be
nano .env
```
Isi dengan template berikut, dan **WAJIB ganti string SECRET dengan teks acak yang kuat** (Bisa di-generate menggunakan `openssl rand -base64 48` di terminal):

```env
NODE_ENV=production
PORT=3000

# Konfigurasi Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=username_database_anda
DB_PASSWORD=password_database_anda
DB_NAME=hanjeli_smartfarm_db
DB_POOL_MAX=20
DB_MIGRATIONS_RUN=true
DB_LOGGING=false

# Security & JWT (GANTI SEMUA DENGAN STRING ACAK YANG KUAT!)
ENCRYPTION_KEY=ganti_dengan_secret_super_kuat
JWT_ACCESS_SECRET=ganti_dengan_secret_super_kuat_1
JWT_REFRESH_SECRET=ganti_dengan_secret_super_kuat_2
JWT_CHALLENGE_SECRET=ganti_dengan_secret_super_kuat_3
TWO_FACTOR_ENCRYPTION_SECRET=ganti_dengan_secret_super_kuat_4
AUTH_TOKEN_HASH_SECRET=ganti_dengan_secret_super_kuat_5

# Konfigurasi Domain
FRONTEND_URL=https://hanjeli.com
FRONTEND_ORIGINS=https://hanjeli.com,https://api.hanjeli.com

# SMTP Email (Wajib untuk Lupa Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=emailanda@gmail.com
SMTP_PASS=app_password_gmail_anda
SMTP_FROM="Hanjeli Smart Farm <emailanda@gmail.com>"

# MQTT & Redis
MQTT_ENABLED=true
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=hanjeli_device
MQTT_PASSWORD=password_mqtt_kuat

REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
```

### B. Frontend (`hanjeli-fe/.env.production`)
Buat file untuk konfigurasi frontend:
```bash
cd /var/www/hanjeli-smartfarm/hanjeli-fe
nano .env.production
```
Isi dengan:
```env
NEXT_PUBLIC_API_URL=https://api.hanjeli.com/api/v3
NEXT_PUBLIC_WS_URL=wss://api.hanjeli.com
```

---

## 4. Mengunduh Dependencies (`node_modules`)
Di server, jalankan instalasi Node Package Manager. Ini akan mengunduh ratusan megabyte library yang sebelumnya kita abaikan di `.gitignore`.

**Di Backend:**
```bash
cd /var/www/hanjeli-smartfarm/hanjeli-be
npm ci
```
*(Gunakan `npm ci` di produksi, bukan `npm install`, agar versi terkunci rapat)*

**Di Frontend:**
```bash
cd /var/www/hanjeli-smartfarm/hanjeli-fe
npm ci
```

---

## 5. Kompilasi & Build (`dist` & `.next`)
Mesin server Anda sekarang harus merakit (*build*) kode TypeScript menjadi JavaScript yang dioptimalkan.

**Kompilasi Backend:**
```bash
cd /var/www/hanjeli-smartfarm/hanjeli-be
npm run build
```
*(Ini akan meregenerasi folder `dist/`)*

**Kompilasi Frontend:**
```bash
cd /var/www/hanjeli-smartfarm/hanjeli-fe
npm run build
```
*(Ini akan meregenerasi folder `.next/`)*

---

## 6. Persiapan Database & Akun Admin
Jika ini instalasi pertama, jalankan perintah setup. Sistem akan otomatis menjalankan tabel (*migration*) dan secara interaktif **meminta Anda memasukkan password untuk Akun Admin Utama**.

```bash
cd /var/www/hanjeli-smartfarm/hanjeli-be
npm run db:setup
```

---

## 7. Menjalankan Aplikasi via PM2
Gunakan PM2 agar aplikasi tetap hidup meskipun server di-restart atau Anda menutup terminal.

```bash
# Jalankan Backend
cd /var/www/hanjeli-smartfarm/hanjeli-be
pm2 start npm --name "hanjeli-be" -- run start:prod

# Jalankan Frontend
cd /var/www/hanjeli-smartfarm/hanjeli-fe
pm2 start npm --name "hanjeli-fe" -- start

# Simpan konfigurasi PM2 agar autostart saat server reboot
pm2 save
pm2 startup
```

---

## 8. Reverse Proxy (Nginx) & SSL
Anda memiliki aplikasi di `localhost:3000` (Backend) dan `localhost:3001` (Frontend). Nginx bertugas mengarahkan domain publik ke port tersebut.

1. Buka Nginx config (contoh: `/etc/nginx/sites-available/hanjeli`).
2. Arahkan `hanjeli.com` ke port `3001` (Frontend).
3. Arahkan `api.hanjeli.com` ke port `3000` (Backend). **Pastikan Anda mengatur block Nginx agar mem-bypass koneksi *WebSockets* (Upgrade header)** untuk `api.hanjeli.com` agar data sensor *real-time* berfungsi.
4. Jalankan **Certbot / Let's Encrypt** untuk mengaktifkan HTTPS secara otomatis pada kedua domain tersebut.

> **Selesai!** Aplikasi Hanjeli SmartFarm sekarang sudah hidup secara aman di server produksi. Apabila Anda melakukan *push* update kode baru di masa depan, Anda cukup melakukan: `git pull`, lalu mengulang Langkah 4, 5, dan me-restart PM2 (`pm2 restart all`).
