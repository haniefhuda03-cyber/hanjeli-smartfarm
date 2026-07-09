import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  CacheInvalidate,
  CacheKey,
  CacheTtl,
} from '../../common/decorators/cache.decorator.js';
import { UsersService, type UploadedImage } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { SendEmailTokenDto } from './dto/send-email-token.dto.js';
import { VerifyEmailTokenDto } from './dto/verify-email-token.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CustomCacheInterceptor } from '../../common/interceptors/cache.interceptor.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface.js';

@Controller('users')
@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CustomCacheInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Profile Routes ───
  @Get('me')
  @CacheTtl(300)
  @CacheKey('user:profile:{userId}')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(user.id);
  }

  @Put('me')
  @CacheInvalidate('user:profile:{userId}', 'users:list:*')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('me/email-token')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  sendEmailToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendEmailTokenDto,
  ) {
    return this.usersService.sendEmailChangeToken(user.id, dto.newEmail);
  }

  @Post('me/verify-email-token')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  verifyEmailToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyEmailTokenDto,
  ) {
    return this.usersService.verifyEmailChangeToken(user.id, dto.newEmail, dto.token);
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @CacheInvalidate('user:profile:{userId}', 'users:list:*')
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedImage,
  ) {
    return this.usersService.updateAvatar(user.id, file);
  }

  @Delete('me')
  @CacheInvalidate('user:profile:{userId}', 'users:list:*')
  removeProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.usersService.removeSelf(user.id, dto);
  }

  // ─── Admin Routes ───
  @Get()
  @Roles('Admin')
  @CacheTtl(120)
  @CacheKey('users:list:{hash}')
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Post()
  @Roles('Admin')
  @CacheInvalidate('users:list:*')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @Roles('Admin')
  @CacheInvalidate('users:list:*', 'user:profile:*')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('Admin')
  @CacheInvalidate('users:list:*', 'user:profile:*')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.remove(id, user.id);
  }

  @Post(':id/disable-2fa')
  @Roles('Admin')
  @CacheInvalidate('users:list:*', 'user:profile:*')
  disable2FA(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.disableUser2FA(id, user.id);
  }
}
