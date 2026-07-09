import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import {
  buildPaginationMeta,
  PaginatedResponse,
} from '../../common/dto/pagination.dto.js';
import {
  PublicUser,
  toPublicUser,
} from '../../common/presenters/user.presenter.js';
import { User } from '../../entities/user.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';
import { AuthService } from '../auth/auth.service.js';
import { AuthEmailService } from '../auth/auth-email.service.js';
import { AppCacheService } from '../../common/cache/app-cache.service.js';
import { SensorGateway } from '../websocket/sensor.gateway.js';

/** Minimal shape of a Multer-uploaded file (avoids needing @types/multer). */
export interface UploadedImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly authEmailService: AuthEmailService,
    private readonly cache: AppCacheService,
    @Inject(forwardRef(() => SensorGateway))
    private readonly sensorGateway: SensorGateway,
  ) {}

  async sendEmailChangeToken(
    userId: string,
    newEmail: string,
  ): Promise<{ message: string }> {
    const email = newEmail.toLowerCase().trim();
    const user = await this.findEntityById(userId);

    if (user.email === email) {
      throw new BadRequestException('Email baru sama dengan email saat ini');
    }

    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email sudah digunakan');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    await this.cache.set(`emailchange:${user.id}`, { email, otp }, 900);
    
    await this.authEmailService.sendEmailChangeOtp(email, user.name, otp);

    return { message: 'Token OTP telah dikirim ke email baru' };
  }

  async verifyEmailChangeToken(
    userId: string,
    newEmail: string,
    token: string,
  ): Promise<{ valid: boolean }> {
    const targetEmail = newEmail.toLowerCase().trim();
    const cached = await this.cache.get<{ email: string; otp: string }>(`emailchange:${userId}`);
    
    if (!cached) {
      throw new BadRequestException('Token OTP kedaluwarsa atau belum dikirim');
    }
    if (cached.email !== targetEmail) {
      throw new BadRequestException('Email tidak cocok dengan yang didaftarkan pada token');
    }
    if (cached.otp !== token) {
      throw new BadRequestException('Token OTP salah');
    }

    // Do NOT delete the cache here because it still needs to be used in updateProfile.
    // We just verify it for the UI.
    return { valid: true };
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.usersRepository.findOne({ where: { email } });

    if (existing) {
      throw new ConflictException('Email sudah digunakan');
    }

    const user = this.usersRepository.create({
      name: dto.name.trim(),
      email,
      password_hash: await this.hashPassword(dto.password),
      password_updated_at: new Date(),
      role: dto.role ?? 'Guest',
      email_verified: true,
    });

    return toPublicUser(await this.usersRepository.save(user));
  }

  async findAll(query: QueryUsersDto): Promise<PaginatedResponse<PublicUser>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const builder = this.usersRepository
      .createQueryBuilder('user')
      .orderBy('user.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.role) {
      builder.andWhere('user.role = :role', { role: query.role });
    }

    if (query.q?.trim()) {
      const q = `%${query.q.trim().toLowerCase()}%`;
      builder.andWhere(
        '(LOWER(user.name) LIKE :q OR LOWER(user.email) LIKE :q OR LOWER(user.role) LIKE :q)',
        { q },
      );
    }

    const [users, total] = await builder.getManyAndCount();

    return {
      data: users.map(toPublicUser),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(id: string): Promise<PublicUser> {
    return toPublicUser(await this.findEntityById(id));
  }

  async update(id: string, dto: UpdateUserDto, currentUserId?: string): Promise<PublicUser> {
    const user = await this.findEntityById(id);

    if (currentUserId && id === currentUserId) {
      if (dto.role !== undefined && dto.role !== user.role) {
        throw new ForbiddenException('Tidak dapat mengubah peran Anda sendiri melalui panel admin');
      }
    }

    await this.applyEmailChange(user, dto.email);

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.password !== undefined) {
      user.password_hash = await this.hashPassword(dto.password);
      user.password_updated_at = new Date();
    }
    if (dto.role !== undefined) user.role = dto.role;

    return toPublicUser(await this.usersRepository.save(user));
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.findEntityById(id);

    if (dto.email !== undefined) {
      const targetEmail = dto.email.toLowerCase().trim();
      if (targetEmail !== user.email) {
        if (!dto.emailToken) {
          throw new BadRequestException('Token OTP diperlukan untuk mengganti email');
        }

        const cached = await this.cache.get<{ email: string; otp: string }>(
          `emailchange:${id}`,
        );

        if (!cached) {
          throw new BadRequestException('Token OTP kedaluwarsa atau belum dikirim');
        }
        if (cached.email !== targetEmail) {
          throw new BadRequestException('Email tidak cocok dengan yang didaftarkan pada token');
        }
        if (cached.otp !== dto.emailToken) {
          throw new BadRequestException('Token OTP salah');
        }

        await this.cache.del(`emailchange:${id}`);
        await this.applyEmailChange(user, targetEmail, false);
      }
    }

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.password !== undefined) {
      // Require the current password before changing it (accounts that have one).
      if (user.password_hash) {
        if (!dto.currentPassword) {
          throw new UnauthorizedException('Kata sandi saat ini diperlukan');
        }
        const matches = await bcrypt.compare(
          dto.currentPassword,
          user.password_hash,
        );
        if (!matches) {
          throw new UnauthorizedException('Kata sandi saat ini salah');
        }
      }
      user.password_hash = await this.hashPassword(dto.password);
      user.password_updated_at = new Date();
    }
    if (dto.avatar_url !== undefined) {
      this.assertAvatarUrl(dto.avatar_url);
      user.avatar_url = dto.avatar_url;
    }

    return toPublicUser(await this.usersRepository.save(user));
  }

  async updateAvatar(id: string, file: UploadedImage): Promise<PublicUser> {
    if (!file || !file.buffer) {
      throw new BadRequestException('File gambar diperlukan');
    }

    const allowedMime: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const ext = allowedMime[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Foto harus berupa file gambar PNG, JPG, WEBP, atau GIF',
      );
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Ukuran maksimal 2 MB');
    }

    const user = await this.findEntityById(id);

    // Delete the old avatar file if it exists and is stored locally
    if (user.avatar_url && user.avatar_url.includes('/uploads/avatars/')) {
      try {
        const oldFilename = user.avatar_url.split('/').pop();
        if (oldFilename) {
          const oldFilePath = join(process.cwd(), 'uploads', 'avatars', oldFilename);
          await fs.unlink(oldFilePath);
        }
      } catch (err) {
        // Ignore error if file doesn't exist
      }
    }

    const dir = join(process.cwd(), 'uploads', 'avatars');
    await fs.mkdir(dir, { recursive: true });
    const filename = `${id}-${Date.now()}.${ext}`;
    await fs.writeFile(join(dir, filename), file.buffer);

    const baseUrl = (
      this.config.get<string>('PUBLIC_BACKEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    user.avatar_url = `${baseUrl}/uploads/avatars/${filename}`;

    return toPublicUser(await this.usersRepository.save(user));
  }

  async remove(
    targetId: string,
    currentUserId: string,
  ): Promise<{ message: string }> {
    if (targetId === currentUserId) {
      throw new ForbiddenException(
        'Tidak dapat menghapus akun sendiri melalui panel admin',
      );
    }

    const user = await this.findEntityById(targetId);
    /* Hard delete — FK CASCADE ikut menghapus devices, telemetry, preferensi,
       notifikasi, token, dan seluruh data terkait secara permanen. */
    await this.usersRepository.remove(user);
    this.sensorGateway.disconnectUser(targetId);

    return { message: 'User berhasil dihapus' };
  }

  async disableUser2FA(
    targetId: string,
    currentUserId: string,
  ): Promise<{ message: string }> {
    if (targetId === currentUserId) {
      throw new ForbiddenException(
        'Gunakan menu Profil Anda sendiri untuk menonaktifkan 2FA',
      );
    }
    
    // Ensure user exists
    await this.findEntityById(targetId);
    
    // Use authService to disable 2FA (it clears secret and deletes recovery codes)
    await this.authService.disableTwoFactor(targetId);

    return { message: '2FA pengguna berhasil dinonaktifkan' };
  }

  async removeSelf(
    id: string,
    dto: DeleteAccountDto = {},
  ): Promise<{ message: string }> {
    const user = await this.findEntityById(id);

    // Re-authenticate before the irreversible action.
    if (user.password_hash) {
      if (!dto.password) {
        throw new UnauthorizedException(
          'Kata sandi diperlukan untuk menghapus akun',
        );
      }
      const matches = await bcrypt.compare(dto.password, user.password_hash);
      if (!matches) {
        throw new UnauthorizedException('Kata sandi salah');
      }
    }

    if (user.two_factor_enabled) {
      await this.authService.assertTwoFactorToken(user.id, dto.twoFactorToken);
    }

    /* Hard delete permanen — tidak ada soft delete / pemulihan akun. */
    await this.usersRepository.remove(user);
    this.sensorGateway.disconnectUser(id);

    return { message: 'Akun berhasil dihapus' };
  }

  private async applyEmailChange(
    user: User,
    rawEmail: string | undefined,
    markUnverified = false,
  ): Promise<void> {
    if (rawEmail === undefined) return;

    const email = rawEmail.toLowerCase().trim();
    if (email === user.email) return;

    const existing = await this.usersRepository.findOne({ where: { email } });

    if (existing) {
      throw new ConflictException('Email sudah digunakan');
    }

    user.email = email;
    if (markUnverified) {
      user.email_verified = false;
    }
  }

  private async findEntityById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return user;
  }

  private async hashPassword(password: string): Promise<string> {
    const rounds = Number(this.config.get<string>('BCRYPT_ROUNDS') ?? 12);
    return bcrypt.hash(password, rounds);
  }

  private assertAvatarUrl(avatarUrl: string): void {
    if (!/^https?:\/\//i.test(avatarUrl)) {
      throw new BadRequestException(
        'Avatar harus berupa URL gambar yang valid',
      );
    }

    const lower = avatarUrl.toLowerCase();
    const looksLikeImage =
      /\.(png|jpe?g|webp|gif)(\?.*)?$/.test(lower) ||
      lower.includes('googleusercontent.com') ||
      lower.includes('gravatar.com');

    if (!looksLikeImage) {
      throw new BadRequestException(
        'Avatar harus berupa file gambar PNG, JPG, WEBP, atau GIF',
      );
    }
  }
}
