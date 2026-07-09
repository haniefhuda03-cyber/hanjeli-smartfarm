import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreferencesService } from './preferences.service.js';
import { PreferencesController } from './preferences.controller.js';
import { UserPreference } from '../../entities/user-preference.entity.js';
import { UserMeasurementUnit } from '../../entities/user-measurement-unit.entity.js';
import { UserNotificationPref } from '../../entities/user-notification-pref.entity.js';
import { UserSensorThreshold } from '../../entities/user-sensor-threshold.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserPreference,
      UserMeasurementUnit,
      UserNotificationPref,
      UserSensorThreshold,
    ]),
  ],
  controllers: [PreferencesController],
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
