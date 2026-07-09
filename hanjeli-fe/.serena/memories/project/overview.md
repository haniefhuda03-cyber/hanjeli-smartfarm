# Hanjeli Smart Farm Frontend

## Purpose
Smart-agriculture IoT dashboard. Operators monitor soil sensors and control irrigation across farm zones.

## Tech Stack
- **Framework**: Next.js 16 with App Router (`src/app/`), React 19
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`) + `tw-animate-css`
- **UI**: Radix UI primitives + shadcn/ui (`src/components/ui/`)
- **Charts**: recharts (used by `/monitoring` trend graph)
- **Icons**: lucide-react (only)
- **Forms**: react-hook-form + zod
- **State**: local `useState` + React Context (`src/contexts/notification-context.tsx`). No Redux/Zustand.
- **i18n**: i18next + react-i18next, JSON files under `src/i18n/locales/{id,en}.json`. Default `id`. **No Google Translate**.
- **Toasts**: sonner (wrapped by a custom toast renderer)
- **Realtime**: `socket.io-client` is installed but not yet wired

## Backend (planned, documented in `db.md`)
- **PostgreSQL 15+** with the **TimescaleDB** extension
- Hypertables for `sensor_readings` and `irrigation_events`
- Continuous aggregates (`sensor_readings_hourly`, `sensor_readings_daily`) feed the monitoring day/week/month toggle
- Standard relational tables for users, devices, zones, schedules, notifications

## Sensor parameters (5 total)
Air humidity was removed and must not return.

| id (i18n key)    | label (ID)       | unit  |
|------------------|------------------|-------|
| `sensor_ph`      | pH Tanah         | pH    |
| `sensor_moist`   | Kelembaban Tanah | %     |
| `sensor_ec`      | EC Tanah         | mS/cm |
| `sensor_npk`     | Kadar NPK        | mg/kg |
| `sensor_temp`    | Suhu Tanah       | °C    |

These IDs are mirrored across `home/page.tsx` (`sensors`), `monitoring/page.tsx` (`parameterOptions`), `irrigation/page.tsx` (`sensorParameters`), `profile/page.tsx` (`measurementUnits`), and both locale files. Keep them in sync.

## Key Pages
- `/login`, `/register`, `/forgot-password`, `/reset-password` — auth flow (no dashboard chrome)
- `/home` — landing dashboard (5-sensor grid, IoT device list, notification bell)
- `/monitoring` — sensor cards, parameter dropdown, recharts trend graph, history table
- `/irrigation` — Auto / Scheduled / Manual modes (mutually exclusive) + emergency stop
- `/profile` — panel-based settings (`activePanel` state machine: main / language / password / editProfile / 2fa / iotStatus / units / deleteAccount / addDevice / forgotPassword)
- `/dev` — internal toast/UI-state playground (not part of user flow)

## Structure
- `src/app/` — Next.js App Router pages (every route is a client component)
- `src/components/` — shared layout pieces (`dashboard-layout.tsx`, `sidebar.tsx`, `bottom-navigation.tsx`)
- `src/components/ui/` — shadcn/ui primitives
- `src/components/icons/` — custom toast SVGs (`HumidityIcon` exists but unused in production pages)
- `src/contexts/` — React Contexts (notifications)
- `src/hooks/` — custom hooks
- `src/i18n/` — i18next setup + `locales/{id,en}.json`
- `src/lib/mock/` — fixtures (`sensor-fixtures.ts`)
- `src/lib/services/` — service layer (`sensor-service.ts`, `notification-helpers.ts`, `mock-api.ts`)

## Source-of-truth docs in this repo
- `AGENTS.md` — agent rules + FE state map (Claude/Codex/etc. read this)
- `CLAUDE.md` — single line `@AGENTS.md` import
- `db.md` — full PostgreSQL + TimescaleDB schema; the contract the backend must honor
- `DESIGN.md` — Material 3 "Organic Vitality" color palette + typography
