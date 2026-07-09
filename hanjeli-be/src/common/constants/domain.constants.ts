export const USER_ROLES = ['Admin', 'Guest'] as const;
export const DEVICE_TYPES = ['sensor', 'pump', 'camera'] as const;
export const DEVICE_STATUSES = ['online', 'warning', 'offline'] as const;
export const NOTIFICATION_TYPES = [
  'info',
  'success',
  'warning',
  'error',
] as const;
export const NOTIFICATION_CATEGORIES = [
  'temperature',
  'irrigation',
  'soil',
  'wind',
  'ph',
  'uv',
  'device',
  'security',
  'auth',
  'profile',
  'system',
  'general',
] as const;
export const NOTIFICATION_PREF_CATEGORIES = [
  'irrigation',
  'sensor',
  'system',
] as const;
export const NOTIFICATION_CHANNELS = ['push', 'email'] as const;
export const SENSOR_PARAMETER_KEYS = [
  'soil_temperature',
  'soil_moisture',
  'ph',
  'soil_nitrogen',
  'soil_phosphorus',
  'soil_potassium',
] as const;
export const THRESHOLD_PARAMETER_KEYS = [
  'soil_temperature',
  'soil_moisture',
  'ph',
  'soil_nitrogen',
  'soil_phosphorus',
  'soil_potassium',
] as const;

/*
 * Hanya unit yang benar-benar bisa dikonversi dari nilai kanonik sensor
 * (°C, %, pH, mg/kg). Konversi tampilan dilakukan frontend:
 * °C→°F dan mg/kg→ppm (1:1). 'soil_npk' = grup unit bersama untuk N/P/K.
 */
export const MEASUREMENT_UNIT_OPTIONS: Record<string, readonly string[]> = {
  soil_temperature: ['°C', '°F'],
  soil_moisture: ['%'],
  ph: ['pH'],
  soil_npk: ['mg/kg', 'ppm'],
};

export type DeviceType = (typeof DEVICE_TYPES)[number];
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationPrefCategory =
  (typeof NOTIFICATION_PREF_CATEGORIES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type SensorParameterKey = (typeof SENSOR_PARAMETER_KEYS)[number];
export type ThresholdParameterKey = (typeof THRESHOLD_PARAMETER_KEYS)[number];
