-- =====================================================
-- Fix generate_quote_number to handle deleted quotes
-- =====================================================
-- Problem: Function was only looking at non-deleted quotes
-- to find MAX, but then trying to use a number that might
-- already exist (even if deleted). If a deleted quote is
-- restored, it would conflict.
--
-- Solution: Find MAX including deleted, then verify the
-- generated number doesn't exist (deleted or not). If it
-- exists, increment and try again.
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS character varying
LANGUAGE plpgsql
AS $function$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  new_quote_number VARCHAR(50);
  max_attempts INTEGER := 100; -- Safety limit
  attempt INTEGER := 0;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  
  -- Find the highest number (including deleted quotes)
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(quote_number FROM POSITION('-' IN quote_number) + 6)
      AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM public.quotes
  WHERE quote_number LIKE 'Q-' || current_year || '-%';
  -- NOTE: Removed "AND deleted_at IS NULL" - we need to see ALL numbers
  
  -- Loop until we find an available number
  LOOP
    new_quote_number := 'Q-' || current_year || '-' || LPAD(next_number::TEXT, 3, '0');
    
    -- Check if this number exists (deleted or not)
    IF NOT EXISTS (
      SELECT 1 FROM public.quotes WHERE quote_number = new_quote_number
    ) THEN
      -- Number is available, return it
      RETURN new_quote_number;
    END IF;
    
    -- Number exists, try next one
    next_number := next_number + 1;
    attempt := attempt + 1;
    
    -- Safety check to prevent infinite loop
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique quote number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$function$;

-- =====================================================
-- Fix generate_order_number to handle deleted orders
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_order_number(target_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  date_str TEXT;
  next_num INTEGER;
  new_order_number TEXT;
  max_attempts INTEGER := 100; -- Safety limit
  attempt INTEGER := 0;
BEGIN
  date_str := TO_CHAR(target_date, 'YYYY-MM-DD');
  
  -- Find the highest number (including deleted orders)
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(order_number FROM 'ORD-\d{4}-\d{2}-\d{2}-(\d+)') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM orders
  WHERE order_number LIKE 'ORD-' || date_str || '-%';
  -- NOTE: Removed "AND deleted_at IS NULL" - we need to see ALL numbers
  
  -- Loop until we find an available number
  LOOP
    new_order_number := 'ORD-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
    
    -- Check if this number exists (deleted or not)
    IF NOT EXISTS (
      SELECT 1 FROM orders WHERE order_number = new_order_number
    ) THEN
      -- Number is available, return it
      RETURN new_order_number;
    END IF;
    
    -- Number exists, try next one
    next_num := next_num + 1;
    attempt := attempt + 1;
    
    -- Safety check to prevent infinite loop
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique order number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$function$;

