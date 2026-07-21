-- =====================================================
-- Portal Nettfront quotes (customer portal hub DB)
-- Mentés / PDF / megjegyzés itt él; tenantbe csak Megrendeléskor.
-- Futtatás: portal Supabase SQL Editor (oatbbtbkerxogzvwicxx)
-- =====================================================

-- 1) Header
CREATE TABLE IF NOT EXISTS public.portal_nettfront_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_customer_id uuid NOT NULL REFERENCES public.portal_customers (id) ON DELETE CASCADE,
  target_company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  quote_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted')),

  discount_percent numeric(5, 2) NOT NULL DEFAULT 0,

  lines_total_net numeric(12, 2) NOT NULL DEFAULT 0,
  lines_total_vat numeric(12, 2) NOT NULL DEFAULT 0,
  lines_total_gross numeric(12, 2) NOT NULL DEFAULT 0,

  services_total_net numeric(12, 2) NOT NULL DEFAULT 0,
  services_total_vat numeric(12, 2) NOT NULL DEFAULT 0,
  services_total_gross numeric(12, 2) NOT NULL DEFAULT 0,

  total_net numeric(12, 2) NOT NULL DEFAULT 0,
  total_vat numeric(12, 2) NOT NULL DEFAULT 0,
  total_gross numeric(12, 2) NOT NULL DEFAULT 0,
  final_total_after_discount numeric(12, 2) NOT NULL DEFAULT 0,

  comment text NULL,
  customer_snapshot jsonb NULL,

  submitted_at timestamptz NULL,
  submitted_to_company_quote_id uuid NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT portal_nettfront_quotes_quote_number_key UNIQUE (quote_number)
);

CREATE INDEX IF NOT EXISTS idx_portal_nettfront_quotes_customer_status
  ON public.portal_nettfront_quotes (portal_customer_id, status);

CREATE INDEX IF NOT EXISTS idx_portal_nettfront_quotes_updated_at
  ON public.portal_nettfront_quotes (updated_at DESC);

-- 2) Lines (Inomat snapshot — no FK to tenant nettfront_skus)
CREATE TABLE IF NOT EXISTS public.portal_nettfront_quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_nettfront_quote_id uuid NOT NULL
    REFERENCES public.portal_nettfront_quotes (id) ON DELETE CASCADE,

  front_type text NOT NULL
    CHECK (front_type IN ('inomat', 'festett', 'folias', 'alu', 'akril')),
  nettfront_sku_id uuid NULL,

  sku_code text NOT NULL,
  display_name text NOT NULL,
  finish text CHECK (finish IS NULL OR finish IN ('matt', 'hg')),
  swatch_hex text NULL,
  cost_net_per_sqm numeric(12, 2) NOT NULL DEFAULT 0,
  sell_net_per_sqm numeric(12, 2) NOT NULL DEFAULT 0,
  vat_percent numeric(5, 2) NOT NULL DEFAULT 27,

  height_mm integer NOT NULL CHECK (height_mm > 0),
  width_mm integer NOT NULL CHECK (width_mm > 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  area_sqm numeric(14, 6) NOT NULL DEFAULT 0,

  line_net numeric(12, 2) NOT NULL DEFAULT 0,
  line_vat numeric(12, 2) NOT NULL DEFAULT 0,
  line_gross numeric(12, 2) NOT NULL DEFAULT 0,

  panthely jsonb NULL,
  panthely_holes_total integer NOT NULL DEFAULT 0 CHECK (panthely_holes_total >= 0),
  megjegyzes text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_nettfront_quote_lines_quote_id
  ON public.portal_nettfront_quote_lines (portal_nettfront_quote_id);

-- 3) Quote number NF-YYYY-NNN
CREATE OR REPLACE FUNCTION public.generate_portal_nettfront_quote_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  last_number INTEGER;
  new_number INTEGER;
  new_quote_number TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');

  LOOP
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING(quote_number FROM 'NF-' || current_year || '-(\d+)')
          AS INTEGER
        )
      ),
      0
    )
    INTO last_number
    FROM public.portal_nettfront_quotes
    WHERE quote_number LIKE 'NF-' || current_year || '-%';

    new_number := last_number + 1;
    new_quote_number := 'NF-' || current_year || '-' || LPAD(new_number::TEXT, 3, '0');

    IF NOT EXISTS (
      SELECT 1 FROM public.portal_nettfront_quotes WHERE quote_number = new_quote_number
    ) THEN
      RETURN new_quote_number;
    END IF;

    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique Nettfront quote number after % attempts', max_attempts;
    END IF;

    PERFORM pg_sleep(0.01);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.generate_portal_nettfront_quote_number() IS
  'Generates sequential Nettfront portal quote numbers: NF-YYYY-NNN';

