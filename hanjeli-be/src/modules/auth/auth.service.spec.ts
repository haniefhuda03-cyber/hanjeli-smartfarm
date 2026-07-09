import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import {
  AuthTokensResponse,
  TwoFactorChallengeResponse,
} from './auth.types.js';

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'TESTTOTPSECRET'),
  generateURI: jest.fn(() => 'otpauth://totp/Hanjeli:test@example.com'),
  verify: jest.fn(async () => ({ valid: true })),
}));

type MockRepository = {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  delete: jest.Mock;
  increment: jest.Mock;
  createQueryBuilder: jest.Mock;
};

const authEnv: Record<string, string> = {
  ENCRYPTION_KEY: 'test-root-encryption-key',
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_CHALLENGE_SECRET: 'test-challenge-secret',
  TWO_FACTOR_ENCRYPTION_SECRET: 'test-two-factor-secret',
  AUTH_TOKEN_HASH_SECRET: 'test-auth-token-hash-secret',
  BCRYPT_ROUNDS: '4',
};

function createRepositoryMock(): MockRepository {
  const queryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
  };

  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value) => value),
    delete: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
}

function createUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Hanjeli User',
    email: 'user@example.com',
    role: 'Guest',
    password_hash: null,
    avatar_url: null,
    two_factor_enabled: false,
    two_factor_secret: null,
    email_verified: true,
    google_id: null,
    created_at: new Date('2026-06-09T00:00:00.000Z'),
    updated_at: new Date('2026-06-09T00:00:00.000Z'),
    ...overrides,
  };
}

function createService() {
  const usersRepository = createRepositoryMock();
  const recoveryCodesRepository = createRepositoryMock();
  const authTokensRepository = createRepositoryMock();
  const dataSource = { query: jest.fn() };
  const jwtService = {
    signAsync: jest.fn(async (payload) => `token-${payload.type}`),
    verifyAsync: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => authEnv[key]),
  };
  const emailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };
  const service = new AuthService(
    usersRepository as never,
    recoveryCodesRepository as never,
    authTokensRepository as never,
    dataSource as never,
    jwtService as never,
    config as never,
    emailService as never,
  );

  return {
    service,
    usersRepository,
    recoveryCodesRepository,
    authTokensRepository,
    emailService,
    jwtService,
  };
}

describe('AuthService', () => {
  it('returns sanitized tokens for valid login', async () => {
    const { service, usersRepository } = createService();
    const passwordHash = await bcrypt.hash('secret123', 4);
    usersRepository.findOne.mockResolvedValue(
      createUser({ password_hash: passwordHash }),
    );

    const response = (await service.login({
      email: 'USER@example.com',
      password: 'secret123',
    })) as AuthTokensResponse;

    expect(response.access_token).toBe('token-access');
    expect(response.refresh_token).toBe('token-refresh');
    expect(response.user.email).toBe('user@example.com');
    expect(response.user).not.toHaveProperty('password_hash');
    expect(response.user).not.toHaveProperty('two_factor_secret');
  });

  it('rejects invalid passwords with friendly unauthorized message', async () => {
    const { service, usersRepository } = createService();
    const passwordHash = await bcrypt.hash('secret123', 4);
    usersRepository.findOne.mockResolvedValue(
      createUser({ password_hash: passwordHash }),
    );

    await expect(
      service.login({ email: 'user@example.com', password: 'wrongpass' }),
    ).rejects.toThrow(new UnauthorizedException('Email atau password salah'));
  });

  it('returns a 2FA challenge instead of tokens when 2FA is enabled', async () => {
    const { service, usersRepository } = createService();
    const passwordHash = await bcrypt.hash('secret123', 4);
    usersRepository.findOne.mockResolvedValue(
      createUser({ password_hash: passwordHash, two_factor_enabled: true }),
    );

    const response = (await service.login({
      email: 'user@example.com',
      password: 'secret123',
    })) as TwoFactorChallengeResponse;

    expect(response.requires_2fa).toBe(true);
    expect(response.challenge_token).toBe('token-2fa_challenge');
  });

  it('marks a matching recovery code as used before issuing tokens', async () => {
    const { service, usersRepository, recoveryCodesRepository, jwtService } =
      createService();
    const user = createUser({ two_factor_enabled: true });
    const recoveryCode = {
      id: 'recovery-1',
      user_id: user.id,
      code: await bcrypt.hash('A1B2-C3D4', 4),
      is_used: false,
    };

    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      email: user.email,
      role: user.role,
      type: '2fa_challenge',
    });
    usersRepository.findOne.mockResolvedValue(user);
    recoveryCodesRepository.find.mockResolvedValue([recoveryCode]);

    const response = await service.verifyRecoveryCode({
      challenge_token: 'challenge.jwt.token',
      code: 'A1B2-C3D4',
    });

    expect(recoveryCodesRepository.save).toHaveBeenCalledWith({
      ...recoveryCode,
      is_used: true,
    });
    expect(response.access_token).toBe('token-access');
  });

  it('stores password reset tokens as hashes and emails only the raw token', async () => {
    const { service, usersRepository, authTokensRepository, emailService } =
      createService();
    usersRepository.findOne.mockResolvedValue(
      createUser({ password_hash: await bcrypt.hash('secret123', 4) }),
    );

    await service.forgotPassword({ email: 'user@example.com' });

    const savedToken = authTokensRepository.save.mock.calls[0][0];
    const emailedToken = emailService.sendPasswordResetEmail.mock.calls[0][2];

    expect(savedToken.purpose).toBe('password_reset');
    expect(savedToken.token_hash).not.toBe(emailedToken);
    expect(savedToken.token_hash).toHaveLength(64);
    expect(emailedToken).toHaveLength(43);
  });

  it('marks a stored reset token as used when password is reset', async () => {
    const { service, usersRepository, authTokensRepository } = createService();
    const user = createUser({
      password_hash: await bcrypt.hash('secret123', 4),
    });
    const authToken = {
      id: 'token-1',
      user_id: user.id,
      purpose: 'password_reset',
      token_hash: 'hashed-token',
      expires_at: new Date(Date.now() + 60_000),
      used_at: null,
      revoked_at: null,
      created_at: new Date(),
      user,
    };
    authTokensRepository.findOne.mockResolvedValue(authToken);
    usersRepository.save.mockResolvedValue(user);

    await service.resetPassword({
      token: 'raw-reset-token-value-with-enough-length',
      new_password: 'newsecret123',
    });

    expect(authTokensRepository.save).toHaveBeenCalledWith({
      ...authToken,
      used_at: expect.any(Date),
    });
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        password_hash: expect.any(String),
      }),
    );
  });
});
