import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface WeatherData {
  temp: number;
  temperature: number;
  weather_code: number;
  condition: string;
  icon: string;
  observed_at: string | null;
  latitude: number;
  longitude: number;
  cached: boolean;
  source: 'open-meteo' | 'fallback';
}

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
  };
}

interface MemoryCacheEntry {
  expiresAt: number;
  value: WeatherData;
}

@Injectable()
export class WeatherService implements OnModuleDestroy {
  private readonly logger = new Logger(WeatherService.name);
  private readonly cacheKey = 'hanjeli:weather:current';
  private readonly fallbackCache = new Map<string, MemoryCacheEntry>();
  private readonly redis: Redis | null;

  constructor(private readonly config: ConfigService) {
    this.redis = this.createRedisClient();
  }

  async getCurrentWeather(): Promise<WeatherData> {
    const cached = await this.getCachedWeather();
    if (cached) {
      return { ...cached, cached: true };
    }

    try {
      const weather = await this.fetchOpenMeteoWeather();
      await this.setCachedWeather(weather);
      return weather;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch weather: ${message}`);

      return {
        ...this.fallbackWeather(),
        cached: false,
        source: 'fallback',
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  private async fetchOpenMeteoWeather(): Promise<WeatherData> {
    const latitude = this.latitude;
    const longitude = this.longitude;
    const url = new URL('https://api.open-meteo.com/v1/forecast');

    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('current', 'temperature_2m,weather_code');
    url.searchParams.set('timezone', 'Asia/Jakarta');
    url.searchParams.set('forecast_days', '1');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const payload = (await response.json()) as OpenMeteoResponse;
    const current = payload.current;
    if (
      !current ||
      typeof current.temperature_2m !== 'number' ||
      typeof current.weather_code !== 'number'
    ) {
      throw new Error('Open-Meteo response missing current weather fields');
    }

    return {
      temp: current.temperature_2m,
      temperature: current.temperature_2m,
      weather_code: current.weather_code,
      condition: this.weatherCodeToLabel(current.weather_code),
      icon: this.weatherCodeToIcon(current.weather_code),
      observed_at: current.time ?? null,
      latitude,
      longitude,
      cached: false,
      source: 'open-meteo',
    };
  }

  private async getCachedWeather(): Promise<WeatherData | null> {
    const redisValue = await this.getRedisCache();
    if (redisValue) return redisValue;

    const memoryValue = this.fallbackCache.get(this.cacheKey);
    if (!memoryValue || memoryValue.expiresAt <= Date.now()) {
      this.fallbackCache.delete(this.cacheKey);
      return null;
    }

    return memoryValue.value;
  }

  private async setCachedWeather(value: WeatherData): Promise<void> {
    const ttl = this.cacheTtlSeconds;
    const cachedValue = { ...value, cached: false };

    if (this.redis) {
      await this.redis
        .set(this.cacheKey, JSON.stringify(cachedValue), 'EX', ttl)
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(`Redis weather cache write skipped: ${message}`);
        });
    }

    this.fallbackCache.set(this.cacheKey, {
      value: cachedValue,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  private async getRedisCache(): Promise<WeatherData | null> {
    if (!this.redis) return null;

    try {
      const cached = await this.redis.get(this.cacheKey);
      if (!cached) return null;

      return JSON.parse(cached) as WeatherData;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis weather cache read skipped: ${message}`);
      return null;
    }
  }

  private createRedisClient(): Redis | null {
    const redisUrl = this.config.get<string>('REDIS_URL')?.trim();
    const enabled =
      this.config.get<string>('WEATHER_CACHE_DRIVER') === 'redis' ||
      Boolean(redisUrl);

    if (!enabled) return null;

    const client = redisUrl
      ? new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        })
      : new Redis({
          host: this.config.get<string>('REDIS_HOST') ?? 'localhost',
          port: Number(this.config.get<string>('REDIS_PORT') ?? 6379),
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        });

    client.on('error', (error) => {
      this.logger.warn(`Redis weather cache unavailable: ${error.message}`);
    });

    void client.connect().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis weather cache connect skipped: ${message}`);
    });

    return client;
  }

  private fallbackWeather(): WeatherData {
    const latitude = this.latitude;
    const longitude = this.longitude;

    return {
      temp: 24,
      temperature: 24,
      weather_code: 0,
      condition: 'Cerah',
      icon: 'sun',
      observed_at: null,
      latitude,
      longitude,
      cached: false,
      source: 'fallback',
    };
  }

  private weatherCodeToLabel(code: number): string {
    if (code === 0) return 'Cerah';
    if (code >= 1 && code <= 3) return 'Berawan';
    if (code >= 45 && code <= 48) return 'Berkabut';
    if (code >= 51 && code <= 67) return 'Hujan';
    if (code >= 71 && code <= 77) return 'Salju';
    if (code >= 80 && code <= 82) return 'Hujan Ringan';
    if (code >= 95 && code <= 99) return 'Badai Petir';

    return 'Cerah';
  }

  private weatherCodeToIcon(code: number): string {
    if (code === 0) return 'sun';
    if (code >= 1 && code <= 3) return 'cloud-sun';
    if (code >= 45 && code <= 48) return 'cloud-fog';
    if (code >= 51 && code <= 67) return 'cloud-rain';
    if (code >= 71 && code <= 77) return 'cloud-snow';
    if (code >= 80 && code <= 82) return 'cloud-drizzle';
    if (code >= 95 && code <= 99) return 'cloud-lightning';

    return 'sun';
  }

  private get latitude(): number {
    return Number(this.config.get<string>('WEATHER_LATITUDE') ?? -7.19);
  }

  private get longitude(): number {
    return Number(this.config.get<string>('WEATHER_LONGITUDE') ?? 106.61);
  }

  private get cacheTtlSeconds(): number {
    return Number(this.config.get<string>('WEATHER_CACHE_TTL_SECONDS') ?? 900);
  }
}
