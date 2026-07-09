<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Hanjeli Smart Farm — Frontend

Next.js 16 (App Router) + React 19 + Tailwind 4 + i18next dashboard for a smart-farm IoT system. Data is currently mocked in `src/lib/mock/` and `src/lib/services/`; no real backend is wired yet.

## Stack at a glance

- **Frontend:** React 19 + Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui + Radix, recharts, i18next, sonner, socket.io-client (planned).
- **Backend (planned):** PostgreSQL 15+ with the **TimescaleDB** extension. High-frequency sensor data and irrigation events go into hypertables with compression + continuous aggregates; user/device/schedule/notification state lives in regular relational tables. The full schema is documented in `db.md`.
- **Realtime transport (planned):** Socket.IO for live sensor pushes and irrigation status; the client package is already installed but not wired.

## Routes

Auth/public (no dashboard chrome):
- `/` (root → redirect/landing), `/login`, `/register`, `/forgot-password`, `/reset-password`

Dashboard (wrapped by `DashboardLayout` — desktop sidebar + mobile bottom-nav):
- `/home` — landing dashboard
- `/monitoring` — sensor analytics & history
- `/irrigation` — irrigation control & scheduling
- `/profile` — settings & account

Dev:
- `/dev` — internal notification/toast/UI-state playground. Not part of the production user flow.

## Sensor parameters displayed

The FE currently surfaces **5 soil sensor parameters**. Air humidity was removed and must NOT be reintroduced into user-facing displays.

| ID (i18n key)       | Label (ID / EN)                  | Unit       | Icon (lucide) |
|---------------------|----------------------------------|------------|---------------|
| `sensor_ph`         | pH Tanah / Soil pH               | pH         | FlaskConical  |
| `sensor_moist`      | Kelembaban Tanah / Soil Moisture | %          | Droplet       |
| `sensor_ec`         | EC Tanah / Soil EC               | mS/cm      | Zap           |
| `sensor_npk`        | Kadar NPK / NPK Level            | mg/kg      | Leaf          |
| `sensor_temp`       | Suhu Tanah / Soil Temperature    | °C         | Thermometer   |

These keys live in `src/i18n/locales/{id,en}.json` under `home.*`. The same five IDs are used as the `parameterOptions` in `monitoring/page.tsx`, `sensorParameters` in `irrigation/page.tsx`, and `measurementUnits` in `profile/page.tsx`. If you add or remove a parameter, update all four call sites plus the two locale files together — they are intentionally kept in sync.

> Note: `notify.humidity` still exists in `src/lib/services/notification-helpers.ts` and `HumidityIcon` in `src/components/icons/toast-icons.tsx`. These are unused infrastructure pieces (kept to avoid churn in the notification registry); do not call them from user-facing pages.

## What each page renders

**Home (`src/app/home/page.tsx`)**
- Hero header with date, greeting, weather chip (24°C, Cerah), notification bell, avatar.
- "Kondisi Lahan" section: a "Kualitas Lahan" score card (computed from the 5 sensors' statusColor) + a 5-tile sensor grid + info note (fallback text mentions "5 parameter").
- "Perangkat IoT" section: 4 hardcoded devices (pump, soil-moisture sensor, temp/humidity sensor, camera) with status pills.

**Monitoring (`src/app/monitoring/page.tsx`)**
- Sticky header.
- `sensorOverview` cards (5 of them) including a special NPK card with N/P/K bars.
- Parameter dropdown driving:
  - `dataSummary` (max/min/avg) cards.
  - Trend graph (`recharts` `AreaChart`) with day/week/month toggle and click-to-lock reference dot.
- History table: timestamp, ph, moist, ec, npk, temp, status. Date range filter + Ekspor button (non-functional). Pagination (5 pages, mock).

**Irrigation (`src/app/irrigation/page.tsx`)**
- Three exclusive modes: Auto / Scheduled / Manual (toggling one clears the others). Emergency-stop override disables all.
- Auto mode: parameter selector (5 sensors) + threshold (below/above) preview.
- Scheduled mode: list of `ScheduleEntry` objects with day chips, time range, name; add/edit via modal.
- Manual mode: speed slider + behavior rule.
- Recent activity feed.

**Profile (`src/app/profile/page.tsx`)**
- Single page that swaps between panels via `activePanel` state: `main` / `language` / `password` / `editProfile` / `2fa` / `iotStatus` / `units` / `deleteAccount` / `addDevice` / `forgotPassword`.
- Measurement units: 5 parameter rows (no humidity).
- Full account/security flows: password change, 2FA enable→QR→verify→recovery codes, account deletion with type-to-confirm + password + optional 2FA.

## Conventions

- **Indonesian-first.** Default language is `id` (set in `src/i18n/`); English is a fallback. All user-visible strings must route through `t()` with an `id` translation. New keys go in `src/i18n/locales/id.json` first, then mirrored to `en.json`.
- **Lucide icons only.** No mixed icon libraries. Toast/notification SVGs live in `src/components/icons/toast-icons.tsx`.
- **shadcn/ui + Radix primitives** under `src/components/ui/`. Composite layout pieces (`dashboard-layout.tsx`, `sidebar.tsx`, `bottom-navigation.tsx`, `app-navigation.tsx`) live one level up. `components.json` configures the shadcn generator.
- **Styling.** Tailwind 4 (via `@tailwindcss/postcss`). Neomorphic look — heavy use of inline `boxShadow` for inset/outset effects. Color tokens live in `DESIGN.md` (Material 3 "Organic Vitality" palette); primary green is `#006c49`, surface `#faf9f4`, warning `#f9bd22`, error `#ba1a1a`.
- **Client components by default for routes.** Every `page.tsx` under `app/` begins with `"use client"` because they rely on state, i18n hooks, and event handlers. Server components are not used yet.
- **State is local + Context.** No Redux / Zustand. Notifications use `src/contexts/notification-context.tsx` (Sonner toast + bell). Persisted via `localStorage` key `hanjeli_notifications`.
- **Mock data lives in `src/lib/`.** Don't add new mock fixtures into component files; extend `lib/mock/sensor-fixtures.ts` or `lib/services/`.
- **Realtime.** `socket.io-client` is installed but not yet wired. When you wire it, isolate the socket inside a service module — do not import `io` directly from page components.

## Workflow

```bash
npm run dev      # next dev (port 3000)
npm run build    # production build
npm run lint     # eslint
npx tsc --noEmit # type-check (no script alias; run directly)
```

Before reporting a feature complete:
1. `npx tsc --noEmit` must pass.
2. If you touched UI, open the affected route in the browser and verify both `id` and `en` translations render.
3. Sensor lists, locale files, and the per-page parameter arrays must remain in sync (see the table above).
4. If your change implies a data-shape change, update `db.md` in the same commit — the SQL schema there is the contract the backend has to honor.
