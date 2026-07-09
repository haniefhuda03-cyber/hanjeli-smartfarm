import { SetMetadata } from '@nestjs/common';

export const CACHE_TTL_METADATA = 'hanjeli:cache_ttl';
export const CACHE_KEY_METADATA = 'hanjeli:cache_key';
export const CACHE_INVALIDATE_METADATA = 'hanjeli:cache_invalidate';

export const CacheTtl = (seconds: number) =>
  SetMetadata(CACHE_TTL_METADATA, seconds);

export const CacheKey = (key: string) => SetMetadata(CACHE_KEY_METADATA, key);

export const CacheInvalidate = (...patterns: string[]) =>
  SetMetadata(CACHE_INVALIDATE_METADATA, patterns);
