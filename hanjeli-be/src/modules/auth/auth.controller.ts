import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface.js';
import { AuthService } from './auth.service.js';
import type { GoogleAuthProfile, LoginResponse } from './auth.types.js';
import { EnableTotpDto } from './dto/enable-totp.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { VerifyRecoveryDto } from './dto/verify-recovery.dto.js';
import { VerifyTotpDto } from './dto/verify-totp.dto.js';
import { ExchangeOauthDto } from './dto/exchange-oauth.dto.js';
import { SensorGateway } from '../websocket/sensor.gateway.js';

type GoogleRequest = Request & {
  user: GoogleAuthProfile;
};

@Controller('auth')
@ApiTags('Auth')
@ApiBearerAuth('access-token')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => SensorGateway))
    private readonly sensorGateway: SensorGateway,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  setupTwoFactor(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setupTwoFactor(user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  enableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnableTotpDto,
  ) {
    return this.authService.enableTwoFactor(user.id, dto.token);
  }

  @Post('verify-2fa')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  verifyTwoFactor(@Body() dto: VerifyTotpDto) {
    return this.authService.verifyTwoFactor(dto);
  }

  @Post('verify-recovery')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  verifyRecovery(@Body() dto: VerifyRecoveryDto) {
    return this.authService.verifyRecoveryCode(dto);
  }

  @Delete('2fa')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  disableTwoFactor(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.disableTwoFactor(user.id);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.authService.logout(user.id);
    /* Socket yang sudah terhubung tidak mengecek ulang token — putuskan
       eksplisit agar realtime berhenti begitu sesi berakhir. */
    this.sensorGateway.disconnectUser(user.id);
    return result;
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    return { message: 'Redirecting to Google OAuth' };
  }

  @Post('exchange-oauth')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  exchangeOAuth(@Body() dto: ExchangeOauthDto) {
    return this.authService.exchangeOAuthToken(dto.exchange_code);
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() request: GoogleRequest,
    @Res() response: Response,
  ) {
    const result = await this.authService.handleGoogleLogin(request.user);
    const url = new URL(this.getFrontendCallbackUrl());

    /* Kode ditaruh di URL fragment (#…), BUKAN query string: fragment tidak
       pernah dikirim ke server mana pun (log, proxy, header Referer) dan
       langsung dihapus frontend dari address bar via history.replaceState. */
    url.hash = new URLSearchParams({
      type: 'oauth',
      exchange_code: result.exchange_code,
    }).toString();

    return response.redirect(url.toString());
  }

  private getFrontendCallbackUrl(): string {
    return (
      this.config.get<string>('FRONTEND_AUTH_CALLBACK_URL') ??
      'http://localhost:3001/auth/callback'
    );
  }
}
