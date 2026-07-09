import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorsService } from './sensors.service.js';
import { SensorsController } from './sensors.controller.js';
import { SensorTelemetry } from '../../entities/sensor-telemetry.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([SensorTelemetry])],
  controllers: [SensorsController],
  providers: [SensorsService],
  exports: [SensorsService],
})
export class SensorsModule {}
