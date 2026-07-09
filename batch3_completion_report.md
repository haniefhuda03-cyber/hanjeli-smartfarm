# Batch 3 - Completion Report

> Core CRUD Modules | Status: COMPLETE
> Executed: 2026-06-09

## Summary

Batch 3 completes the authenticated backend CRUD foundation for Hanjeli SmartFarm:

- Users admin CRUD with role guard, search/filter pagination, soft delete, and self-delete protection.
- User profile read/update/delete with sanitized responses and password hashing when changed.
- Devices CRUD scoped to the authenticated user, including normalized device codes and telemetry delete protection.
- Notifications list/read/delete flows scoped to the authenticated user, including read-all safety.
- Preferences, measurement units, notification preferences, and sensor thresholds with default creation and validation.
- Shared domain constants and user presenter to keep DTO validation and response sanitization consistent.

## Implemented Files

| Area | Files |
|------|-------|
| Shared constants/presenter | `hanjeli-be/src/common/constants/domain.constants.ts`, `hanjeli-be/src/common/presenters/user.presenter.ts` |
| Users module | `users.controller.ts`, `users.service.ts`, `dto/create-user.dto.ts`, `dto/update-user.dto.ts`, `dto/update-profile.dto.ts`, `dto/query-users.dto.ts` |
| Devices module | `devices.controller.ts`, `devices.service.ts`, `devices.module.ts`, `dto/create-device.dto.ts`, `dto/update-device.dto.ts` |
| Notifications module | `notifications.controller.ts`, `notifications.service.ts`, `dto/query-notifications.dto.ts` |
| Preferences module | `preferences.controller.ts`, `preferences.service.ts`, `dto/update-preference.dto.ts`, `dto/update-unit.dto.ts`, `dto/update-notification-pref.dto.ts`, `dto/update-sensor-threshold.dto.ts` |
| Test support | `users.service.spec.ts`, `devices.service.spec.ts`, `notifications.service.spec.ts`, `preferences.service.spec.ts`, `test/app.e2e-spec.ts` |
| Dependencies | `package.json`, `package-lock.json` include `@nestjs/mapped-types` |

## API Surface

All endpoints are under `/api/v3` from the global prefix:

- `GET /users`
- `POST /users`
- `PUT /users/:id`
- `DELETE /users/:id`
- `GET /users/me`
- `PUT /users/me`
- `DELETE /users/me`
- `GET /devices`
- `GET /devices/:id`
- `POST /devices`
- `PUT /devices/:id`
- `DELETE /devices/:id`
- `GET /notifications`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`
- `DELETE /notifications`
- `DELETE /notifications/:id`
- `GET /preferences`
- `PUT /preferences`
- `PUT /preferences/units`
- `PUT /preferences/notification-prefs`
- `PUT /preferences/sensor-thresholds`

## Security And Data Notes

- Admin users endpoints use `@UseGuards(JwtAuthGuard, RolesGuard)` with `@Roles('Admin')`.
- User responses are sanitized through `toPublicUser`, excluding password hash, 2FA secret, and recovery code data.
- Admin delete blocks deleting the currently authenticated admin account.
- Device delete checks existing telemetry and returns `409 Conflict` instead of deleting devices that already have readings.
- Notification `read-all` and delete operations are scoped by `user_id`, so they cannot update another user's notifications.
- Preference rows, measurement units, notification preferences, and sensor thresholds are auto-created with defaults when missing.
- `parameter_key`, language, notification channel/type, user role, device type, and device status all use explicit allowlists.
- Profile avatar currently validates `avatar_url` values only. There is no multipart avatar upload endpoint in Batch 3, so binary file type and size validation should be added when upload support is introduced.

## QA Coverage

| Requirement | Coverage |
|-------------|----------|
| Admin CRUD cannot delete self | `UsersService.remove` unit test |
| Guest/admin route guard order | Controller uses class-level `JwtAuthGuard` then `RolesGuard`; Batch 2 guard tests remain passing |
| Pagination response format | Users and notifications return `{ data, meta: { page, limit, total, totalPages, hasNextPage, hasPreviousPage } }` |
| Device delete blocked with telemetry | `DevicesService.remove` unit test |
| Read-all scoped to owner | `NotificationsService.markAllAsRead` unit test |
| Invalid preference unit parameter rejected | DTO allowlist plus `PreferencesService.updateUnit` unit test |
| Sanitized user payload | `UsersService` unit tests verify password hash is excluded |

## Verification

| Command | Result |
|---------|--------|
| `npm run test` | PASS - 8 suites, 18 tests |
| `npm run test:e2e` | PASS - 1 suite, 1 test |
| `npm run build` | PASS |
| `npm audit --omit=dev` | PASS - 0 vulnerabilities |

## Operational Notes

- No new database tables or migrations were required for Batch 3.
- Existing soft-delete columns are used through TypeORM `softRemove`.
- The root e2e test still mocks the database/AuthModule path because local database connectivity is outside this Batch 3 verification.
- Before production use, configure real auth/SMTP/OAuth environment values from Batch 2 and run migrations against the target PostgreSQL/TimescaleDB instance.
