/**
 * Development data seeder — ORM-based, idempotent.
 *
 * Seeds sample data for local development/testing:
 * - 4 devices (sensor, pump, camera)
 * - 10 telemetry records (realistic random sensor values)
 * - 2 irrigation schedules
 * - 3 notifications
 *
 * ONLY runs when NODE_ENV !== 'production'.
 * All data is tied to the first admin user found in the database.
 */
import type { DataSource, EntityManager } from 'typeorm';
import { User } from '../../entities/user.entity.js';
import { Device } from '../../entities/device.entity.js';
import { SensorTelemetry } from '../../entities/sensor-telemetry.entity.js';
import { IrrigationSchedule } from '../../entities/irrigation-schedule.entity.js';
import { Notification } from '../../entities/notification.entity.js';
import type { Seeder, SeederResult } from './seeder.interface.js';

/** Device definitions for development */
const DEV_DEVICES: Array<{
  name: string;
  code: string;
  type: string;
  status: string;
}> = [
  {
    name: 'Main Irrigation Pump',
    code: 'PMP01',
    type: 'pump',
    status: 'online',
  },
  {
    name: 'JLNew H10: Soil Moisture Sensor',
    code: 'WS004',
    type: 'sensor',
    status: 'online',
  },
  {
    name: 'ACE Temperature Sensor',
    code: 'TH011',
    type: 'sensor',
    status: 'warning',
  },
  { name: 'Field Camera A', code: 'CAM01', type: 'camera', status: 'offline' },
];

/** Schedule definitions for development */
const DEV_SCHEDULES: Array<{
  name: string;
  days: {
    mon: boolean;
    tue: boolean;
    wed: boolean;
    thu: boolean;
    fri: boolean;
    sat: boolean;
    sun: boolean;
  };
  start_time: string;
  end_time: string;
}> = [
  {
    name: 'Penyiraman Pagi',
    days: {
      mon: true,
      tue: false,
      wed: true,
      thu: false,
      fri: true,
      sat: false,
      sun: false,
    },
    start_time: '06:00',
    end_time: '06:30',
  },
  {
    name: 'Penyiraman Sore',
    days: {
      mon: false,
      tue: true,
      wed: false,
      thu: true,
      fri: false,
      sat: true,
      sun: false,
    },
    start_time: '17:00',
    end_time: '17:30',
  },
];

/** Notification definitions for development */
const DEV_NOTIFICATIONS: Array<{
  title: string;
  description: string;
  type: string;
  category: string;
}> = [
  {
    title: 'Sensor TH011 Warning',
    description: 'Signal issue detected since 08:02 AM',
    type: 'warning',
    category: 'device',
  },
  {
    title: 'Penyiraman Pagi Selesai',
    description: 'Penyiraman otomatis berhasil dilakukan',
    type: 'success',
    category: 'irrigation',
  },
  {
    title: 'Kelembaban Tanah Rendah',
    description: 'Kelembaban tanah turun di bawah 40%',
    type: 'warning',
    category: 'soil',
  },
];

export class DevDataSeeder implements Seeder {
  readonly name = 'DevDataSeeder';

  async run(dataSource: DataSource): Promise<SeederResult[]> {
    /* Skip in production */
    if (process.env.NODE_ENV === 'production') {
      return [{ message: 'Skipped — NODE_ENV=production', changed: false }];
    }

    const results: SeederResult[] = [];

    await dataSource.transaction(async (manager) => {
      /* Find the first admin user to attach dev data to */
      const adminUser = await manager.getRepository(User).findOne({
        where: { role: 'Admin' },
        order: { created_at: 'ASC' },
      });

      if (!adminUser) {
        results.push({
          message: 'Skipped — no admin user found (run admin seeder first)',
          changed: false,
        });
        return;
      }

      const userId = adminUser.id;

      /* ── Seed devices ── */
      const deviceResults = await this.seedDevices(manager, userId);
      results.push(...deviceResults);

      /* ── Seed telemetry ── */
      const telemetryResults = await this.seedTelemetry(manager, userId);
      results.push(...telemetryResults);

      /* ── Seed schedules ── */
      const scheduleResults = await this.seedSchedules(manager, userId);
      results.push(...scheduleResults);

      /* ── Seed notifications ── */
      const notifResults = await this.seedNotifications(manager, userId);
      results.push(...notifResults);
    });

    return results;
  }

  /* ────────────────────────────────────────────── */
  /*  Private seeder methods (all ORM + idempotent) */
  /* ────────────────────────────────────────────── */

