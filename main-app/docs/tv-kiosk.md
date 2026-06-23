# TV kiosk dashboard (`/tv`)

Full-screen dashboard for a wall-mounted TV (40–43″, 2–3 m viewing distance). Requires `/tv` page permission.

## URLs

| URL | Purpose |
|-----|---------|
| `/tv` | **Portrait kiosk (default, 1080×1920)** — 2-column chart wall |
| `/tv?orientation=landscape` | Landscape kiosk (1920×1080) |
| `/tv?preview=kiosk` | Scaled portrait preview on MacBook |
| `/tv?preview=kiosk&orientation=landscape` | Landscape preview on MacBook |
| `/tv?preview=laptop` | Dev mode — scrollable, full attendance detail |
| `/tv?theme=dark` | Dark theme |

## Layout

Charts show **Mon–Fri only** (no Saturday column).

### Portrait (default) — two-column layout

```
┌──────────────────────────────────────────┐
│  HEADER (full width)                     │
├────────────────────┬─────────────────────┤
│  Heti szabás       │  Elmaradás (stacked) │
│  (chart)           ├─────────────────────┤
│                    │  Jelenlét (table)    │
├────────────────────┤                     │
│  Heti élzárás      │                     │
│  (chart)           │  (több hely)        │
├────────────────────┤                     │
│  Forgalom chart    │                     │
└────────────────────┴─────────────────────┘
```

Left: production charts + foot traffic (hourly chart). Right: backlog + attendance (taller person rows).

### Landscape (`?orientation=landscape`)

```
Fejléc → Elmaradás sáv → Heti szabás → Heti élzárás → Jelenlét → Forgalom
```

Full-width stacked rows (1920×1080).

## Setup

1. Run `supabase/migrations/20260617_add_tv_dashboard_page.sql`
2. Grant `/tv` to kiosk user in Users admin
3. Optional `.env.local`: `TV_DASHBOARD_THEME=light`, `FOOTCOUNTER_STATS_DEVICE_SLUG=default`

## MacBook testing

- Portrait TV sim: `/tv?preview=kiosk`
- Landscape TV sim: `/tv?preview=kiosk&orientation=landscape`
- Dev: `/tv?preview=laptop`

## Kiosk browser

1. Log in as TV user
2. Open `/tv` fullscreen (F11) — portrait by default
3. Data refreshes every 90s
