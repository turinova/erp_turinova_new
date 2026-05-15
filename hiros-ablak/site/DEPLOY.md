# Hírös-Ablak marketing site — Vercel deploy

## Monorepo root directory

In Vercel, set **Root Directory** to:

```text
hiros-ablak/site
```

Same pattern as `customer-portal/` (separate Vercel project, subfolder in `erp_turinova_new`).

## Environment variables

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (anon key only) |

See `.env.example`. Do not commit `.env.local`.

## Supabase

Run once on the production database (if not already):

- `docs/supabase-public-butorlap.sql`
- `docs/supabase-public-munkalap.sql`

## Domain (Rackhost)

After preview works on `*.vercel.app`, add `www.hirosablak.hu` in Vercel → Domains and point Rackhost DNS to Vercel.

## Static assets

Only `public/img/` is committed. The sibling `img/` folder is local source/archive (gitignored).

Photos from iPhone (Display P3) must be converted to **sRGB JPEG** before deploy, or Vercel’s `/_next/image` optimizer can return blank thumbnails. Re-encode with Sharp (`toColorspace("srgb")`) or export sRGB from an editor.
