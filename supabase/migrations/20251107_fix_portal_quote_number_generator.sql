-- =====================================================
-- Fix portal quote number generator to avoid duplicates
-- =====================================================
-- - Introduces a dedicated sequence table to track numbers per year
-- - Replaces the generator function with an atomic upsert-based version
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.portal_quote_sequences (
  year INT PRIMARY KEY,
  last_number INT NOT NULL
);

COMMENT ON TABLE public.portal_quote_sequences IS 'Stores the last generated portal quote number per year to ensure unique PQ-YYYY-NNN sequences.';

CREATE OR REPLACE FUNCTION public.generate_portal_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  current_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
  next_number INT;
BEGIN
  INSERT INTO public.portal_quote_sequences AS seq (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = seq.last_number + 1
  RETURNING seq.last_number
  INTO next_number;

  RETURN 'PQ-' || current_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_portal_quote_number() IS 'Generates unique portal quote numbers (PQ-YYYY-NNN) using portal_quote_sequences for atomic increments.';

COMMIT;

