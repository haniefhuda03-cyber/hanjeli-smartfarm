import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrrigationCronService } from './irrigation.cron.js';
import { IrrigationSchedule } from '../../entities/irrigation-schedule.entity.js';
import { IrrigationConfig } from '../../entities/irrigation-config.entity.js';
import { IrrigationActivityLog } from '../../entities/irrigation-activity-log.entity.js';
import { MqttModule } from '../mqtt/mqtt.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      IrrigationSchedule,
      IrrigationConfig,
      IrrigationActivityLog,
    ]),
    MqttModule,
  ],
  providers: [IrrigationCronService],
})
export class CronModule {}
