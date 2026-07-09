import { ConfigService } from '@nestjs/config';
import { WeatherService } from './weather.service.js';

function createConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('WeatherService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('fetches Open-Meteo current weather and maps Indonesian labels', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        current: {
          time: '2026-06-09T10:00',
          temperature_2m: 25.8,
          weather_code: 1,
        },
      }),
    })) as never;

    const service = new WeatherService(createConfig());

    await expect(service.getCurrentWeather()).resolves.toMatchObject({
      temp: 25.8,
      temperature: 25.8,
      weather_code: 1,
      condition: 'Berawan',
      icon: 'cloud-sun',
      cached: false,
      source: 'open-meteo',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
      'current=temperature_2m%2Cweather_code',
    );
  });

  it('serves the second request from memory cache', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        current: {
          time: '2026-06-09T10:00',
          temperature_2m: 24,
          weather_code: 0,
        },
      }),
    })) as never;

    const service = new WeatherService(
      createConfig({ WEATHER_CACHE_TTL_SECONDS: '900' }),
    );

    const first = await service.getCurrentWeather();
    const second = await service.getCurrentWeather();

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.condition).toBe('Cerah');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns a safe fallback when Open-Meteo is unavailable', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as never;

    const service = new WeatherService(createConfig());

    await expect(service.getCurrentWeather()).resolves.toMatchObject({
      temp: 24,
      condition: 'Cerah',
      source: 'fallback',
    });
  });
});
