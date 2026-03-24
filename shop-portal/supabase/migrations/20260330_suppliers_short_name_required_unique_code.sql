-- Promote suppliers.short_name to required unique supplier code (Beszállító kód)
-- Backfills missing values and de-duplicates collisions before constraints.

-- 1) Normalize whitespace for existing values
UPDATE public.suppliers
SET short_name = NULLIF(BTRIM(short_name), '')
WHERE short_name IS NOT NULL;

-- 2) Backfill missing codes with deterministic SUP-xxxxx format
WITH missing AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.suppliers
  WHERE short_name IS NULL
)
UPDATE public.suppliers s
SET short_name = 'SUP-' || LPAD(m.rn::text, 6, '0')
FROM missing m
WHERE s.id = m.id;

-- 3) De-duplicate active suppliers by normalized code (case-insensitive)
WITH ranked AS (
  SELECT
    id,
    BTRIM(short_name) AS base_code,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(BTRIM(short_name))
      ORDER BY created_at, id
    ) AS rn
  FROM public.suppliers
  WHERE deleted_at IS NULL
)
UPDATE public.suppliers s
SET short_name = ranked.base_code || '-' || ranked.rn::text
FROM ranked
WHERE s.id = ranked.id
  AND ranked.rn > 1;

-- 4) Enforce required field
ALTER TABLE public.suppliers
  ALTER COLUMN short_name SET NOT NULL;

-- 5) Enforce unique active code (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_short_name_unique_active
ON public.suppliers (LOWER(BTRIM(short_name)))
WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.suppliers.short_name IS
  'Beszállító kód (egyedi, kötelező). Felhasználói import/export azonosító.';
