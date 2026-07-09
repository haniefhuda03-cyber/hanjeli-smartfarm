# Hanjeli Smart Farm — Frontend

Smart-agriculture IoT dashboard. Operators monitor soil sensors and control irrigation across farm zones, in Bahasa Indonesia (English fallback).

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **UI:** Tailwind CSS v4, shadcn/ui + Radix primitives, recharts, sonner, lucide-react
- **i18n:** i18next + react-i18next (`src/i18n/locales/{id,en}.json`)
- **Realtime:** `socket.io-client` (installed, not yet wired)
- **Backend (planned):** PostgreSQL 15+ with **TimescaleDB** — schema in [`db.md`](./db.md)

Data is currently mocked in `src/lib/mock/` and `src/lib/services/`.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script              | Purpose                                              |
|---------------------|------------------------------------------------------|
| `npm run dev`       | Dev server                                           |
| `npm run build`     | Production build                                     |
| `npm start`         | Run the production build                             |
| `npm run lint`      | ESLint                                               |
| `npx tsc --noEmit`  | Type-check (no script alias; run directly)           |

## What the app shows

Five soil-sensor parameters across every page (pH, soil moisture, EC, NPK, soil temperature). Air humidity was deliberately removed from the UI — see `AGENTS.md` and `db.md` for details on why and how to keep it out.

Pages:
- `/home` — landing dashboard with the 5-sensor grid, IoT device list, and notification bell
- `/monitoring` — sensor cards, parameter dropdown, trend graph (day/week/month), history table
- `/irrigation` — Auto / Scheduled / Manual modes (mutually exclusive) + emergency stop, schedules, activity feed
- `/profile` — panel-based settings (language, 2FA, units, IoT device management, account)
- `/dev` — internal toast/UI-state playground

## Project layout

```
src/
├── app/             # Next.js App Router pages (all client components today)
├── components/
│   ├── ui/          # shadcn/ui primitives
│   └── icons/       # custom toast SVGs
├── contexts/        # React Contexts (notifications)
├── hooks/           # custom hooks
├── i18n/            # i18next config + locale JSON
└── lib/
    ├── mock/        # fixtures (sensor-fixtures.ts)
    ├── services/    # service layer + notification helpers
    └── utils.ts
```

## Conventions

- Indonesian-first. Every user-visible string goes through `t()`; new keys land in `id.json` first.
- Lucide icons only.
- Neomorphic styling — inline `boxShadow` (raised/inset), never gray/black flats. Tokens in `DESIGN.md`.
- Sensor IDs (`ph`, `soil_moisture`, `soil_ec`, `soil_npk`, `temperature`) are stable across the FE, locale files, and the DB schema.
- Before reporting a feature done: `npx tsc --noEmit` must pass; UI changes verified in browser; data-shape changes mirrored in `db.md`.

## Source-of-truth docs

| File          | What it covers                                                  |
|---------------|-----------------------------------------------------------------|
| `AGENTS.md`   | Agent rules + current FE state (routes, sensors, conventions)   |
| `CLAUDE.md`   | Single-line `@AGENTS.md` import (canonical Claude Code pattern) |
| `db.md`       | Full PostgreSQL + TimescaleDB schema                            |
| `DESIGN.md`   | Material 3 "Organic Vitality" palette + typography              |
