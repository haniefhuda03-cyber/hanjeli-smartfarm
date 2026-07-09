/**
 * ═══════════════════════════════════════════════════════════════════
 *  Hanjeli SmartFarm — Firmware ESP32 (sensor tanah + kontrol irigasi)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Fungsi:
 *   1. Membaca sensor tanah: pH, kelembapan, N-P-K (RS485), suhu, hujan
 *   2. Mengirim telemetry ke backend via MQTT dengan timestamp NTP (WAJIB)
 *   3. Menerima perintah irigasi (pompa air & pupuk, kecepatan PWM)
 *   4. Membalas ACK ≤ 10 detik (server menunggu; tanpa ACK = notifikasi
 *      "perangkat tidak merespons" di dashboard)
 *   5. Melaporkan status online/offline (LWT) + kondisi hujan
 *
 *  Library (Library Manager Arduino IDE):
 *   - PubSubClient  (Nick O'Leary)   — MQTT
 *   - ArduinoJson   (Benoit Blanchon, v7)
 *
 *  Kontrak payload: lihat README.md bagian "Setup ESP32 + Kontrak
 *  Payload MQTT" di repo Hanjeli SmartFarm.
 * ═══════════════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

/* ─────────────── KONFIGURASI — SESUAIKAN ─────────────── */

// WiFi
const char* WIFI_SSID     = "NAMA_WIFI_ANDA";
const char* WIFI_PASSWORD = "PASSWORD_WIFI_ANDA";

// MQTT — IP mesin/server yang menjalankan broker Docker (port 1883)
const char* MQTT_HOST     = "192.168.1.10";
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "hanjeli_device";
const char* MQTT_PASS     = "GANTI_DENGAN_MQTT_PASSWORD";  // = MQTT_PASSWORD di .env backend

// Kode perangkat — HARUS sama persis (huruf besar) dengan yang
// didaftarkan di dashboard: Profil → Perangkat IoT
const char* SENSOR_CODE   = "WS004";   // perangkat tipe "sensor"
const char* PUMP_CODE     = "PMP01";   // perangkat tipe "pump"

// Interval
const unsigned long SENSOR_INTERVAL_MS = 30000;  // kirim telemetry tiap 30 dtk
const unsigned long STATUS_INTERVAL_MS = 60000;  // heartbeat status tiap 60 dtk

// Pin — sesuaikan dengan wiring Anda
const int PIN_PH        = 34;  // ADC — modul sensor pH tanah (analog)
const int PIN_MOISTURE  = 35;  // ADC — capacitive soil moisture v1.2/2.0
const int PIN_RAIN      = 27;  // DO  — raindrop sensor (LOW = basah/hujan)
const int PIN_TEMP      = 32;  // ADC — sensor suhu tanah analog (mis. LM35/NTC)
                               //       (untuk DS18B20 gunakan OneWire — lihat catatan di bawah)
const int PIN_PUMP_WATER      = 25;  // PWM → driver/relay SSR pompa air
const int PIN_PUMP_FERTILIZER = 26;  // PWM → driver/relay SSR pompa pupuk

// RS485 NPK sensor (JXCT / ComWinTop dsb.) via UART2 + modul MAX485
const int PIN_RS485_RX = 16;
const int PIN_RS485_TX = 17;
const int PIN_RS485_DE = 4;    // DE+RE dijadikan satu (HIGH = kirim)

// PWM pompa
const int PWM_FREQ = 5000, PWM_RES = 8;   // duty 0–255

// Topik MQTT (JANGAN diubah — kontrak dengan backend)
String topicSensor;                        // hanjeli/sensor/<SENSOR_CODE>
String topicStatusSensor;                  // hanjeli/device/<SENSOR_CODE>/status
String topicStatusPump;                    // hanjeli/device/<PUMP_CODE>/status
const char* TOPIC_COMMAND = "hanjeli/irrigation/command";
const char* TOPIC_ACK     = "hanjeli/irrigation/ack";

/* ─────────────── STATE ─────────────── */

WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);
HardwareSerial rs485(2);

unsigned long lastSensorPublish = 0;
unsigned long lastStatusPublish = 0;
bool emergencyStop = false;   // latch: hanya RESUME yang melepaskan

/* ─────────────── WAKTU (NTP) — ts WAJIB ─────────────── */

