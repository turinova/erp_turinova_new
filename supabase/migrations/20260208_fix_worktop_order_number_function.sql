-- =====================================================
-- Fix generate_worktop_quote_order_number() function
-- =====================================================
-- The regex pattern in SUBSTRING might not work correctly
-- Use simpler string manipulation instead
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_worktop_quote_order_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  date_str TEXT;
  next_num INTEGER;
  new_order_number TEXT;
  max_attempts INTEGER := 100; -- Safety limit
  attempt INTEGER := 0;
BEGIN
  -- Format date as YYYY-MM-DD
  date_str := TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');
  
  -- Find the highest number (including deleted orders) for this date
  -- Extract the number part after the date prefix
  -- Pattern: "WKO-YYYY-MM-DD-NNN" where NNN is the number
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(order_number FROM LENGTH('WKO-' || date_str || '-') + 1) 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM worktop_quotes
  WHERE order_number LIKE 'WKO-' || date_str || '-%'
    AND order_number ~ '^WKO-\d{4}-\d{2}-\d{2}-\d+$'; -- Validate format
  -- NOTE: We check all orders (including deleted) to avoid conflicts
  
  -- Loop until we find an available number
  LOOP
    new_order_number := 'WKO-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
    
    -- Check if this number exists (deleted or not)
    IF NOT EXISTS (
      SELECT 1 FROM worktop_quotes WHERE order_number = new_order_number
    ) THEN
      -- Number is available, return it
      RETURN new_order_number;
    END IF;
    
    -- Number exists, try next one
    next_num := next_num + 1;
    attempt := attempt + 1;
    
    -- Safety check to prevent infinite loop
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique worktop order number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_worktop_quote_order_number() IS 'Generate unique order number for worktop quotes: WKO-YYYY-MM-DD-NNN';
