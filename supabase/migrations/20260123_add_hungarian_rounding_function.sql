-- Create Hungarian cash rounding function
-- Implements Hungarian invoicing rounding rules for cash payments
-- Rules: 0.01-2.49 → round down to nearest 0, 2.50-4.99 → round up to nearest 5,
--        5.01-7.49 → round down to nearest 5, 7.50-9.99 → round up to nearest 0
-- Date: 2026-01-23
-- Reference: https://www.billingo.hu/tudastar/olvas/kerekites-szabalyai

CREATE OR REPLACE FUNCTION hungarian_round_cash(amount numeric)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  last_digit integer;
  rounded_amount integer;
  amount_floor integer;
BEGIN
  -- Handle zero or negative amounts
  IF amount <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Get the integer part (floor)
  amount_floor := FLOOR(amount)::integer;
  
  -- Get last digit (0-9) of the integer part
  last_digit := MOD(amount_floor, 10);
  
  -- Apply Hungarian rounding rules based on last digit
  -- Rules apply to the last digit of the integer part (since we work with whole forints)
  -- 0-2 → round down to nearest 0, 3-4 → round up to nearest 5, 5-7 → round down to nearest 5, 8-9 → round up to nearest 0
  IF last_digit >= 0 AND last_digit <= 2 THEN
    -- 0.01-2.49 → round down to nearest 0 (e.g., 6610 → 6610, 6611 → 6610, 6612 → 6610)
    rounded_amount := (FLOOR(amount_floor / 10.0)::integer * 10);
  ELSIF last_digit >= 3 AND last_digit <= 4 THEN
    -- 2.50-4.99 → round up to nearest 5 (e.g., 6613 → 6615, 6614 → 6615)
    rounded_amount := (FLOOR(amount_floor / 10.0)::integer * 10) + 5;
  ELSIF last_digit >= 5 AND last_digit <= 7 THEN
    -- 5.01-7.49 → round down to nearest 5 (e.g., 6615 → 6615, 6616 → 6615, 6617 → 6615)
    rounded_amount := (FLOOR(amount_floor / 10.0)::integer * 10) + 5;
  ELSE
    -- 7.50-9.99 → round up to nearest 0 (next 10) (e.g., 6618 → 6620, 6619 → 6620)
    rounded_amount := CEIL(amount_floor / 10.0)::integer * 10;
  END IF;
  
  RETURN rounded_amount;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION hungarian_round_cash IS 'Applies Hungarian cash rounding rules: 0-2→0, 3-4→5, 5-7→5, 8-9→0. Used for cash payments to comply with Hungarian invoicing regulations.';
