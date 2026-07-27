-- =====================================================
-- Ügyfélajánlatok (asztalos → saját ügyfél) mentése
-- Futtasd manuálisan a portal Supabase-en.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.portal_customer_quote_sequences (
  year INT PRIMARY KEY,
  last_number INT NOT NULL
);

COMMENT ON TABLE public.portal_customer_quote_sequences IS
  'UA-YYYY-NNN sorszám számláló ügyfélajánlatokhoz.';

CREATE OR REPLACE FUNCTION public.generate_portal_customer_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
  next_number INT;
BEGIN
  INSERT INTO public.portal_customer_quote_sequences AS seq (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = seq.last_number + 1
  RETURNING seq.last_number
  INTO next_number;

  RETURN 'UA-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_portal_customer_quote_number() IS
  'Generates unique customer-facing quote numbers (UA-YYYY-NNN).';

GRANT EXECUTE ON FUNCTION public.generate_portal_customer_quote_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_portal_customer_quote_number() TO service_role;

CREATE TABLE IF NOT EXISTS public.portal_customer_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_pdf_at timestamptz,
  portal_customer_id uuid NOT NULL
    REFERENCES public.portal_customers (id) ON DELETE CASCADE,
  quote_number text NOT NULL,
  buyer_name text NOT NULL DEFAULT '',
  project_title text,
  payable_gross integer NOT NULL DEFAULT 0
    CHECK (payable_gross >= 0),
  sources_summary text NOT NULL DEFAULT 'manual',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT portal_customer_quotes_quote_number_key UNIQUE (quote_number)
);

CREATE INDEX IF NOT EXISTS idx_portal_customer_quotes_customer_updated
  ON public.portal_customer_quotes (portal_customer_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_customer_quotes_customer_created
  ON public.portal_customer_quotes (portal_customer_id, created_at DESC);

COMMENT ON TABLE public.portal_customer_quotes IS
  'Mentett ügyfélajánlatok (studio PDF). payload = szerkesztő form; snapshot = PDF tételek mentéskor.';

CREATE OR REPLACE FUNCTION public.set_portal_customer_quotes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_customer_quotes_updated_at ON public.portal_customer_quotes;
CREATE TRIGGER trg_portal_customer_quotes_updated_at
  BEFORE UPDATE ON public.portal_customer_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_portal_customer_quotes_updated_at();

ALTER TABLE public.portal_customer_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Portal customers can select own customer quotes"
  ON public.portal_customer_quotes;
CREATE POLICY "Portal customers can select own customer quotes"
  ON public.portal_customer_quotes
  FOR SELECT
  TO authenticated
  USING (portal_customer_id = auth.uid());

DROP POLICY IF EXISTS "Portal customers can insert own customer quotes"
  ON public.portal_customer_quotes;
CREATE POLICY "Portal customers can insert own customer quotes"
  ON public.portal_customer_quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (portal_customer_id = auth.uid());

DROP POLICY IF EXISTS "Portal customers can update own customer quotes"
  ON public.portal_customer_quotes;
CREATE POLICY "Portal customers can update own customer quotes"
  ON public.portal_customer_quotes
  FOR UPDATE
  TO authenticated
  USING (portal_customer_id = auth.uid())
  WITH CHECK (portal_customer_id = auth.uid());

DROP POLICY IF EXISTS "Portal customers can delete own customer quotes"
  ON public.portal_customer_quotes;
CREATE POLICY "Portal customers can delete own customer quotes"
  ON public.portal_customer_quotes
  FOR DELETE
  TO authenticated
  USING (portal_customer_id = auth.uid());

COMMIT;
