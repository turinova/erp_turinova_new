-- =====================================================
-- Add EAN-13 barcode generation for worktop orders
-- =====================================================
-- This function generates a unique EAN-13 barcode
-- EAN-13 format: 12 digits + 1 check digit
-- =====================================================

-- Function to generate EAN-13 barcode with uniqueness check
CREATE OR REPLACE FUNCTION generate_worktop_order_barcode()
RETURNS TEXT AS $$
DECLARE
  new_barcode TEXT;
  barcode_exists BOOLEAN;
  max_attempts INTEGER := 100; -- Prevent infinite loop
  attempts INTEGER := 0;
  sum_val INTEGER;
  digit INTEGER;
  i INTEGER;
BEGIN
  LOOP
    attempts := attempts + 1;
    
    -- Generate 12 random digits
    new_barcode := '';
    FOR i IN 1..12 LOOP
      new_barcode := new_barcode || floor(random() * 10)::TEXT;
    END LOOP;
    
    -- Calculate check digit (EAN-13 algorithm)
    -- Sum of digits at odd positions (1-indexed) + sum of digits at even positions * 3
    sum_val := 0;
    FOR i IN 1..12 LOOP
      digit := substring(new_barcode, i, 1)::INTEGER;
      IF i % 2 = 1 THEN
        sum_val := sum_val + digit;
      ELSE
        sum_val := sum_val + (digit * 3);
      END IF;
    END LOOP;
    
    -- Calculate check digit: (10 - (sum mod 10)) mod 10
    new_barcode := new_barcode || ((10 - (sum_val % 10)) % 10)::TEXT;
    
    -- Check if barcode already exists in worktop_quotes
    SELECT EXISTS(
      SELECT 1 
      FROM worktop_quotes 
      WHERE barcode = new_barcode 
        AND deleted_at IS NULL
    ) INTO barcode_exists;
    
    -- Also check quotes table for uniqueness across both tables
    IF NOT barcode_exists THEN
      SELECT EXISTS(
        SELECT 1 
        FROM quotes 
        WHERE barcode = new_barcode 
          AND deleted_at IS NULL
      ) INTO barcode_exists;
    END IF;
    
    -- If barcode is unique, return it
    IF NOT barcode_exists THEN
      RETURN new_barcode;
    END IF;
    
    -- Safety check to prevent infinite loop
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique barcode after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_worktop_order_barcode() IS 
  'Generates a unique EAN-13 barcode (13 digits) for worktop orders. Checks uniqueness against both worktop_quotes and quotes tables. Returns the barcode or raises an exception if unable to generate a unique one after 100 attempts.';
