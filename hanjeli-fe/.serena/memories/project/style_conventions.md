# Style & Conventions — Organic Vitality Theme

Full tokens live in `DESIGN.md` at the repo root. This file is the quick reference.

## Colors (Material 3 "Organic Vitality")
- Primary: `#006c49` (Emerald Lush)
- Primary container: `#10b981`
- Background / surface: `#fbfaee` (Earth Cream); cards often use `#faf9f4`
- Surface variant / muted: `#e4e3d7`
- Text (on-surface): `#1b1c15` (Soil Text)
- Text variant: `#3c4a42`
- Outline-variant: `#bbcabf`
- Secondary: `#795900` / `#f9bd22` (Sun Yellow)
- Tertiary: `#446900` / `#78b300` (Leaf Lime)
- Error: `#ba1a1a`
- Warning text: `#795900` over `#f9bd22` tints

## Font
- **Lexend** (weights 300-700)
- CSS variable: `--font-lexend`

## Look & feel — neomorphic
Heavy use of **inline `boxShadow`** (not Tailwind shadow utilities) to produce the neomorphic raised/inset look:
- Raised card: `6px 6px 14px rgba(163,158,140,0.35), -6px -6px 14px rgba(255,255,253,0.8)`
- Inset (pressed/groove): `inset 2px 2px 5px rgba(163,158,140,0.4), inset -2px -2px 5px rgba(255,255,253,0.9)`
- Hover lift: bump shadow magnitude + `translateY(-2px)` on `onMouseEnter`
- Active green glow: `0 2px 8px rgba(0,108,73,0.25)`
- Glassmorphism on hero header: `bg-white/15 backdrop-blur-md border border-white/25`
- **No gray/black flat shadows.** Always tinted.

## Component patterns
- Rounded corners: `rounded-xl` (1rem) for cards/buttons, `rounded-2xl` (1.5rem) for large sections, `rounded-full` for chips/avatars
- Press feedback: `active:scale-[0.98]` or `active:scale-95`
- Status pills: `bg-[#10b981]/15 text-[#006c49]` (good), `bg-[#f9bd22]/15 text-[#795900]` (warning), `bg-[#ba1a1a]/10 text-[#ba1a1a]` (error)
- Profile sub-pages: swap views via `activePanel` state (no nested routes)
- Icons exclusively from `lucide-react`. Custom SVGs (toast icons) live in `src/components/icons/toast-icons.tsx`.
- Switches: `data-[state=checked]:bg-[#006c49]`

## Language & i18n
- Default UI language: **Bahasa Indonesia** (`id`); English is fallback.
- Translation files: `src/i18n/locales/{id,en}.json`. **No Google Translate** — every string is hand-translated.
- All user-visible text MUST go through `t(...)`. New keys land in `id.json` first, then mirrored to `en.json`.
- Common section namespaces: `home.*`, `monitoring.*`, `irrigation.*`, `profile.*`, `auth.*`, `nav.*`.

## Code conventions
- Every route file starts with `"use client"` — server components are not used yet.
- Tailwind classes inline; no CSS modules.
- Prefer composing `cn()` from `@/lib/utils` instead of string concat for conditional classes.
- Sensor parameter IDs and units must stay in sync across pages and `db.md` (see overview).
