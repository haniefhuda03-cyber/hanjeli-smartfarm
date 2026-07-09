import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WeatherService } from './weather.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CustomCacheInterceptor } from '../../common/interceptors/cache.interceptor.js';
import { CacheKey, CacheTtl } from '../../common/decorators/cache.decorator.js';

@Controller('weather')
@ApiTags('Weather')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CustomCacheInterceptor)
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('current')
  @CacheTtl(900)
  @CacheKey('weather:current')
  async getCurrentWeather() {
    return this.weatherService.getCurrentWeather();
  }
}
