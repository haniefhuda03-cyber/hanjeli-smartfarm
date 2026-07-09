import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { dataSourceOptions } from './config/data-source.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { DevicesModule } from './modules/devices/devices.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PreferencesModule } from './modules/preferences/preferences.module.js';
import { SensorsModule } from './modules/sensors/sensors.module.js';
import { WeatherModule } from './modules/weather/weather.module.js';
import { IrrigationModule } from './modules/irrigation/irrigation.module.js';
import { MqttModule } from './modules/mqtt/mqtt.module.js';
import { WebsocketModule } from './modules/websocket/websocket.module.js';
import { CronModule } from './modules/cron/cron.module.js';
import { AppCacheModule } from './common/cache/app-cache.module.js';

@Module({
  imports: [
    /* Load .env file */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AppCacheModule,

    /* TypeORM — menggunakan dataSourceOptions yang sama dengan CLI */
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: true,
      retryAttempts: 100, // Mencoba koneksi ulang hingga 100 kali sebelum crash
      retryDelay: 3000, // Jeda waktu 3 detik per percobaan
    }),

    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
      errorMessage: 'Terlalu banyak percobaan. Silakan coba lagi nanti.',
    }),

    AuthModule,
    UsersModule,
    DevicesModule,
    NotificationsModule,
    PreferencesModule,
    SensorsModule,
    WeatherModule,
    IrrigationModule,
    MqttModule,
    WebsocketModule,
    CronModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
