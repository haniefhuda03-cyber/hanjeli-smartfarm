import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import {
  CACHE_INVALIDATE_METADATA,
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
} from '../decorators/cache.decorator.js';
import { CustomCacheInterceptor } from './cache.interceptor.js';

function createContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as unknown as ExecutionContext;
}

describe('CustomCacheInterceptor', () => {
  it('returns cached GET response without calling the handler', (done) => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === CACHE_TTL_METADATA) return 60;
        if (key === CACHE_KEY_METADATA) return 'devices:{userId}';
        return undefined;
      }),
    };
    const cache = {
      get: jest.fn(async () => [{ id: 'device-1' }]),
      set: jest.fn(),
      invalidate: jest.fn(),
    };
    const interceptor = new CustomCacheInterceptor(
      reflector as unknown as Reflector,
      cache as never,
    );
    const next = {
      handle: jest.fn(() => of([{ id: 'fresh' }])),
    };

    interceptor
      .intercept(
        createContext({
          method: 'GET',
          url: '/api/v3/devices',
          path: '/api/v3/devices',
          user: { id: 'user-1' },
        }),
        next,
      )
      .subscribe((value) => {
        expect(value).toEqual([{ id: 'device-1' }]);
        expect(next.handle).not.toHaveBeenCalled();
        done();
      });
  });

  it('invalidates configured patterns after successful mutation', (done) => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === CACHE_INVALIDATE_METADATA) {
          return ['devices:{userId}', 'sensor:latest:{userId}'];
        }
        return undefined;
      }),
    };
    const cache = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(async () => undefined),
    };
    const interceptor = new CustomCacheInterceptor(
      reflector as unknown as Reflector,
      cache as never,
    );

    interceptor
      .intercept(
        createContext({
          method: 'POST',
          url: '/api/v3/devices',
          path: '/api/v3/devices',
          user: { id: 'user-1' },
        }),
        { handle: () => of({ ok: true }) },
      )
      .subscribe(() => {
        expect(cache.invalidate).toHaveBeenCalledWith([
          'devices:user-1',
          'sensor:latest:user-1',
        ]);
        done();
      });
  });
});
