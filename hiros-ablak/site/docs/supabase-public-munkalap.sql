-- Híros Ablak public munkalap catalog (no pricing)
--
-- Run manually in Supabase SQL editor.
-- Goal: expose a safe, indexable, read-only worktop catalog for the marketing site.
--
-- Source table: public.linear_materials
-- We expose these types on the marketing site:
-- - Munkalap
-- - Asztallap
-- - Hátfal
--
-- Requirements:
-- - Never expose price fields publicly
-- - Filter out deleted/inactive rows
-- - Keep SEO controls per item (slug + indexable_on_site)
--
-- Expected app env vars:
-- - NEXT_PUBLIC_SUPABASE_URL
-- - NEXT_PUBLIC_SUPABASE_ANON_KEY

-- 1) Ensure slug exists (stable, immutable after first publish)
ALTER TABLE public.linear_materials
  ADD COLUMN IF NOT EXISTS slug text;

-- 2) Optional: for SEO control later (index/noindex decisions)
-- Keep default false so nothing becomes indexable unless you opt in.
ALTER TABLE public.linear_materials
  ADD COLUMN IF NOT EXISTS indexable_on_site boolean NOT NULL DEFAULT false;

-- 3) Create a public view for the munkalap catalog
-- Note: linear_materials dimensions are decimals in mm in most setups.
-- We normalize to *_mm integer fields expected by the marketing UI.
CREATE OR REPLACE VIEW public.public_munkalap AS
SELECT
  lm.id,
  lm.slug,
  lm.name,
  b.name AS brand_name,
  CAST(ROUND(lm.length) AS integer) AS length_mm,
  CAST(ROUND(lm.width) AS integer) AS width_mm,
  CAST(ROUND(lm.thickness) AS integer) AS thickness_mm,
  lm.on_stock,
  lm.image_url,
  lm.updated_at,
  lm.indexable_on_site,
  lm.type AS type_name
FROM public.linear_materials lm
LEFT JOIN public.brands b ON lm.brand_id = b.id
WHERE lm.deleted_at IS NULL
  AND lm.active = true
  AND lm.type IN ('Munkalap', 'Asztallap', 'Hátfal');

-- 4) Read access for anon/authenticated on the VIEW only.
GRANT SELECT ON public.public_munkalap TO anon, authenticated;

-- 5) Suggested indexes for fast filtering/search (optional)
-- CREATE INDEX IF NOT EXISTS linear_materials_slug_idx ON public.linear_materials (slug) WHERE deleted_at IS NULL;
-- CREATE INDEX IF NOT EXISTS linear_materials_on_stock_idx ON public.linear_materials (on_stock) WHERE deleted_at IS NULL;
-- CREATE INDEX IF NOT EXISTS linear_materials_thickness_idx ON public.linear_materials (thickness) WHERE deleted_at IS NULL;
