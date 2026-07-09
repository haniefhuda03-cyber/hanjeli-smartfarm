import { ConfigService } from '@nestjs/config';

export interface RedisRuntimeConfig {
  enabled: boolean;
  url?: string;
  host: string;
  port: number;
  password?: string;
  keyPrefix: string;
}

export function getRedisConfig(config: ConfigService): RedisRuntimeConfig {
  const url = config.get<string>('REDIS_URL')?.trim();
  const enabled =
    parseBoolean(config.get<string>('REDIS_ENABLED'), false) || Boolean(url);

  return {
    enabled,
    url: url || undefined,
    host: config.get<string>('REDIS_HOST') ?? 'localhost',
    port: Number(config.get<string>('REDIS_PORT') ?? 6379),
    password: emptyToUndefined(config.get<string>('REDIS_PASSWORD')),
    keyPrefix: config.get<string>('REDIS_KEY_PREFIX') ?? 'hanjeli',
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
