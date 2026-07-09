/**
 * Notification type definitions.
 *
 * `NotificationCategory` dipakai oleh NotificationContext untuk memilih
 * ikon SVG toast yang sesuai — nilai harus selaras dengan CHECK constraint
 * `chk_notification_category` di backend.
 */

export type NotificationCategory =
  | 'temperature'
  | 'humidity'
  | 'irrigation'
  | 'soil'
  | 'wind'
  | 'ph'
  | 'uv'
  | 'device'
  | 'security'
  | 'auth'
  | 'profile'
  | 'system'
  | 'general'
