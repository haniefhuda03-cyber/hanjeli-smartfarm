import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IrrigationSchedule } from '../../entities/irrigation-schedule.entity.js';
import { IrrigationConfig } from '../../entities/irrigation-config.entity.js';
import { MqttService } from '../mqtt/mqtt.service.js';
import { IrrigationActivityLog } from '../../entities/irrigation-activity-log.entity.js';

const JAKARTA_TZ = 'Asia/Jakarta';

function toJakartaParts(date: Date): {
  day: string;
  hours: string;
  minutes: string;
} {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: JAKARTA_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    formatted.find((p) => p.type === type)?.value ?? '';

  return {
    day: get('weekday').toLowerCase(),
    hours: get('hour').padStart(2, '0'),
    minutes: get('minute').padStart(2, '0'),
  };
}

const DAY_COLUMNS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayColumn = (typeof DAY_COLUMNS)[number];

@Injectable()
export class IrrigationCronService {
  private readonly logger = new Logger(IrrigationCronService.name);

  constructor(
    @InjectRepository(IrrigationSchedule)
    private readonly scheduleRepository: Repository<IrrigationSchedule>,
    @InjectRepository(IrrigationConfig)
    private readonly configRepository: Repository<IrrigationConfig>,
    @InjectRepository(IrrigationActivityLog)
    private readonly activityRepository: Repository<IrrigationActivityLog>,
    private readonly mqttService: MqttService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    this.logger.log('Executing Scheduled Irrigation check...');

    const { day, hours, minutes } = toJakartaParts(new Date());
    const currentDay = day as DayColumn;
    const currentTimeStr = `${hours}:${minutes}:00`;

    if (!DAY_COLUMNS.includes(currentDay)) return;

    try {
      const query = `
        SELECT DISTINCT ON (s.id)
          s.id, s.name, s.user_id, s.start_time, s.end_time,
          c.active_mode, c.manual_speed,
          d.code AS device_code
        FROM irrigation_schedules s
        JOIN irrigation_configs c ON c.user_id = s.user_id
        JOIN devices d ON d.user_id = s.user_id
          AND d.type = 'pump'
        WHERE s.active = true
          AND s."${currentDay}" = true
          AND c.active_mode = 'scheduled'
      `;

      const schedules = await this.scheduleRepository.manager.query(query);

      for (const schedule of schedules) {
        const schedStart = schedule.start_time.substring(0, 5) + ':00';
        const schedEnd = schedule.end_time.substring(0, 5) + ':00';

        let action: 'START' | 'STOP' | null = null;
        let reason = '';

        if (currentTimeStr === schedStart) {
          action = 'START';
          reason = `Memulai jadwal irigasi: ${schedule.name}`;
        } else if (currentTimeStr === schedEnd) {
          action = 'STOP';
          reason = `Mengakhiri jadwal irigasi: ${schedule.name}`;
        }

        if (!action) continue;

        this.logger.log(
          `Schedule Match: ${schedule.name} - Action: ${action} for device ${schedule.device_code}`,
        );

        await this.mqttService.publishIrrigationCommand(
          {
            action,
            mode: 'scheduled',
            channel: 'water',
            speed: action === 'START' ? (schedule.manual_speed ?? 100) : 0,
            device_code: schedule.device_code,
            user_id: schedule.user_id,
          },
          {
            onTimeout: async (requestId) => {
              await this.logActivity(
                schedule.user_id,
                `ESP32 belum mengirim ACK untuk jadwal irigasi "${schedule.name}" (${requestId}).`,
                'warning',
              );
            },
          },
        );

        await this.logActivity(
          schedule.user_id,
          reason,
          action === 'START' ? 'info' : 'success',
        );
      }
    } catch (error: any) {
      this.logger.error(`Error in Irrigation Cron: ${error.message}`);
    }
  }

  private async logActivity(
    userId: string,
    description: string,
    type: 'success' | 'info' | 'warning',
  ): Promise<void> {
    const log = this.activityRepository.create({
      user_id: userId,
      description,
      type,
    });
    await this.activityRepository.save(log);
  }
}
