# Batch 2 - Completion Report

> Auth & Security Core | Status: COMPLETE
> Executed: 2026-06-09

## Summary

Batch 2 implements the backend authentication and security foundation for Hanjeli SmartFarm:

- JWT access/refresh authentication.
- Google OAuth redirect/callback flow.
- Email verification and forgot/reset password through SMTP.
- TOTP 2FA setup, enable, verify, disable.
- One-time recovery codes stored as bcrypt hashes.
- Shared guards, decorators, pagination DTO, validation, throttling, and error response filter.
- Runtime npm audit fixed to 0 vulnerabilities.

## Implemented Files

| Area | Files |
|------|-------|
| Common guards | `hanjeli-be/src/common/guards/jwt-auth.guard.ts`, `roles.guard.ts` |
| Common decorators | `current-user.decorator.ts`, `roles.decorator.ts` |
| Common DTO/filter/types | `pagination.dto.ts`, `http-exception.filter.ts`, `authenticated-user.interface.ts` |
| Auth module | `auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `auth-email.service.ts` |
| Auth strategies | `strategies/jwt.strategy.ts`, `strategies/google.strategy.ts` |
| Auth DTOs | `register`, `login`, `refresh`, `verify-email`, `forgot/reset`, `2FA`, `recovery` DTOs |
| Config | `app.module.ts`, `main.ts`, `.env.example`, `package.json`, `package-lock.json` |
| Tests | Auth service unit tests, JWT guard tests, roles guard tests, e2e root test config |

## API Surface

All endpoints are under `/api/v3`:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/2fa/setup`
- `POST /auth/2fa/enable`
- `POST /auth/verify-2fa`
- `POST /auth/verify-recovery`
- `DELETE /auth/2fa`
- `GET /auth/google`
- `GET /auth/google/callback`

## Security Notes

- Passwords and recovery codes use `bcryptjs`.
- JWT payloads exclude password hashes, TOTP secrets, and recovery code data.
- TOTP secret storage uses PostgreSQL `pgcrypto` via parameterized SQL.
- Email/reset tokens are opaque one-time tokens; only HMAC hashes are stored in `auth_tokens`.
- Reset tokens are invalidated after password changes through a password-state HMAC.
- Auth-sensitive routes use `@nestjs/throttler`.
- Global validation uses `whitelist`, `forbidNonWhitelisted`, and `transform`.
- Global error response shape: `{ success, statusCode, message, error, path, timestamp }`.

## Verification

| Command | Result |
|---------|--------|
| `npm run build` | PASS |
| `npm run test` | PASS - 4 suites, 12 tests |
| `npm run test:e2e` | PASS - existing root e2e with DB/Auth module mocked |
| `npm audit --omit=dev` | PASS - 0 vulnerabilities |

## Operational Notes

- Real SMTP values must be configured in `hanjeli-be/.env` before register, verification, or password reset email can work.
- Real Google OAuth values must be configured before `/auth/google` is usable.
- The e2e root test mocks TypeORM DB connection because the local PostgreSQL/TimescaleDB service was not reachable during verification.
- Migration 16 adds `auth_tokens`, so the backend now has 13 tables while preserving BCNF-style normalized token storage.
