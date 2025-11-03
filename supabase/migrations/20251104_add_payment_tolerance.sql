-- Add 1 Ft tolerance to payment status calculation
-- This fixes rounding issues where amounts are displayed without decimals
-- but stored with decimals in the database

CREATE OR REPLACE FUNCTION update_quote_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_quote_id UUID;
  v_final_total NUMERIC(12,2);
  v_total_paid NUMERIC(12,2);
  v_new_status TEXT;
  v_tolerance CONSTANT NUMERIC := 1.0; -- 1 Ft tolerance for rounding
BEGIN
  -- Get quote_id from the affected row
  IF (TG_OP = 'DELETE') THEN
    v_quote_id := OLD.quote_id;
  ELSE
    v_quote_id := NEW.quote_id;
  END IF;

  -- Get quote's final total
  SELECT final_total_after_discount INTO v_final_total
  FROM quotes
  WHERE id = v_quote_id;

  -- Calculate total paid (excluding soft-deleted payments)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM quote_payments
  WHERE quote_id = v_quote_id
    AND deleted_at IS NULL;

  -- Determine payment status with tolerance
  IF v_total_paid = 0 THEN
    v_new_status := 'not_paid';
  ELSIF v_total_paid >= v_final_total - v_tolerance THEN
    -- Consider "paid" if within 1 Ft of final total (handles rounding)
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Update quote's payment status
  UPDATE quotes
  SET payment_status = v_new_status,
      updated_at = NOW()
  WHERE id = v_quote_id;

  RETURN NULL; -- Result is ignored for AFTER triggers
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers (in case they don't exist or need refresh)
DROP TRIGGER IF EXISTS trigger_update_payment_status_insert ON quote_payments;
DROP TRIGGER IF EXISTS trigger_update_payment_status_update ON quote_payments;
DROP TRIGGER IF EXISTS trigger_update_payment_status_delete ON quote_payments;

CREATE TRIGGER trigger_update_payment_status_insert
  AFTER INSERT ON quote_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_payment_status();

CREATE TRIGGER trigger_update_payment_status_update
  AFTER UPDATE ON quote_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_payment_status();

CREATE TRIGGER trigger_update_payment_status_delete
  AFTER DELETE ON quote_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_payment_status();

