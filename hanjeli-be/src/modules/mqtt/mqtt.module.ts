import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MqttService } from './mqtt.service.js';
import { MqttSensorHandler } from './mqtt-sensor.handler.js';
import { MqttIrrigationHandler } from './mqtt-irrigation.handler.js';
import { IrrigationModule } from '../irrigation/irrigation.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { WebsocketModule } from '../websocket/websocket.module.js';
import { SensorTelemetry } from '../../entities/sensor-telemetry.entity.js';
import { Device } from '../../entities/device.entity.js';
import { IrrigationActivityLog } from '../../entities/irrigation-activity-log.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SensorTelemetry, Device, IrrigationActivityLog]),
    forwardRef(() => IrrigationModule),
    forwardRef(() => WebsocketModule),
    forwardRef(() => NotificationsModule),
  ],
  providers: [MqttService, MqttSensorHandler, MqttIrrigationHandler],
  exports: [MqttService],
})
export class MqttModule {}
