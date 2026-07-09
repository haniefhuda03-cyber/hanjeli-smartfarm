import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHmac, randomBytes } from 'node:crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import { DataSource, Repository } from 'typeorm';
import {
  AuthenticatedUser,
  UserRole,
} from '../../common/types/authenticated-user.interface.js';
import {
  AuthToken,
  AuthTokenPurpose,
} from '../../entities/auth-token.entity.js';
import { RecoveryCode } from '../../entities/recovery-code.entity.js';
import { User } from '../../entities/user.entity.js';
import {
  getAuthExpiry,
  getAuthSecret,
  parseDurationToSeconds,
} from './auth.config.js';
import { AuthEmailService } from './auth-email.service.js';
import {
  AuthTokenPayload,
  AuthTokensResponse,
  GoogleAuthProfile,
  LoginResponse,
  TwoFactorChallengeResponse,
} from './auth.types.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { VerifyRecoveryDto } from './dto/verify-recovery.dto.js';
import { VerifyTotpDto } from './dto/verify-totp.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(RecoveryCode)
    private readonly recoveryCodesRepository: Repository<RecoveryCode>,
    @InjectRepository(AuthToken)
    private readonly authTokensRepository: Repository<AuthToken>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: AuthEmailService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ message: string; user: AuthenticatedUser }> {
    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email sudah digunakan');
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.getBcryptRounds(),
    );
    const user = await this.usersRepository.save(
      this.usersRepository.create({
        name: dto.name.trim(),
        email,
        password_hash: passwordHash,
        password_updated_at: new Date(),
        role: 'Guest',
        email_verified: false,
      }),
    );
    const token = await this.createAuthToken(
      user,
      'email_verification',
      getAuthExpiry(this.config, 'AUTH_EMAIL_TOKEN_EXPIRES_IN', '24h'),
    );

    await this.emailService.sendVerificationEmail(user.email, user.name, token);

    return {
      message: 'Registrasi berhasil. Silakan cek email untuk verifikasi akun.',
      user: this.toAuthenticatedUser(user),
    };
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Email atau password salah');
    }

    if (!user.email_verified) {
      throw new UnauthorizedException('Email belum diverifikasi');
    }

    if (user.two_factor_enabled) {
      return this.issueTwoFactorChallenge(user);
    }

    return this.issueAuthTokens(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokensResponse> {
    const payload = await this.verifyToken(
      dto.refresh_token,
      'JWT_REFRESH_SECRET',
    );

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token tidak valid');
    }

    const user = await this.findActiveUserById(payload.sub);
    this.assertSessionEpoch(payload, user);

    /* Rotasi: refresh token sekali-pakai. Token legacy tanpa jti (diterbitkan
       sebelum rotasi ada) diizinkan sekali lalu digantikan pasangan ber-jti. */
    if (payload.jti) {
      await this.consumeRefreshTokenRecord(user.id, payload.jti);
    }

    return this.issueAuthTokens(user);
  }

  async setupTwoFactor(userId: string): Promise<{
    secret: string;
    otpauth_uri: string;
  }> {
    const user = await this.findActiveUserById(userId);

    if (user.two_factor_enabled) {
      throw new BadRequestException('2FA sudah aktif');
    }

    const secret = generateSecret();
    const encryptedSecret = await this.encryptTotpSecret(secret);
    user.two_factor_secret = encryptedSecret;
    await this.usersRepository.save(user);

    return {
      secret,
      otpauth_uri: generateURI({
        issuer: 'Hanjeli SmartFarm',
        label: user.email,
        secret,
      }),
    };
  }

  async enableTwoFactor(
    userId: string,
    token: string,
  ): Promise<{ message: string; recovery_codes: string[] }> {
    const user = await this.findActiveUserById(userId);

    if (user.two_factor_enabled) {
      throw new BadRequestException('2FA sudah aktif');
    }

    const secret = await this.decryptUserTotpSecret(user);
    await this.assertValidTotp(token, secret);

    user.two_factor_enabled = true;
    await this.usersRepository.save(user);
    const recoveryCodes = await this.replaceRecoveryCodes(user.id);

    return {
      message: '2FA berhasil diaktifkan',
      recovery_codes: recoveryCodes,
    };
  }

  async disableTwoFactor(userId: string): Promise<{ message: string }> {
    const user = await this.findActiveUserById(userId);
    user.two_factor_enabled = false;
    user.two_factor_secret = null;

    await this.usersRepository.save(user);
    await this.recoveryCodesRepository.delete({ user_id: user.id });

    return { message: '2FA berhasil dinonaktifkan' };
  }

  async verifyTwoFactor(dto: VerifyTotpDto): Promise<AuthTokensResponse> {
    const user = await this.verifyChallengeAndFindUser(dto.challenge_token);
    const secret = await this.decryptUserTotpSecret(user);
    await this.assertValidTotp(dto.token, secret);

    return this.issueAuthTokens(user);
  }

  async verifyRecoveryCode(
    dto: VerifyRecoveryDto,
  ): Promise<AuthTokensResponse> {
    const user = await this.verifyChallengeAndFindUser(dto.challenge_token);
    const recoveryCodes = await this.recoveryCodesRepository.find({
      where: { user_id: user.id, is_used: false },
    });
    const normalizedCode = dto.code.toUpperCase();

    for (const recoveryCode of recoveryCodes) {
      const matches = await bcrypt.compare(normalizedCode, recoveryCode.code);

      if (matches) {
        recoveryCode.is_used = true;
        await this.recoveryCodesRepository.save(recoveryCode);
        return this.issueAuthTokens(user);
      }
    }

    throw new UnauthorizedException('Recovery code tidak valid');
  }

  /**
   * Verify a TOTP code for a user with 2FA enabled (used by sensitive
   * self-service actions such as account deletion). No-op if 2FA is disabled.
   */
  async assertTwoFactorToken(
    userId: string,
    token: string | undefined,
  ): Promise<void> {
    const user = await this.findActiveUserById(userId);
    if (!user.two_factor_enabled) return;
    if (!token) {
      throw new UnauthorizedException('Kode 2FA diperlukan');
    }
    const secret = await this.decryptUserTotpSecret(user);
    await this.assertValidTotp(token, secret);
  }

  /**
   * Server-side logout. Bumps the user's session epoch (token_version) so every
   * previously issued access AND refresh JWT is rejected immediately — a stolen
   * or stale refresh token can no longer be replayed for its 7-day lifetime.
   * Also revokes any outstanding DB-backed auth tokens (reset/verification).
   */
  async logout(userId: string): Promise<{ message: string }> {
    await this.invalidateAllSessions(userId);
    await this.authTokensRepository
      .createQueryBuilder()
      .update(AuthToken)
      .set({ revoked_at: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('used_at IS NULL')
      .andWhere('revoked_at IS NULL')
      .execute();
    return { message: 'Logout berhasil' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const authToken = await this.findUsableAuthToken(
      dto.token,
      'email_verification',
    );
    const user = authToken.user;

    if (user.email_verified) {
      throw new BadRequestException('Email sudah terverifikasi');
    }

    user.email_verified = true;
    authToken.used_at = new Date();
    await this.authTokensRepository.save(authToken);
    await this.usersRepository.save(user);

    return { message: 'Email berhasil diverifikasi' };
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (user.email_verified) {
      throw new BadRequestException('Email sudah terverifikasi');
    }

    const token = await this.createAuthToken(
      user,
      'email_verification',
      getAuthExpiry(this.config, 'AUTH_EMAIL_TOKEN_EXPIRES_IN', '24h'),
    );
    await this.emailService.sendVerificationEmail(user.email, user.name, token);

    return { message: 'Email verifikasi berhasil dikirim ulang' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user || !user.password_hash) {
      return {
        message: 'Jika email terdaftar, instruksi reset password akan dikirim.',
      };
    }

    const token = await this.createAuthToken(
      user,
      'password_reset',
      getAuthExpiry(this.config, 'AUTH_RESET_TOKEN_EXPIRES_IN', '30m'),
    );

    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.name,
      token,
    );

    return {
      message: 'Jika email terdaftar, instruksi reset password akan dikirim.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const authToken = await this.findUsableAuthToken(
      dto.token,
      'password_reset',
    );
    const user = authToken.user;

    user.password_hash = await bcrypt.hash(
      dto.new_password,
      this.getBcryptRounds(),
    );
    user.password_updated_at = new Date();
    authToken.used_at = new Date();
    await this.authTokensRepository.save(authToken);
    await this.usersRepository.save(user);
    await this.revokeActiveAuthTokens(user.id, 'password_reset');
    /* Invalidate every existing session — a reset implies the old credentials
       (and any tokens minted from them) can no longer be trusted. */
    await this.invalidateAllSessions(user.id);

    return { message: 'Password berhasil direset' };
  }

  async handleGoogleLogin(
    profile: GoogleAuthProfile,
  ): Promise<{ exchange_code: string }> {
    const normalizedEmail = profile.email.toLowerCase().trim();

    let user = await this.usersRepository.findOne({
      where: { google_id: profile.google_id },
    });

    if (!user) {
      user = await this.usersRepository.findOne({
        where: { email: normalizedEmail },
      });
    }

    if (user) {
      user.google_id = user.google_id ?? profile.google_id;
      user.avatar_url = user.avatar_url ?? profile.avatar_url;
      user.name = user.name || profile.name;
      user.email_verified = true;
      await this.usersRepository.save(user);
    } else {
      try {
        user = await this.usersRepository.save(
          this.usersRepository.create({
            name: profile.name,
            email: normalizedEmail,
            google_id: profile.google_id,
            avatar_url: profile.avatar_url,
            password_hash: null,
            role: 'Guest',
            email_verified: true,
          }),
        );
      } catch (error: unknown) {
        const isUniqueViolation =
          error instanceof Error && error.message.includes('duplicate key');

        if (isUniqueViolation) {
          user = await this.usersRepository.findOne({
            where: { email: normalizedEmail },
          });

          if (!user) {
            throw new InternalServerErrorException(
              'Gagal membuat akun Google — silakan coba lagi',
            );
          }

          user.google_id = user.google_id ?? profile.google_id;
          user.avatar_url = user.avatar_url ?? profile.avatar_url;
          user.email_verified = true;
          await this.usersRepository.save(user);
        } else {
          throw error;
        }
      }
    }

    const exchangeCode = await this.createAuthToken(
      user,
      'oauth_exchange',
      '5m',
    );

    return { exchange_code: exchangeCode };
  }

  async exchangeOAuthToken(code: string): Promise<LoginResponse> {
    const authToken = await this.findUsableAuthToken(code, 'oauth_exchange');
    const user = authToken.user;

    authToken.used_at = new Date();
    await this.authTokensRepository.save(authToken);

    if (user.two_factor_enabled) {
      return this.issueTwoFactorChallenge(user);
    }

    return this.issueAuthTokens(user);
  }

  async validateAccessTokenPayload(
    payload: AuthTokenPayload,
  ): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token tidak valid untuk akses API');
    }

    const user = await this.findActiveUserById(payload.sub);
    this.assertSessionEpoch(payload, user);
    return this.toAuthenticatedUser(user);
  }

  private async issueAuthTokens(user: User): Promise<AuthTokensResponse> {
    const accessExpiresIn = getAuthExpiry(
      this.config,
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    );
    const refreshExpiresIn = getAuthExpiry(
      this.config,
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    const basePayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      token_version: user.token_version,
    };
    const refreshJti = randomBytes(16).toString('base64url');
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...basePayload, type: 'access' } satisfies AuthTokenPayload,
        this.buildSignOptions('JWT_ACCESS_SECRET', accessExpiresIn),
      ),
      this.jwtService.signAsync(
        {
          ...basePayload,
          type: 'refresh',
          jti: refreshJti,
        } satisfies AuthTokenPayload,
        this.buildSignOptions('JWT_REFRESH_SECRET', refreshExpiresIn),
      ),
    ]);
    await this.persistRefreshTokenRecord(user.id, refreshJti, refreshExpiresIn);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: parseDurationToSeconds(accessExpiresIn),
      user: this.toAuthenticatedUser(user),
    };
  }

  private async issueTwoFactorChallenge(
    user: User,
  ): Promise<TwoFactorChallengeResponse> {
    const expiresIn = getAuthExpiry(
      this.config,
      'JWT_CHALLENGE_EXPIRES_IN',
      '10m',
    );
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      type: '2fa_challenge',
    };
    const challengeToken = await this.jwtService.signAsync(
      payload,
      this.buildSignOptions('JWT_CHALLENGE_SECRET', expiresIn),
    );

    return {
      requires_2fa: true,
      challenge_token: challengeToken,
      expires_in: parseDurationToSeconds(expiresIn),
    };
  }

  private async verifyToken(
    token: string,
    secretKey: string,
  ): Promise<AuthTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret: getAuthSecret(this.config, secretKey),
      });
    } catch {
      throw new UnauthorizedException(
        'Token tidak valid atau sudah kedaluwarsa',
      );
    }
  }

  private buildSignOptions(
    secretKey: string,
    expiresIn: string,
  ): JwtSignOptions {
    return {
      secret: getAuthSecret(this.config, secretKey),
      expiresIn: expiresIn as JwtSignOptions['expiresIn'],
    };
  }

  private async verifyChallengeAndFindUser(token: string): Promise<User> {
    const payload = await this.verifyToken(token, 'JWT_CHALLENGE_SECRET');

    if (payload.type !== '2fa_challenge') {
      throw new UnauthorizedException('Challenge token tidak valid');
    }

    return this.findActiveUserById(payload.sub);
  }

  private async createAuthToken(
    user: User,
    purpose: AuthTokenPurpose,
    expiresIn: string,
  ): Promise<string> {
    const seconds = parseDurationToSeconds(expiresIn);

    if (seconds <= 0) {
      throw new InternalServerErrorException(
        `Konfigurasi expiry token ${purpose} tidak valid`,
      );
    }

    await this.revokeActiveAuthTokens(user.id, purpose);

    const plainToken = randomBytes(32).toString('base64url');
    const authToken = this.authTokensRepository.create({
      user_id: user.id,
      purpose,
      token_hash: this.hashAuthToken(plainToken),
      expires_at: new Date(Date.now() + seconds * 1000),
      used_at: null,
      revoked_at: null,
    });

    await this.authTokensRepository.save(authToken);

    return plainToken;
  }

  /**
   * Simpan catatan refresh token (rotasi). Sengaja TIDAK memanggil
   * revokeActiveAuthTokens — user boleh punya beberapa sesi aktif
   * (multi-device); tiap refresh token tetap sekali-pakai.
   */
  private async persistRefreshTokenRecord(
    userId: string,
    jti: string,
    expiresIn: string,
  ): Promise<void> {
    const seconds = parseDurationToSeconds(expiresIn);
    const record = this.authTokensRepository.create({
      user_id: userId,
      purpose: 'refresh',
      token_hash: this.hashAuthToken(jti),
      expires_at: new Date(Date.now() + Math.max(seconds, 0) * 1000),
      used_at: null,
      revoked_at: null,
    });
    await this.authTokensRepository.save(record);
  }

  /**
   * Tandai refresh token terpakai (sekali-pakai).
   *
   * Reuse dalam GRACE window (race wajar: dua tab me-refresh bersamaan
   * sebelum event `storage` menyinkronkan token baru) → cukup 401, sesi
   * lain tetap hidup. Reuse SETELAH grace / token tak dikenal / dicabut /
   * kedaluwarsa → indikasi kompromi: SELURUH sesi diinvalidasi lalu 401.
   */
  private static readonly REFRESH_REUSE_GRACE_MS = 60_000;

  private async consumeRefreshTokenRecord(
    userId: string,
    jti: string,
  ): Promise<void> {
    const record = await this.authTokensRepository.findOne({
      where: { purpose: 'refresh', token_hash: this.hashAuthToken(jti) },
    });

    const usable =
      record &&
      record.user_id === userId &&
      !record.used_at &&
      !record.revoked_at &&
      record.expires_at.getTime() > Date.now();

    if (!usable) {
      const reusedWithinGrace =
        record?.used_at &&
        record.user_id === userId &&
        !record.revoked_at &&
        Date.now() - record.used_at.getTime() <
          AuthService.REFRESH_REUSE_GRACE_MS;

      if (!reusedWithinGrace) {
        await this.invalidateAllSessions(userId);
      }

      throw new UnauthorizedException(
        'Refresh token sudah tidak berlaku. Silakan login ulang.',
      );
    }

    record.used_at = new Date();
    await this.authTokensRepository.save(record);
  }

  private async findUsableAuthToken(
    plainToken: string,
    purpose: AuthTokenPurpose,
  ): Promise<AuthToken> {
    const authToken = await this.authTokensRepository.findOne({
      where: {
        purpose,
        token_hash: this.hashAuthToken(plainToken),
      },
      relations: ['user'],
    });

    if (
      !authToken ||
      authToken.used_at ||
      authToken.revoked_at ||
      authToken.expires_at.getTime() <= Date.now() ||
      !authToken.user
    ) {
      throw new BadRequestException('Token tidak valid atau sudah kedaluwarsa');
    }

    return authToken;
  }

  private async revokeActiveAuthTokens(
    userId: string,
    purpose: AuthTokenPurpose,
  ): Promise<void> {
    await this.authTokensRepository
      .createQueryBuilder()
      .update(AuthToken)
      .set({ revoked_at: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('purpose = :purpose', { purpose })
      .andWhere('used_at IS NULL')
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private hashAuthToken(plainToken: string): string {
    return createHmac(
      'sha256',
      getAuthSecret(this.config, 'AUTH_TOKEN_HASH_SECRET'),
    )
      .update(plainToken)
      .digest('hex');
  }

  private async encryptTotpSecret(secret: string): Promise<Buffer> {
    const rows = await this.dataSource.query(
      'SELECT pgp_sym_encrypt($1, $2) AS encrypted_secret',
      [secret, getAuthSecret(this.config, 'TWO_FACTOR_ENCRYPTION_SECRET')],
    );
    const encryptedSecret = rows[0]?.encrypted_secret;

    if (!Buffer.isBuffer(encryptedSecret)) {
      throw new InternalServerErrorException('Gagal mengenkripsi secret 2FA');
    }

    return encryptedSecret;
  }

  private async decryptUserTotpSecret(user: User): Promise<string> {
    if (!user.two_factor_secret) {
      throw new BadRequestException('Secret 2FA belum dibuat');
    }

    const rows = await this.dataSource.query(
      'SELECT pgp_sym_decrypt($1::bytea, $2) AS secret',
      [
        user.two_factor_secret,
        getAuthSecret(this.config, 'TWO_FACTOR_ENCRYPTION_SECRET'),
      ],
    );
    const secret = rows[0]?.secret;

    if (typeof secret !== 'string') {
      throw new UnauthorizedException('Secret 2FA tidak valid');
    }

    return secret;
  }

  private async assertValidTotp(token: string, secret: string): Promise<void> {
    try {
      const result = await verify({ secret, token });

      if (!result.valid) {
        throw new UnauthorizedException('Kode 2FA tidak valid');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Kode 2FA tidak valid');
    }
  }

  private async replaceRecoveryCodes(userId: string): Promise<string[]> {
    const plainCodes = Array.from({ length: 8 }, () =>
      this.generateRecoveryCode(),
    );
    const hashedCodes = await Promise.all(
      plainCodes.map((code) => bcrypt.hash(code, this.getBcryptRounds())),
    );

    await this.recoveryCodesRepository.delete({ user_id: userId });
    await this.recoveryCodesRepository.save(
      hashedCodes.map((code) =>
        this.recoveryCodesRepository.create({
          user_id: userId,
          code,
          is_used: false,
        }),
      ),
    );

    return plainCodes;
  }

  private generateRecoveryCode(): string {
    const raw = randomBytes(4).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  }

  private async findActiveUserById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new UnauthorizedException(
        'User tidak ditemukan atau sudah nonaktif',
      );
    }

    return user;
  }

  /**
   * Reject tokens whose embedded session epoch no longer matches the user's
   * current token_version. Tokens minted before the column existed carry no
   * token_version; we treat that as epoch 0 so in-flight sessions are not
   * force-killed on first deploy, while any post-deploy logout/reset (which
   * bumps the version to >= 1) revokes them.
   */
  private assertSessionEpoch(payload: AuthTokenPayload, user: User): void {
    const tokenEpoch = payload.token_version ?? 0;
    const userEpoch = user.token_version ?? 0;

    if (tokenEpoch !== userEpoch) {
      throw new UnauthorizedException(
        'Sesi sudah berakhir. Silakan login ulang.',
      );
    }
  }

  /**
   * Atomically bump the user's session epoch, invalidating every access and
   * refresh token issued before this moment.
   */
  private async invalidateAllSessions(userId: string): Promise<void> {
    await this.usersRepository.increment({ id: userId }, 'token_version', 1);
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      avatar_url: user.avatar_url,
      email_verified: user.email_verified,
      two_factor_enabled: user.two_factor_enabled,
      google_id: user.google_id,
      password_updated_at: user.password_updated_at?.toISOString() ?? null,
    };
  }

  private getBcryptRounds(): number {
    return Number(this.config.get<string>('BCRYPT_ROUNDS') ?? 12);
  }
}
