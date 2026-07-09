import { ConfigService } from '@nestjs/config';
import { AppCacheService } from './app-cache.service.js';

function createConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('AppCacheService', () => {
  it('uses memory cache when Redis is disabled', async () => {
    const service = new AppCacheService(
      createConfig({ REDIS_ENABLED: 'false' }),
    );

    await service.onModuleInit();
    await service.set('devices:user-1', { total: 2 }, 30);

    await expect(service.get('devices:user-1')).resolves.toEqual({ total: 2 });
  });

  it('invalidates wildcard patterns without Redis', async () => {
    const service = new AppCacheService(
      createConfig({ REDIS_ENABLED: 'false' }),
    );

    await service.set('sensor:latest:user-1', { value: 1 }, 30);
    await service.set('sensor:overview:user-1', { value: 2 }, 30);
    await service.set('devices:user-1', { value: 3 }, 30);

    await service.invalidate(['sensor:*']);

    await expect(service.get('sensor:latest:user-1')).resolves.toBeNull();
    await expect(service.get('sensor:overview:user-1')).resolves.toBeNull();
    await expect(service.get('devices:user-1')).resolves.toEqual({ value: 3 });
  });
});
