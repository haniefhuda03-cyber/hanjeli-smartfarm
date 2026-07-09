# Batch 4 - Completion Report

> Sensor & Weather Intelligence | Status: COMPLETE
> Executed: 2026-06-09

## Summary

Batch 4 completes the backend sensor intelligence and weather proxy layer:

- Sensors module exposes latest readings, overview, trend, stats, history, streaming CSV export, and quality score.
- Trend and stats queries now use the B1 TimescaleDB continuous aggregate views: `sensor_hourly_stats` for day range and `sensor_daily_stats` for week/month ranges.
- SQL uses parameterized values for user/device/date filters, with only allowlisted view and column names.
- History uses scoped pagination and date filtering through TypeORM QueryBuilder.
- CSV export streams DB rows instead of building the whole file in memory.
- Weather module fetches Open-Meteo current weather, maps WMO weather codes to Indonesian labels/icons, and caches results for 15 minutes.
- Weather cache supports Redis when enabled and keeps an in-memory fallback for local/dev stability.

## Implemented Files

| Area | Files |
|------|-------|
| Sensors module | `hanjeli-be/src/modules/sensors/sensors.module.ts`, `sensors.controller.ts`, `sensors.service.ts` |
| Sensor DTOs | `hanjeli-be/src/modules/sensors/dto/sensor-query.dto.ts` |
| Weather module | `hanjeli-be/src/modules/weather/weather.module.ts`, `weather.controller.ts`, `weather.service.ts` |
| Config | `hanjeli-be/.env.example` |
| Tests | `hanjeli-be/src/modules/sensors/sensors.service.spec.ts`, `hanjeli-be/src/modules/weather/weather.service.spec.ts` |

## API Surface

All sensor endpoints require JWT and are under `/api/v3`:

- `GET /sensors/latest`
- `GET /sensors/overview`
- `GET /sensors/trend?param=ph&range=day`
- `GET /sensors/stats?param=ph&range=day`
- `GET /sensors/history?from=&to=&page=&limit=`
- `GET /sensors/export?from=&to=&format=csv`
- `GET /sensors/quality-score`

Weather endpoint:

- `GET /weather/current`

## Query And Data Notes

- Supported sensor params: `ph`, `ph_level`, `soil_moisture`, `soil_ec`, `soil_npk`, `temperature`.
- `param=ph` is normalized to the `ph_level` telemetry column and `avg_ph/max_ph/min_ph` aggregate columns.
- `range=day` queries `sensor_hourly_stats`; `range=week` and `range=month` query `sensor_daily_stats`.
- Device filters are scoped to authenticated user ownership before querying aggregates.
- `latest` returns the newest telemetry row per device.
- `overview` returns the newest telemetry row across the user's devices plus frontend-ready parameter cards.
- `quality-score` uses the latest five soil sensor values and returns Indonesian status text.
- Invalid `from > to` date ranges return `400 Bad Request`.

## Weather Notes

- Open-Meteo request verified successfully on 2026-06-09:
  - URL shape: `https://api.open-meteo.com/v1/forecast?...&current=temperature_2m,weather_code&timezone=Asia/Jakarta&forecast_days=1`
  - Response included `current.temperature_2m` and `current.weather_code`.
- Official reference checked: https://open-meteo.com/en/docs
- `.env.example` now includes `WEATHER_LATITUDE`, `WEATHER_LONGITUDE`, `WEATHER_CACHE_TTL_SECONDS`, `WEATHER_CACHE_DRIVER`, and `REDIS_URL`.
- Redis cache is enabled when `WEATHER_CACHE_DRIVER=redis` or a non-empty `REDIS_URL` is configured; otherwise memory cache is used.

## QA Coverage

| Requirement | Coverage |
|-------------|----------|
| Trend uses continuous aggregates | Unit test asserts `sensor_hourly_stats` and `AVG(avg_ph)` for day trend |
| Stats uses aggregate min/max/avg | Unit test asserts `sensor_daily_stats`, `MIN(min_moisture)`, `MAX(max_moisture)` |
| History pagination does not overlap | Unit test asserts page 2 uses `skip(20)` with limit 20 |
| Invalid date range rejected | Unit test expects `BadRequestException` |
| Quality score uses five sensor values | Unit test checks ideal pH/moisture/EC/NPK/temp returns score 100 |
| Weather response shape and labels | Unit test checks Open-Meteo current response maps to `Berawan` |
| Weather cache hit | Unit test checks second request is served from memory cache |
| Weather fallback | Unit test checks safe fallback when Open-Meteo returns 503 |

## Verification

| Command | Result |
|---------|--------|
| Open-Meteo live request | PASS - response contained `current.temperature_2m=25.8`, `current.weather_code=1` |
| `npm run test` | PASS - 10 suites, 26 tests |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS - 1 suite, 1 test |
| `npm audit --omit=dev` | PASS - 0 vulnerabilities |

## Operational Notes

- No new database tables or migrations were required for Batch 4.
- Live TimescaleDB extension availability was not tested against a running database in this session; the queries were aligned to B1 migrations that create the continuous aggregates with `time_bucket()` and `WITH (timescaledb.continuous)`.
- CSV export is streaming from TypeORM QueryBuilder, so it does not allocate the full history dataset before responding.
- Weather fallback keeps dashboard UX stable when the external API is temporarily unavailable.
