import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrrigationService } from './irrigation.service.js';
import { IrrigationController } from './irrigation.controller.js';
import { IrrigationEngine } from './irrigation.engine.js';
import { MqttModule } from '../mqtt/mqtt.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { IrrigationConfig } from '../../entities/irrigation-config.entity.js';
import { IrrigationSchedule } from '../../entities/irrigation-schedule.entity.js';
import { IrrigationActivityLog } from '../../entities/irrigation-activity-log.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IrrigationConfig,
      IrrigationSchedule,
      IrrigationActivityLog,
    ]),
    forwardRef(() => MqttModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [IrrigationController],
  providers: [IrrigationService, IrrigationEngine],
  exports: [IrrigationService, IrrigationEngine],
})
export class IrrigationModule {}
