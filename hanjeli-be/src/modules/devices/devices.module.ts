import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesService } from './devices.service.js';
import { DevicesController } from './devices.controller.js';
import { Device } from '../../entities/device.entity.js';
import { SensorTelemetry } from '../../entities/sensor-telemetry.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Device, SensorTelemetry])],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