void setupTime() {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  Serial.print("Sinkronisasi NTP");
  time_t now = 0;
  // Backend MENOLAK reading dengan ts < tahun 2020 — tunggu sampai valid
  while (now < 1577836800) {  // 2020-01-01
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.printf("\nWaktu tersinkron: %lu\n", (unsigned long)now);
}

uint32_t epochNow() { return (uint32_t)time(nullptr); }

/* ─────────────── PEMBACAAN SENSOR ───────────────
 * Semua fungsi mengembalikan NAN bila sensor tidak terpasang/gagal —
 * field yang NAN otomatis TIDAK dikirim (backend menyimpan NULL).
 * KALIBRASI nilai analog di bawah sesuai modul Anda.
 */

float readPh() {
  int raw = analogRead(PIN_PH);                    // 0–4095
  if (raw <= 0 || raw >= 4095) return NAN;
  // Kalibrasi 2 titik (contoh): raw 2050 = pH 7.0 ; raw 1350 = pH 4.0
  float voltage = raw * 3.3f / 4095.0f;
  float ph = 7.0f + ((2.5f - voltage) / 0.18f);    // ← sesuaikan dgn probe Anda
  return constrain(ph, 0.0f, 14.0f);
}

float readMoisture() {
  int raw = analogRead(PIN_MOISTURE);
  if (raw <= 0 || raw >= 4095) return NAN;
  // Kalibrasi: udara (kering) ≈ 3300 ; terendam air ≈ 1300
  const int DRY = 3300, WET = 1300;
  float pct = 100.0f * (DRY - raw) / (float)(DRY - WET);
  return constrain(pct, 0.0f, 100.0f);
}

float readSoilTemperature() {
  int raw = analogRead(PIN_TEMP);
  if (raw <= 0 || raw >= 4095) return NAN;
  // Contoh LM35: 10 mV/°C
  float voltage = raw * 3.3f / 4095.0f;
  return voltage * 100.0f;
  // ── DS18B20? Pasang library OneWire+DallasTemperature lalu ganti
  //    fungsi ini dengan sensors.getTempCByIndex(0).
}

bool readRain() {
  // Raindrop module: DO = LOW saat permukaan basah (hujan)
  pinMode(PIN_RAIN, INPUT_PULLUP);
  return digitalRead(PIN_RAIN) == LOW;
}

/* NPK via RS485 Modbus RTU (register umum sensor JXCT):
 *   N = reg 0x001E, P = 0x001F, K = 0x0020 (mg/kg), fungsi 0x03, addr 0x01 */
bool readNpkRegister(uint16_t reg, float &out) {
  uint8_t req[8] = { 0x01, 0x03, (uint8_t)(reg >> 8), (uint8_t)(reg & 0xFF), 0x00, 0x01, 0, 0 };
  // CRC16-Modbus
  uint16_t crc = 0xFFFF;
  for (int i = 0; i < 6; i++) {
    crc ^= req[i];
    for (int b = 0; b < 8; b++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
  }
  req[6] = crc & 0xFF; req[7] = crc >> 8;

  digitalWrite(PIN_RS485_DE, HIGH); delayMicroseconds(50);
  rs485.write(req, 8); rs485.flush();
  digitalWrite(PIN_RS485_DE, LOW);

  uint8_t resp[7]; unsigned long start = millis(); int idx = 0;
  while (millis() - start < 300 && idx < 7) {
    if (rs485.available()) resp[idx++] = rs485.read();
  }
  if (idx < 7 || resp[0] != 0x01 || resp[1] != 0x03) return false;
  out = (float)((resp[3] << 8) | resp[4]);
  return true;
}

/* ─────────────── MQTT ─────────────── */

void addIfValid(JsonDocument &doc, const char* key, float v) {
  if (!isnan(v)) doc[key] = ((int)(v * 10 + 0.5f)) / 10.0f;  // 1 desimal
}

void publishSensor() {
  JsonDocument doc;
  doc["code"] = SENSOR_CODE;
  doc["ts"]   = epochNow();          // WAJIB — tanpa ini reading DIBUANG server
  addIfValid(doc, "ph",       readPh());
  addIfValid(doc, "moisture", readMoisture());
  float n, p, k;
  if (readNpkRegister(0x001E, n)) doc["n"] = (int)n;
  if (readNpkRegister(0x001F, p)) doc["p"] = (int)p;
  if (readNpkRegister(0x0020, k)) doc["k"] = (int)k;
  addIfValid(doc, "temp", readSoilTemperature());
  doc["rain"] = readRain() ? 1 : 0;  // kondisi hujan saat data diambil

  char buf[320];
  serializeJson(doc, buf);
  mqtt.publish(topicSensor.c_str(), buf);
  Serial.printf("[sensor] %s\n", buf);
}

void publishStatus(const char* code, const String &topic) {
  JsonDocument doc;
  doc["code"]   = code;
  doc["status"] = "online";
  doc["ts"]     = epochNow();
  char buf[128];
  serializeJson(doc, buf);
  mqtt.publish(topic.c_str(), buf);
}

void sendAck(const char* requestId, const char* action, bool success) {
  JsonDocument doc;
  doc["code"]       = PUMP_CODE;
  doc["request_id"] = requestId ? requestId : "";
  doc["action"]     = action;
  doc["status"]     = success ? "success" : "failed";
  char buf[192];
  serializeJson(doc, buf);
  mqtt.publish(TOPIC_ACK, buf);          // WAJIB ≤ 10 detik setelah perintah
  Serial.printf("[ack] %s\n", buf);
}

/* Kendali pompa: channel water/fertilizer, speed 0–100 % → PWM 0–255 */
void setPump(const char* channel, bool on, int speedPct) {
  int pin  = (strcmp(channel, "fertilizer") == 0) ? PIN_PUMP_FERTILIZER : PIN_PUMP_WATER;
  int duty = on ? map(constrain(speedPct, 0, 100), 0, 100, 0, 255) : 0;
  ledcWrite(pin, duty);
  Serial.printf("[pump] %s %s duty=%d\n", channel, on ? "ON" : "OFF", duty);
}

void onMqttMessage(char* topic, byte* payload, unsigned int len) {
  JsonDocument cmd;
  if (deserializeJson(cmd, payload, len)) return;

  const char* action    = cmd["action"]      | "";
  const char* channel   = cmd["channel"]     | "water";
  const char* requestId = cmd["request_id"]  | "";
  const char* devCode   = cmd["device_code"] | "";
  int speed             = cmd["speed"]       | 0;

  // Abaikan perintah untuk pompa lain (bila multi-unit); kosong = broadcast
  if (strlen(devCode) > 0 && strcmp(devCode, PUMP_CODE) != 0) return;

  bool ok = true;
  if (strcmp(action, "EMERGENCY_STOP") == 0) {
    emergencyStop = true;
    setPump("water", false, 0);
    setPump("fertilizer", false, 0);
  } else if (strcmp(action, "RESUME") == 0) {
    emergencyStop = false;
    // RESUME menyalakan channel yang diminta sesuai speed
    if (speed > 0) setPump(channel, true, speed);
  } else if (strcmp(action, "START") == 0) {
    if (emergencyStop) ok = false;               // latch keselamatan
    else setPump(channel, true, speed > 0 ? speed : 100);
  } else if (strcmp(action, "STOP") == 0) {
    setPump(channel, false, 0);
  } else {
    ok = false;
  }

  sendAck(requestId, action, ok);
}

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("Menghubungkan MQTT... ");
    // LWT: bila ESP32 putus mendadak, broker mengumumkan offline
    JsonDocument lwt;
    lwt["code"] = SENSOR_CODE; lwt["status"] = "offline"; lwt["ts"] = epochNow();
    char lwtBuf[96]; serializeJson(lwt, lwtBuf);

    String clientId = String("hanjeli-esp32-") + SENSOR_CODE;
    if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS,
                     topicStatusSensor.c_str(), 1, true, lwtBuf)) {
      Serial.println("terhubung");
      mqtt.subscribe(TOPIC_COMMAND, 1);
      publishStatus(SENSOR_CODE, topicStatusSensor);
      publishStatus(PUMP_CODE, topicStatusPump);
    } else {
      Serial.printf("gagal rc=%d, coba lagi 3 dtk\n", mqtt.state());
      delay(3000);
    }
  }
}

