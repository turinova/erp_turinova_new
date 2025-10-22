-- =====================================================
-- PORTAL QUOTE NUMBER GENERATOR
-- =====================================================
-- This function generates sequential quote numbers for
-- customer portal quotes in the format: PQ-YYYY-NNN
-- where YYYY is the current year and NNN is the sequence
-- number for that year (e.g., PQ-2025-001, PQ-2025-002)
-- =====================================================

CREATE OR REPLACE FUNCTION generate_portal_quote_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  last_number INTEGER;
  new_number INTEGER;
  new_quote_number TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  -- Get current year
  current_year := TO_CHAR(NOW(), 'YYYY');
  
  -- Loop to handle potential race conditions
  LOOP
    -- Find the highest number for this year
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING(quote_number FROM 'PQ-' || current_year || '-(\d+)') 
          AS INTEGER
        )
      ), 
      0
    )
    INTO last_number
    FROM portal_quotes
    WHERE quote_number LIKE 'PQ-' || current_year || '-%';
    
    -- Increment the number
    new_number := last_number + 1;
    
    -- Format the new quote number (pad with zeros to 3 digits)
    new_quote_number := 'PQ-' || current_year || '-' || LPAD(new_number::TEXT, 3, '0');
    
    -- Check if this number already exists (race condition check)
    IF NOT EXISTS (
      SELECT 1 FROM portal_quotes WHERE quote_number = new_quote_number
    ) THEN
      -- Number is available, return it
      RETURN new_quote_number;
    END IF;
    
    -- If we get here, there was a race condition
    attempt := attempt + 1;
    
    -- If we've tried too many times, raise an error
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique quote number after % attempts', max_attempts;
    END IF;
    
    -- Small delay before retry (in milliseconds)
    PERFORM pg_sleep(0.01);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION generate_portal_quote_number() IS 
  'Generates sequential quote numbers for customer portal in format PQ-YYYY-NNN';

-- Test the function (commented out - uncomment to test)
-- SELECT generate_portal_quote_number();

