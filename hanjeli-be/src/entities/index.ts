/**
 * Hanjeli Smart Farm — Entity Barrel Export
 *
 * All TypeORM entities for the database schema.
 * 13 tables: 11 relational + 2 hypertables (TimescaleDB)
 *
 * BCNF-compliant: All tables verified 1NF → 2NF → 3NF → BCNF
 */

export { User } from './user.entity.js';
export { AuthToken } from './auth-token.entity.js';
export { RecoveryCode } from './recovery-code.entity.js';
export { UserPreference } from './user-preference.entity.js';
export { UserMeasurementUnit } from './user-measurement-unit.entity.js';
export { UserNotificationPref } from './user-notification-pref.entity.js';
export { UserSensorThreshold } from './user-sensor-threshold.entity.js';
export { Device } from './device.entity.js';
export { SensorTelemetry } from './sensor-telemetry.entity.js';
export { IrrigationConfig } from './irrigation-config.entity.js';
export { IrrigationSchedule } from './irrigation-schedule.entity.js';
export { IrrigationActivityLog } from './irrigation-activity-log.entity.js';
export { Notification } from './notification.entity.js';
