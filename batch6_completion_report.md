# Batch 6 - Completion Report

> Cache, Polish & Integration | Status: COMPLETE
> Executed: 2026-06-09

## Summary

Batch 6 completes the backend polish layer:

- Redis-aware cache service with memory fallback and graceful degradation.
- Custom cache interceptor with per-endpoint TTL and mutation invalidation patterns.
- Cache applied to GET endpoints from the API design plan.
- MQTT and WebSocket-triggered invalidation for sensor and irrigation data.
- Swagger/OpenAPI setup at `/api/v3/docs`.
- DTO Swagger metadata added across request/query DTOs.
- Helmet security headers, env-aware CORS, global validation pipe, and field-level validation errors.
- Auth throttling kept on `@nestjs/throttler` v6 syntax without double-counting.

## Implemented Files

| Area | Files |
|------|-------|
| Cache config | `hanjeli-be/src/config/redis.config.ts` |
| Cache layer | `common/cache/app-cache.module.ts`, `common/cache/app-cache.service.ts` |
| Cache decorators/interceptor | `common/decorators/cache.decorator.ts`, `common/interceptors/cache.interceptor.ts` |
| Security/docs bootstrap | `hanjeli-be/src/main.ts` |
| Error shape | `common/filters/http-exception.filter.ts` |
| Controllers | Users, Devices, Notifications, Preferences, Sensors, Weather, Irrigation, Auth |
| DTOs | Auth, Users, Devices, Notifications, Preferences, Sensors, Irrigation, Pagination |
| Runtime config | `hanjeli-be/.env.example`, `package.json`, `package-lock.json` |
| Tests | Cache service/interceptor specs, updated e2e smoke mocks |

## Cache Coverage

| Endpoint | TTL | Key pattern |
|----------|-----|-------------|
| `GET /users/me` | 300s | `hanjeli:user:profile:{userId}` |
| `GET /users` | 120s | `hanjeli:users:list:{hash}` |
| `GET /devices` | 60s | `hanjeli:devices:{userId}` |
| `GET /devices/:id` | 60s | `hanjeli:devices:{userId}:{hash}` |
| `GET /notifications` | 30s | `hanjeli:notifications:{userId}:{hash}` |
| `GET /preferences` | 300s | `hanjeli:preferences:{userId}` |
| `GET /sensors/latest` | 10s | `hanjeli:sensor:latest:{userId}` |
| `GET /sensors/overview` | 10s | `hanjeli:sensor:overview:{userId}` |
| `GET /sensors/quality-score` | 30s | `hanjeli:sensor:quality:{userId}` |
| `GET /sensors/trend` | 60s | `hanjeli:sensor:trend:{userId}:{hash}` |
| `GET /sensors/stats` | 60s | `hanjeli:sensor:stats:{userId}:{hash}` |
| `GET /sensors/history` | 30s | `hanjeli:sensor:history:{userId}:{hash}` |
| `GET /weather/current` | 900s | `hanjeli:weather:current` |
| `GET /irrigation/config` | 10s | `hanjeli:irrigation:config:{userId}` |
| `GET /irrigation/schedules` | 60s | `hanjeli:irrigation:schedules:{userId}` |
| `GET /irrigation/activity` | 30s | `hanjeli:irrigation:activity:{userId}:{hash}` |

## Invalidation

- User profile and admin user mutations invalidate profile/list keys.
- Device CRUD invalidates device keys.
- Notification read/delete mutations invalidate notification list keys.
- Preference mutations invalidate preference keys.
- Irrigation config/schedule/activity changes invalidate irrigation keys.
- MQTT sensor ingest invalidates sensor latest/overview/quality/trend/stats/history keys and device keys.
- MQTT irrigation ACK invalidates irrigation activity cache.

## Security And Docs Notes

- `helmet` is enabled in `main.ts`; dev CSP is relaxed so Swagger UI remains usable.
- CORS allows localhost frontend origins and values from `FRONTEND_ORIGINS` or `FRONTEND_URL`.
- Swagger UI is available at `/api/v3/docs` with bearer auth persistence.
- DTO audit found no DTO file without `ApiProperty` or Swagger `PartialType` metadata.
- Validation errors keep the global error shape and include `fields` and `details`.
- `@Throttle({ default: { limit, ttl } })` syntax was verified against local `@nestjs/throttler` v6 types.
- Auth-specific `@Throttle` decorators run through the global `APP_GUARD`; duplicate local throttler guard was removed.

## Verification

| Command | Result |
|---------|--------|
| `npm run test` | PASS - 18 suites, 45 tests |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS - 1 suite, 1 test |
| `npm audit --omit=dev` | PASS - 0 vulnerabilities |
| Swagger module smoke check | PASS - `SwaggerModule.createDocument` loadable |
| DTO Swagger audit | PASS - no missing DTO metadata found |

## Operational Notes

- Redis is disabled by default: `REDIS_ENABLED=false`. APIs still cache in memory and continue working without Redis.
- Enable Redis with `REDIS_ENABLED=true` or a non-empty `REDIS_URL`.
- Cache keys are prefixed by `REDIS_KEY_PREFIX`, default `hanjeli`.
- Weather keeps its service-level 15-minute cache in addition to endpoint cache; both degrade safely.
- Root e2e smoke test still mocks DB/Auth/MQTT/WS/Cron modules because it validates the root HTTP health check without external services.
