import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { ThresholdAlertService } from './threshold-alert.service.js';
import { Notification } from '../../entities/notification.entity.js';
import { User } from '../../entities/user.entity.js';
import { UserNotificationPref } from '../../entities/user-notification-pref.entity.js';
import { UserSensorThreshold } from '../../entities/user-sensor-threshold.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { WebsocketModule } from '../websocket/websocket.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      User,
      UserNotificationPref,
      UserSensorThreshold,
    ]),
    forwardRef(() => WebsocketModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, ThresholdAlertService],
  exports: [NotificationsService, ThresholdAlertService],
})
export class NotificationsModule {}
