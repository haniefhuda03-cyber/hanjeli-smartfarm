jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  verify: jest.fn(async () => ({ valid: true })),
}));

import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service.js';

function createUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Admin',
    email: 'admin@example.com',
    role: 'Admin',
    password_hash: 'hashed',
    avatar_url: null,
    two_factor_enabled: false,
    two_factor_secret: Buffer.from('secret'),
    email_verified: true,
    google_id: null,
    created_at: new Date('2026-06-09T00:00:00.000Z'),
    updated_at: new Date('2026-06-09T00:00:00.000Z'),
    ...overrides,
  };
}

function createService() {
  const repository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => createUser(value)),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => (key === 'BCRYPT_ROUNDS' ? '4' : undefined)),
  };
  const authService = {
    assertTwoFactorToken: jest.fn(),
  };
  const sensorGateway = {
    disconnectUser: jest.fn(),
  };

  return {
    service: new UsersService(
      repository as never,
      config as never,
      authService as never,
      sensorGateway as never,
    ),
    repository,
    sensorGateway,
  };
}

describe('UsersService', () => {
  it('returns sanitized users from admin creation', async () => {
    const { service, repository } = createService();
    repository.findOne.mockResolvedValue(null);

    const user = await service.create({
      name: 'New User',
      email: 'NEW@example.com',
      password: 'secret123',
      role: 'Guest',
    });

    expect(user.email).toBe('new@example.com');
    expect(user).not.toHaveProperty('password_hash');
    expect(user).not.toHaveProperty('two_factor_secret');
  });

  it('blocks admin self-delete', async () => {
    const { service } = createService();

    await expect(service.remove('user-1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('hard-deletes users and disconnects their sockets', async () => {
    const { service, repository, sensorGateway } = createService();
    const target = createUser({ id: 'user-2' });
    repository.findOne.mockResolvedValue(target);

    await service.remove('user-2', 'user-1');

    expect(repository.remove).toHaveBeenCalledWith(target);
    expect(sensorGateway.disconnectUser).toHaveBeenCalledWith('user-2');
  });
});