  private async seedDevices(
    manager: EntityManager,
    userId: string,
  ): Promise<SeederResult[]> {
    const repo = manager.getRepository(Device);
    let insertedCount = 0;

    for (const def of DEV_DEVICES) {
      const existing = await repo.findOne({ where: { code: def.code } });

      if (!existing) {
        const device = repo.create({
          user_id: userId,
          name: def.name,
          code: def.code,
          type: def.type,
          status: def.status,
          last_seen_at: new Date(),
        });
        await repo.save(device);
        insertedCount++;
      }
    }

    return [
      {
        message:
          insertedCount > 0
            ? `${insertedCount} devices seeded`
            : 'Devices already exist',
        changed: insertedCount > 0,
      },
    ];
  }

  private async seedTelemetry(
    manager: EntityManager,
    userId: string,
  ): Promise<SeederResult[]> {
    /*
     * Find the WS004 sensor device to attach telemetry to.
     * If it doesn't exist, skip.
     */
    const deviceRepo = manager.getRepository(Device);
    const sensorDevice = await deviceRepo.findOne({
      where: { code: 'WS004', user_id: userId },
    });

    if (!sensorDevice) {
      return [
        {
          message: 'Skipped telemetry — sensor device WS004 not found',
          changed: false,
        },
      ];
    }

    /* Check if telemetry already exists for this device */
    const telemetryRepo = manager.getRepository(SensorTelemetry);
    const existingCount = await telemetryRepo.count({
      where: { device_id: sensorDevice.id },
    });

    if (existingCount > 0) {
      return [
        {
          message: `Telemetry already exists (${existingCount} records)`,
          changed: false,
        },
      ];
    }

    /* Generate 10 realistic telemetry records */
    const records: SensorTelemetry[] = [];
    const now = Date.now();

    for (let i = 0; i < 10; i++) {
      const nitrogen = Math.round(35 + Math.random() * 20);
      const phosphorus = Math.round(18 + Math.random() * 12);
      const potassium = Math.round(28 + Math.random() * 18);

      const capturedAt = new Date(now - i * 3600_000); /* 1 hour apart */
      const record = telemetryRepo.create({
        device_id: sensorDevice.id,
        captured_at: capturedAt,
        sent_at: capturedAt,
        ph_level: Number((6.5 + Math.random() * 0.8).toFixed(1)),
        soil_moisture: Number((55 + Math.random() * 20).toFixed(1)),
        soil_nitrogen: nitrogen,
        soil_phosphorus: phosphorus,
        soil_potassium: potassium,
        soil_temperature: Number((20 + Math.random() * 8).toFixed(1)),
        is_raining: Math.random() < 0.3,
      });
      records.push(record);
    }

    await telemetryRepo.save(records);

    return [{ message: '10 telemetry records seeded', changed: true }];
  }

  private async seedSchedules(
    manager: EntityManager,
    userId: string,
  ): Promise<SeederResult[]> {
    const repo = manager.getRepository(IrrigationSchedule);
    let insertedCount = 0;

    for (const def of DEV_SCHEDULES) {
      const existing = await repo.findOne({
        where: { user_id: userId, name: def.name },
      });

      if (!existing) {
        const schedule = repo.create({
          user_id: userId,
          name: def.name,
          ...def.days,
          start_time: def.start_time,
          end_time: def.end_time,
          active: true,
        });
        await repo.save(schedule);
        insertedCount++;
      }
    }

    return [
      {
        message:
          insertedCount > 0
            ? `${insertedCount} schedules seeded`
            : 'Schedules already exist',
        changed: insertedCount > 0,
      },
    ];
  }

  private async seedNotifications(
    manager: EntityManager,
    userId: string,
  ): Promise<SeederResult[]> {
    const repo = manager.getRepository(Notification);

    /* Check if dev notifications already exist by checking first one */
    const existing = await repo.findOne({
      where: { user_id: userId, title: DEV_NOTIFICATIONS[0].title },
    });

    if (existing) {
      return [{ message: 'Notifications already exist', changed: false }];
    }

    const records: Notification[] = [];

    for (const def of DEV_NOTIFICATIONS) {
      const notif = repo.create({
        user_id: userId,
        title: def.title,
        description: def.description,
        type: def.type,
        category: def.category,
        read: false,
      });
      records.push(notif);
    }

    await repo.save(records);

    return [
      { message: `${records.length} notifications seeded`, changed: true },
    ];
  }
}
