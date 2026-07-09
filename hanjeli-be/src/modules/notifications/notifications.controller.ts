import {
  Controller,
  Get,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CacheInvalidate,
  CacheKey,
  CacheTtl,
} from '../../common/decorators/cache.decorator.js';
import { NotificationsService } from './notifications.service.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CustomCacheInterceptor } from '../../common/interceptors/cache.interceptor.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface.js';

@Controller('notifications')
@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CustomCacheInterceptor)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @CacheTtl(30)
  @CacheKey('notifications:{userId}:{hash}')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.findAll(user.id, query);
  }

  @Patch('read-all')
  @CacheInvalidate('notifications:{userId}:*')
  markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  @CacheInvalidate('notifications:{userId}:*')
  markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Delete()
  @CacheInvalidate('notifications:{userId}:*')
  removeAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.removeAll(user.id);
  }

  @Delete(':id')
  @CacheInvalidate('notifications:{userId}:*')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.remove(user.id, id);
  }
}