/* ─────────────── SETUP & LOOP ─────────────── */

void setup() {
  Serial.begin(115200);

  pinMode(PIN_RS485_DE, OUTPUT);
  digitalWrite(PIN_RS485_DE, LOW);
  rs485.begin(9600, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);

  ledcAttach(PIN_PUMP_WATER, PWM_FREQ, PWM_RES);       // ESP32 core v3.x
  ledcAttach(PIN_PUMP_FERTILIZER, PWM_FREQ, PWM_RES);  // (core v2.x: ledcSetup+ledcAttachPin)
  setPump("water", false, 0);
  setPump("fertilizer", false, 0);

  topicSensor       = String("hanjeli/sensor/") + SENSOR_CODE;
  topicStatusSensor = String("hanjeli/device/") + SENSOR_CODE + "/status";
  topicStatusPump   = String("hanjeli/device/") + PUMP_CODE + "/status";

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menghubungkan WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf("\nWiFi OK, IP: %s\n", WiFi.localIP().toString().c_str());

  setupTime();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);
  mqtt.setCallback(onMqttMessage);
  connectMqtt();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(1000);
    return;
  }
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  unsigned long nowMs = millis();
  if (nowMs - lastSensorPublish >= SENSOR_INTERVAL_MS) {
    lastSensorPublish = nowMs;
    publishSensor();
  }
  if (nowMs - lastStatusPublish >= STATUS_INTERVAL_MS) {
    lastStatusPublish = nowMs;
    publishStatus(SENSOR_CODE, topicStatusSensor);
    publishStatus(PUMP_CODE, topicStatusPump);
  }
}
