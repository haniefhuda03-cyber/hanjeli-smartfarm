import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthToken } from '../../entities/auth-token.entity.js';
import { RecoveryCode } from '../../entities/recovery-code.entity.js';
import { User } from '../../entities/user.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthEmailService } from './auth-email.service.js';
import { AuthService } from './auth.service.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { WebsocketModule } from '../websocket/websocket.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RecoveryCode, AuthToken]),
    PassportModule,
    JwtModule.register({}),
    forwardRef(() => WebsocketModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthEmailService, JwtStrategy, GoogleStrategy],
  exports: [AuthService, AuthEmailService, JwtModule],
})
export class AuthModule {}
