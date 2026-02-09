-- =====================================================
-- Fix generate_worktop_quote_number to handle duplicates
-- =====================================================
-- Problem: Function was generating duplicate numbers
-- because it didn't check if the number already exists
-- (including deleted quotes) before returning it.
--
-- Solution: Find MAX including deleted, then verify the
-- generated number doesn't exist (deleted or not). If it
-- exists, increment and try again.
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_worktop_quote_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  current_year text;
  next_number integer;
  new_quote_number text;
  max_attempts integer := 100; -- Safety limit
  attempt integer := 0;
BEGIN
  -- Get current year
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Find the highest number (including deleted quotes) for this year
  -- Extract the number part after "WK-YYYY-"
  -- Pattern: "WK-YYYY-XXX" where XXX is the number
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(quote_number FROM LENGTH('WK-' || current_year || '-') + 1) 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM worktop_quotes
  WHERE quote_number LIKE 'WK-' || current_year || '-%';
  -- NOTE: Removed "AND deleted_at IS NULL" - we need to see ALL numbers
  
  -- Loop until we find an available number
  LOOP
    new_quote_number := 'WK-' || current_year || '-' || LPAD(next_number::TEXT, 3, '0');
    
    -- Check if this number exists (deleted or not)
    IF NOT EXISTS (
      SELECT 1 FROM worktop_quotes WHERE quote_number = new_quote_number
    ) THEN
      -- Number is available, return it
      RETURN new_quote_number;
    END IF;
    
    -- Number exists, try next one
    next_number := next_number + 1;
    attempt := attempt + 1;
    
    -- Safety check to prevent infinite loop
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique worktop quote number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_worktop_quote_number() IS 'Generate unique worktop quote number: WK-YYYY-XXX. Handles duplicates and deleted quotes.';
