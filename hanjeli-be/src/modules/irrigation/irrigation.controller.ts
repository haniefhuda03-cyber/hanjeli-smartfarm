import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CacheInvalidate,
  CacheKey,
  CacheTtl,
} from '../../common/decorators/cache.decorator.js';
import { IrrigationService } from './irrigation.service.js';
import {
  UpdateIrrigationConfigDto,
  CreateIrrigationScheduleDto,
  UpdateIrrigationScheduleDto,
  IrrigationActivityQueryDto,
} from './dto/irrigation.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CustomCacheInterceptor } from '../../common/interceptors/cache.interceptor.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface.js';

@Controller('irrigation')
@ApiTags('Irrigation')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CustomCacheInterceptor)
export class IrrigationController {
  constructor(private readonly irrigationService: IrrigationService) {}

  // --- Config ---

  @Get('config')
  @CacheTtl(10)
  @CacheKey('irrigation:config:{userId}')
  getConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.irrigationService.getConfig(user.id);
  }

  @Put('config')
  @CacheInvalidate('irrigation:config:{userId}')
  updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateIrrigationConfigDto,
  ) {
    return this.irrigationService.updateConfig(user.id, dto);
  }

  // --- Schedules ---

  @Get('schedules')
  @CacheTtl(60)
  @CacheKey('irrigation:schedules:{userId}')
  getSchedules(@CurrentUser() user: AuthenticatedUser) {
    return this.irrigationService.getSchedules(user.id);
  }

  @Post('schedules')
  @CacheInvalidate('irrigation:schedules:{userId}')
  createSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateIrrigationScheduleDto,
  ) {
    return this.irrigationService.createSchedule(user.id, dto);
  }

  @Put('schedules/:id')
  @CacheInvalidate('irrigation:schedules:{userId}')
  updateSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIrrigationScheduleDto,
  ) {
    return this.irrigationService.updateSchedule(user.id, id, dto);
  }

  @Delete('schedules/:id')
  @CacheInvalidate('irrigation:schedules:{userId}')
  deleteSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.irrigationService.deleteSchedule(user.id, id);
  }

  // --- Activity Logs ---

  @Get('activity')
  @CacheTtl(30)
  @CacheKey('irrigation:activity:{userId}:{hash}')
  getActivityLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: IrrigationActivityQueryDto,
  ) {
    return this.irrigationService.getActivityLogs(user.id, query);
  }
}
