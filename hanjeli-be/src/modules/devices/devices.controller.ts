import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CacheInvalidate,
  CacheKey,
  CacheTtl,
} from '../../common/decorators/cache.decorator.js';
import { DevicesService } from './devices.service.js';
import { CreateDeviceDto } from './dto/create-device.dto.js';
import { UpdateDeviceDto } from './dto/update-device.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CustomCacheInterceptor } from '../../common/interceptors/cache.interceptor.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface.js';

@Controller('devices')
@ApiTags('Devices')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CustomCacheInterceptor)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @CacheTtl(60)
  @CacheKey('devices:{userId}')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.findAll(user.id);
  }

  @Get(':id')
  @CacheTtl(60)
  @CacheKey('devices:{userId}:{hash}')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.devicesService.findOne(user.id, id);
  }

  @Post()
  @CacheInvalidate('devices:{userId}', 'devices:{userId}:*')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDeviceDto) {
    return this.devicesService.create(user.id, dto);
  }

  @Put(':id')
  @CacheInvalidate('devices:{userId}', 'devices:{userId}:*')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.devicesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @CacheInvalidate('devices:{userId}', 'devices:{userId}:*')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.devicesService.remove(user.id, id);
  }
}
