import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

function createContext(role?: 'Admin' | 'Guest') {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => ({
        user: role
          ? {
              id: 'user-1',
              role,
            }
          : undefined,
      })),
    })),
  };
}

describe('RolesGuard', () => {
  it('allows requests when no roles are required', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext('Guest') as never)).toBe(true);
  });

  it('allows users with a matching role', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => ['Admin']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext('Admin') as never)).toBe(true);
  });

  it('rejects users without a matching role', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => ['Admin']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext('Guest') as never)).toThrow(
      ForbiddenException,
    );
  });
});
