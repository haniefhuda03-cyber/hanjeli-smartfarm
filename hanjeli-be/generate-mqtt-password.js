#!/usr/bin/env node
/**
 * Hanjeli SmartFarm — Mosquitto Password File Generator
 *
 * Generates a Mosquitto-compatible password file using
 * PBKDF2-SHA512 hash format (Mosquitto v2.x).
 *
 * Usage:
 *   node generate-mqtt-password.js <username> <password>
 *
 * Example:
 *   node generate-mqtt-password.js hanjeli_device hanjeli_mqtt_2026
 *
 * Output: password.txt file in docker/mosquitto/ directory
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ITERATIONS = 101;
const KEY_LENGTH = 64; // 512 bits
const SALT_LENGTH = 12;
const DIGEST = 'sha512';

function generateMosquittoHash(password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);

  // Mosquitto v2 format: $7$<iterations>$<salt_base64>$<key_base64>
  const iterHex = ITERATIONS.toString(16).padStart(2, '0');
  // Pack: $7$101$<salt_b64>$<key_b64>
  const saltB64 = salt.toString('base64');
  const keyB64 = key.toString('base64');

  return `$7$${ITERATIONS}$${saltB64}$${keyB64}`;
}

// ── Main ──
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node generate-mqtt-password.js <username> <password>');
  console.log('Example: node generate-mqtt-password.js hanjeli_device hanjeli_mqtt_2026');
  process.exit(1);
}

const username = args[0];
const password = args[1];

const hash = generateMosquittoHash(password);
const line = `${username}:${hash}`;

const outputDir = path.join(__dirname, 'docker', 'mosquitto');
const outputFile = path.join(outputDir, 'password.txt');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputFile, line + '\n', 'utf-8');

console.log(`✅ Password file generated: ${outputFile}`);
console.log(`   Username: ${username}`);
console.log(`   Hash format: Mosquitto PBKDF2-SHA512`);
console.log('');
console.log('⚠️  Catatan: Pastikan username & password yang sama');
console.log('   digunakan di .env (MQTT_USERNAME & MQTT_PASSWORD)');
console.log('   dan di kode firmware ESP32 Anda.');
