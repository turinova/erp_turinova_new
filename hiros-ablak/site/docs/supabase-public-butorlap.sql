-- Híros Ablak public bútorlap catalog (no pricing)
--
-- Run manually in Supabase SQL editor.
-- Goal: expose a safe, indexable, read-only catalog for the marketing site.
--
-- Requirements:
-- - Never expose price fields publicly
-- - Show both on_stock=true (Raktáron) and on_stock=false (Rendelhető)
-- - Filter out deleted/inactive materials
--
-- Expected app env vars:
-- - NEXT_PUBLIC_SUPABASE_URL
-- - NEXT_PUBLIC_SUPABASE_ANON_KEY

-- 1) Ensure slug exists (stable, immutable after first publish)
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS slug text;

-- 2) Optional: for SEO control later (index/noindex decisions)
-- We keep it nullable/default false so nothing changes unless you opt in.
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS indexable_on_site boolean NOT NULL DEFAULT false;

-- 3) Create a public view for the bútorlap catalog
CREATE OR REPLACE VIEW public.public_butorlap AS
SELECT
  m.id,
  m.slug,
  m.name,
  b.name AS brand_name,
  g.name AS group_name,
  m.length_mm,
  m.width_mm,
  m.thickness_mm,
  m.grain_direction,
  m.on_stock,
  m.image_url,
  m.updated_at,
  m.indexable_on_site
FROM public.materials m
LEFT JOIN public.brands b ON m.brand_id = b.id
LEFT JOIN public.material_groups g ON m.group_id = g.id
WHERE m.deleted_at IS NULL
  AND m.active = true;

-- 4) Read access for anon/authenticated on the VIEW only.
-- Note: Postgres views use the underlying table privileges unless you use
-- SECURITY INVOKER/DEFINER patterns. Simplest: grant select on view and keep
-- table protected by RLS (recommended).
GRANT SELECT ON public.public_butorlap TO anon, authenticated;

-- 5) Make sure materials table has RLS so anon cannot access private columns.
-- (If you already have RLS enabled with policies, keep them as-is.)
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Minimal safe policy: deny direct table reads for anon/authenticated.
-- Your main-app likely has its own policies; if so, do NOT blindly apply these.
-- Uncomment only if you need strict denial.
-- DROP POLICY IF EXISTS "deny_anon_read_materials" ON public.materials;
-- CREATE POLICY "deny_anon_read_materials"
--   ON public.materials FOR SELECT TO anon
--   USING (false);
-- DROP POLICY IF EXISTS "deny_auth_read_materials" ON public.materials;
-- CREATE POLICY "deny_auth_read_materials"
--   ON public.materials FOR SELECT TO authenticated
--   USING (false);

-- 6) Suggested indexes for fast filtering/search (optional)
-- CREATE INDEX IF NOT EXISTS materials_slug_idx ON public.materials (slug) WHERE deleted_at IS NULL;
-- CREATE INDEX IF NOT EXISTS materials_on_stock_idx ON public.materials (on_stock) WHERE deleted_at IS NULL;
-- CREATE INDEX IF NOT EXISTS materials_thickness_idx ON public.materials (thickness_mm) WHERE deleted_at IS NULL;
