import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WeatherService } from './weather.service.js';
import { WeatherController } from './weather.controller.js';

@Module({
  imports: [ConfigModule],
  controllers: [WeatherController],
  providers: [WeatherService],
  exports: [WeatherService],
})
export class WeatherModule {}
