import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SensorsService } from './sensors.service.js';
import {
  SensorTrendQueryDto,
  SensorHistoryQueryDto,
  SensorExportQueryDto,
} from './dto/sensor-query.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface.js';
import { CustomCacheInterceptor } from '../../common/interceptors/cache.interceptor.js';
import { CacheKey, CacheTtl } from '../../common/decorators/cache.decorator.js';

@Controller('sensors')
@ApiTags('Sensors')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CustomCacheInterceptor)
export class SensorsController {
  constructor(private readonly sensorsService: SensorsService) {}

  @Get('latest')
  @CacheTtl(10)
  @CacheKey('sensor:latest:{userId}')
  getLatest(@CurrentUser() user: AuthenticatedUser) {
    return this.sensorsService.getLatest(user.id);
  }

  @Get('overview')
  @CacheTtl(10)
  @CacheKey('sensor:overview:{userId}')
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.sensorsService.getOverview(user.id);
  }

  @Get('quality-score')
  @CacheTtl(30)
  @CacheKey('sensor:quality:{userId}')
  getQualityScore(@CurrentUser() user: AuthenticatedUser) {
    return this.sensorsService.getQualityScore(user.id);
  }

  @Get('trend')
  @CacheTtl(60)
  @CacheKey('sensor:trend:{userId}:{hash}')
  getTrend(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SensorTrendQueryDto,
  ) {
    return this.sensorsService.getTrend(user.id, query);
  }

  @Get('stats')
  @CacheTtl(60)
  @CacheKey('sensor:stats:{userId}:{hash}')
  getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SensorTrendQueryDto,
  ) {
    return this.sensorsService.getStats(user.id, query);
  }

  @Get('history')
  @CacheTtl(30)
  @CacheKey('sensor:history:{userId}:{hash}')
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SensorHistoryQueryDto,
  ) {
    return this.sensorsService.getHistory(user.id, query);
  }

  @Get('export')
  async exportHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SensorExportQueryDto,
    @Res() res: Response,
  ) {
    const stream = await this.sensorsService.getExportStream(user.id, query);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=sensor_history.csv',
    );
    stream.pipe(res);
  }
}