-- 4) RLS
ALTER TABLE public.portal_nettfront_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_nettfront_quote_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Portal customers can insert own nettfront quotes"
  ON public.portal_nettfront_quotes;
CREATE POLICY "Portal customers can insert own nettfront quotes"
  ON public.portal_nettfront_quotes FOR INSERT TO authenticated
  WITH CHECK (portal_customer_id = auth.uid());

DROP POLICY IF EXISTS "Portal customers can read own nettfront quotes"
  ON public.portal_nettfront_quotes;
CREATE POLICY "Portal customers can read own nettfront quotes"
  ON public.portal_nettfront_quotes FOR SELECT TO authenticated
  USING (portal_customer_id = auth.uid());

DROP POLICY IF EXISTS "Portal customers can update own nettfront quotes"
  ON public.portal_nettfront_quotes;
CREATE POLICY "Portal customers can update own nettfront quotes"
  ON public.portal_nettfront_quotes FOR UPDATE TO authenticated
  USING (portal_customer_id = auth.uid())
  WITH CHECK (portal_customer_id = auth.uid());

DROP POLICY IF EXISTS "Portal customers can delete own nettfront quotes"
  ON public.portal_nettfront_quotes;
CREATE POLICY "Portal customers can delete own nettfront quotes"
  ON public.portal_nettfront_quotes FOR DELETE TO authenticated
  USING (portal_customer_id = auth.uid());

DROP POLICY IF EXISTS "Portal customers can insert own nettfront quote lines"
  ON public.portal_nettfront_quote_lines;
CREATE POLICY "Portal customers can insert own nettfront quote lines"
  ON public.portal_nettfront_quote_lines FOR INSERT TO authenticated
  WITH CHECK (
    portal_nettfront_quote_id IN (
      SELECT id FROM public.portal_nettfront_quotes WHERE portal_customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Portal customers can read own nettfront quote lines"
  ON public.portal_nettfront_quote_lines;
CREATE POLICY "Portal customers can read own nettfront quote lines"
  ON public.portal_nettfront_quote_lines FOR SELECT TO authenticated
  USING (
    portal_nettfront_quote_id IN (
      SELECT id FROM public.portal_nettfront_quotes WHERE portal_customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Portal customers can update own nettfront quote lines"
  ON public.portal_nettfront_quote_lines;
CREATE POLICY "Portal customers can update own nettfront quote lines"
  ON public.portal_nettfront_quote_lines FOR UPDATE TO authenticated
  USING (
    portal_nettfront_quote_id IN (
      SELECT id FROM public.portal_nettfront_quotes WHERE portal_customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Portal customers can delete own nettfront quote lines"
  ON public.portal_nettfront_quote_lines;
CREATE POLICY "Portal customers can delete own nettfront quote lines"
  ON public.portal_nettfront_quote_lines FOR DELETE TO authenticated
  USING (
    portal_nettfront_quote_id IN (
      SELECT id FROM public.portal_nettfront_quotes WHERE portal_customer_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_nettfront_quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_nettfront_quote_lines TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_portal_nettfront_quote_number() TO authenticated;
