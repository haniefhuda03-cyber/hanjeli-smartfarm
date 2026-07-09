import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CacheInvalidate,
  CacheKey,
  CacheTtl,
} from '../../common/decorators/cache.decorator.js';
import { PreferencesService } from './preferences.service.js';
import { UpdatePreferenceDto } from './dto/update-preference.dto.js';
import { UpdateUnitDto } from './dto/update-unit.dto.js';
import { UpdateNotificationPrefDto } from './dto/update-notification-pref.dto.js';
import { UpdateSensorThresholdDto } from './dto/update-sensor-threshold.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CustomCacheInterceptor } from '../../common/interceptors/cache.interceptor.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface.js';

@Controller('preferences')
@ApiTags('Preferences')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CustomCacheInterceptor)
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  @CacheTtl(300)
  @CacheKey('preferences:{userId}')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.preferencesService.findAll(user.id);
  }

  @Put()
  @CacheInvalidate('preferences:{userId}')
  updatePreference(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.preferencesService.updatePreference(user.id, dto);
  }

  @Put('units')
  @CacheInvalidate('preferences:{userId}')
  updateUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.preferencesService.updateUnit(user.id, dto);
  }

  @Put('notification-prefs')
  @CacheInvalidate('preferences:{userId}')
  updateNotificationPref(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPrefDto,
  ) {
    return this.preferencesService.updateNotificationPref(user.id, dto);
  }

  @Put('sensor-thresholds')
  @CacheInvalidate('preferences:{userId}')
  updateSensorThreshold(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSensorThresholdDto,
  ) {
    return this.preferencesService.updateSensorThreshold(user.id, dto);
  }
}
