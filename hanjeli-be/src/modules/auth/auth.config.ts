import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

const PLACEHOLDER_ENCRYPTION_KEY = 'generate-a-strong-random-string-here';

export function getAuthSecret(config: ConfigService, key: string): string {
  const directSecret = config.get<string>(key);

  if (directSecret) {
    return directSecret;
  }

  const encryptionKey = config.get<string>('ENCRYPTION_KEY');

  if (encryptionKey && encryptionKey !== PLACEHOLDER_ENCRYPTION_KEY) {
    return createHmac('sha256', encryptionKey).update(key).digest('hex');
  }

  throw new Error(`Environment variable ${key} belum tersedia`);
}

export function getAuthExpiry(
  config: ConfigService,
  key: string,
  fallback: string,
): string {
  return config.get<string>(key) ?? fallback;
}

export function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])?$/.exec(duration.trim());

  if (!match) {
    return 0;
  }

  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  return value * multipliers[unit];
}

export function parseBoolean(
  value: string | undefined,
  fallback = false,
): boolean {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}
