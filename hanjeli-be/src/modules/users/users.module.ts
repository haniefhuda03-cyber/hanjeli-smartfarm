import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { User } from '../../entities/user.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { WebsocketModule } from '../websocket/websocket.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AuthModule,
    forwardRef(() => WebsocketModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
