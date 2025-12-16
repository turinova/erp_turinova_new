-- Fix client offer number generation to use lpad instead of format() with %d
-- PostgreSQL's format() function doesn't support %d for bigint types
-- Use lpad to zero-pad the sequence number to 7 digits

CREATE OR REPLACE FUNCTION public.generate_client_offer_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text := to_char(now() at time zone 'UTC', 'YYYY');
  v_seq bigint;
  v_number text;
BEGIN
  v_seq := nextval('public.client_offer_seq');
  -- Format: CLO-YYYY-0000001 (7 digits, use lpad because format() has no %d specifier)
  v_number := format('CLO-%s-%s', v_year, lpad(v_seq::text, 7, '0'));
  RETURN v_number;
END;
$$;

