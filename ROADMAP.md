# 🗺️ Hanjeli SmartFarm — Feature Roadmap

> Dokumen ini berisi daftar fitur yang **direncanakan untuk update mendatang** (target: 2027).
> Fitur-fitur di bawah ini sengaja **tidak diaktifkan/dikecualikan** pada versi saat ini
> karena membutuhkan hardware tambahan, kalibrasi, atau pengembangan backend yang lebih lanjut.

---

## 📋 Daftar Fitur Tertunda

### 1. 🔌 Sensor EC Tanah (Electrical Conductivity)
- **Status:** ❌ Dikecualikan dari dashboard & parameter irigasi
- **Alasan:** Sensor EC belum terpasang di lapangan. Data EC memerlukan kalibrasi khusus
  dan integrasi dengan sistem pembacaan ADC yang belum tersedia.
- **Lokasi kode yang terpengaruh:**
  - `src/app/home/page.tsx` — Card sensor EC dihapus dari array `sensors`
  - `src/app/irrigation/page.tsx` — Parameter `soil_ec` dihapus dari `sensorParameters`
  - Terjemahan `home.sensor_ec` tetap tersimpan di file i18n (siap diaktifkan kembali)
- **Rencana:** Integrasi sensor EC (analog/I2C) → kalibrasi → tampilkan di dashboard
  dengan unit mS/cm dan threshold untuk trigger irigasi otomatis.

### 2. ⚡ PWM (Pulse Width Modulation) untuk Kontrol Pompa
- **Status:** ❌ Dibekukan — hanya ON/OFF (0% atau 100%)
- **Alasan:** Hardware pompa saat ini menggunakan relay sederhana (ON/OFF),
  bukan motor driver dengan dukungan PWM. Slider kecepatan 0-100% tidak relevan.
- **Lokasi kode yang terpengaruh:**
  - `src/app/irrigation/page.tsx` — `manualSpeed` state dihapus,
    slider diganti dengan status ON/OFF saja
  - Card manual di settings modal menampilkan catatan bahwa PWM belum tersedia
- **Rencana:** Upgrade ke motor driver (L298N/VFD) → implementasi PWM control
  → slider kecepatan 0-100% dengan step granular → feedback RPM dari sensor.

### 3. 🎛️ PID Controller (Proportional-Integral-Derivative)
- **Status:** 🔮 Fitur Masa Depan
- **Alasan:** PID memerlukan:
  - Sensor feedback (flow meter, pressure sensor)
  - PWM output (lihat poin #2)
  - Tuning parameter (Kp, Ki, Kd) per kondisi lapangan
  - Backend processing real-time
- **Rencana:** Setelah PWM aktif → implementasi PID loop di firmware ESP32
  → tuning UI di frontend → auto-tuning via Ziegler-Nichols method.

### 4. 🤖 AI Monitoring & Prediksi
- **Status:** 🔮 Fitur Masa Depan (Coming Soon badge sudah tampil di landing page)
- **Alasan:** Memerlukan:
  - Dataset historis minimal 6-12 bulan dari sensor
  - Model ML untuk prediksi kebutuhan air
  - Deteksi anomali (penyakit tanaman, kebocoran pipa)
  - Backend ML serving (TensorFlow Lite / ONNX)
- **Fitur yang direncanakan:**
  - 📊 **Prediksi Kebutuhan Air** — Berdasarkan cuaca, kelembaban, dan pola historis
  - 🦠 **Deteksi Penyakit Tanaman** — Analisis gambar dari kamera lapangan (Computer Vision)
  - 📈 **Analisis Tren** — Dashboard analitik dengan grafik tren parameter tanah
  - ⚠️ **Smart Alert** — Notifikasi cerdas berdasarkan pola anomali, bukan hanya threshold statis
  - 🌾 **Rekomendasi Pupuk** — Berdasarkan data NPK dan EC tanah

### 5. 📊 Dashboard Analitik Lanjutan
- **Status:** 🔮 Fitur Masa Depan
- **Fitur yang direncanakan:**
  - Grafik historis per parameter (7 hari, 30 hari, 1 tahun)
  - Ekspor data ke CSV/Excel
  - Perbandingan antar zona lahan
  - Heatmap kelembaban per zona
  - Laporan otomatis mingguan/bulanan

### 6. 🔄 OTA Firmware Update
- **Status:** 🔮 Fitur Masa Depan
- **Rencana:** Update firmware ESP32 dari dashboard web tanpa perlu akses fisik ke perangkat.

---

## 🏗️ Arsitektur yang Perlu Disiapkan

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Dashboard │  │ Irigasi  │  │ AI Monitoring     │  │
│  │ + EC Card │  │ + PWM    │  │ + Prediksi        │  │
│  │           │  │ + PID    │  │ + Deteksi Penyakit│  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
└─────────────────────┬───────────────────────────────┘
                      │ REST API / WebSocket
┌─────────────────────┴───────────────────────────────┐
│                   Backend (Node/Python)              │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ MQTT     │  │ PID      │  │ ML Model          │  │
│  │ Broker   │  │ Engine   │  │ Serving            │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
└─────────────────────┬───────────────────────────────┘
                      │ MQTT
┌─────────────────────┴───────────────────────────────┐
│                   ESP32 Firmware                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Sensor   │  │ PWM      │  │ OTA Update        │  │
│  │ Reading  │  │ Control  │  │ Manager            │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 📅 Timeline Estimasi

| Kuartal    | Fitur Target                              | Prioritas |
|------------|-------------------------------------------|-----------|
| Q1 2027    | Sensor EC + Kalibrasi                     | 🔴 Tinggi |
| Q1 2027    | PWM Motor Driver                          | 🔴 Tinggi |
| Q2 2027    | PID Controller                            | 🟡 Sedang |
| Q2 2027    | Dashboard Analitik (grafik historis)      | 🟡 Sedang |
| Q3 2027    | AI Prediksi Kebutuhan Air                 | 🟡 Sedang |
| Q3 2027    | AI Deteksi Penyakit (Computer Vision)     | 🟢 Rendah |
| Q4 2027    | OTA Firmware Update                       | 🟢 Rendah |
| Q4 2027    | Smart Alert + Rekomendasi Pupuk           | 🟢 Rendah |

---

> **Catatan:** Dokumen ini akan diperbarui seiring perkembangan proyek.
> Untuk pertanyaan atau saran fitur, hubungi tim pengembang.
