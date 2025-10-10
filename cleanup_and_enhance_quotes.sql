-- =============================================================================
-- CLEANUP AND ENHANCE QUOTES TABLE FOR ORDER WORKFLOW
-- =============================================================================
-- Description: Remove unnecessary order tables and add order fields to quotes
-- Created: 2025-01-28
-- =============================================================================

-- =============================================================================
-- 1. DROP UNNECESSARY TABLES AND FUNCTIONS FIRST
-- =============================================================================

-- Drop functions first (they reference old tables)
DROP FUNCTION IF EXISTS update_order_payment_status() CASCADE;
DROP FUNCTION IF EXISTS record_order_status_change() CASCADE;

-- Drop in correct order (dependencies first)
DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- Keep order_payments but rename to quote_payments for clarity
ALTER TABLE IF EXISTS order_payments RENAME TO quote_payments;

-- Update foreign key if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_payments' AND column_name = 'order_id'
  ) THEN
    -- First, delete any orphaned payments that reference non-existent quotes
    -- (These are from the old orders table we're dropping)
    DELETE FROM quote_payments 
    WHERE order_id NOT IN (SELECT id FROM quotes);
    
    -- Now rename the column
    ALTER TABLE quote_payments RENAME COLUMN order_id TO quote_id;
    
    -- Drop old foreign key constraint
    ALTER TABLE quote_payments DROP CONSTRAINT IF EXISTS order_payments_order_id_fkey;
    
    -- Add new foreign key constraint to quotes
    ALTER TABLE quote_payments 
      ADD CONSTRAINT quote_payments_quote_id_fkey 
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Keep generate_order_number() function - we'll use it for quotes
-- Just rename it for clarity
DROP FUNCTION IF EXISTS generate_quote_order_number() CASCADE;
CREATE OR REPLACE FUNCTION generate_quote_order_number()
RETURNS TEXT AS $$
DECLARE
  date_str TEXT;
  next_num INTEGER;
  new_order_number TEXT;
BEGIN
  -- Format date as YYYY-MM-DD
  date_str := TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');
  
  -- Get the next number for this date from quotes table
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(order_number FROM 'ORD-\d{4}-\d{2}-\d{2}-(\d+)') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM quotes
  WHERE order_number LIKE 'ORD-' || date_str || '-%'
    AND deleted_at IS NULL;
  
  -- Generate new order number with zero-padded sequence
  new_order_number := 'ORD-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  
  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_quote_order_number IS 'Generate unique order number for quotes: ORD-YYYY-MM-DD-NNN';

-- =============================================================================
-- 2. UPDATE QUOTE_STATUS ENUM TO INCLUDE ORDER STATUSES
-- =============================================================================

-- Add new status values to the enum if they don't exist
DO $$ 
BEGIN
  -- Add 'ordered' status
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ordered' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quote_status')
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'ordered';
  END IF;
  
  -- Add 'in_production' status
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'in_production' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quote_status')
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'in_production';
  END IF;
  
  -- Add 'ready' status
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ready' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quote_status')
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'ready';
  END IF;
  
  -- Add 'finished' status
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'finished' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quote_status')
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'finished';
  END IF;
  
  -- Add 'cancelled' status (optional, for future)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'cancelled' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quote_status')
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'cancelled';
  END IF;
END $$;

-- =============================================================================
-- 3. ADD ORDER-RELATED COLUMNS TO QUOTES TABLE
-- =============================================================================

-- Add order_number column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE quotes ADD COLUMN order_number TEXT UNIQUE;
    CREATE INDEX idx_quotes_order_number ON quotes(order_number) WHERE order_number IS NOT NULL;
    COMMENT ON COLUMN quotes.order_number IS 'Generated when quote becomes an order: ORD-YYYY-MM-DD-NNN';
  END IF;
END $$;

-- Add barcode column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'barcode'
  ) THEN
    ALTER TABLE quotes ADD COLUMN barcode TEXT UNIQUE;
    CREATE INDEX idx_quotes_barcode ON quotes(barcode) WHERE barcode IS NOT NULL;
    COMMENT ON COLUMN quotes.barcode IS 'Production tracking barcode';
  END IF;
END $$;

-- Add production_machine_id column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'production_machine_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN production_machine_id UUID REFERENCES production_machines(id) ON DELETE RESTRICT;
    CREATE INDEX idx_quotes_production_machine ON quotes(production_machine_id) WHERE production_machine_id IS NOT NULL;
    COMMENT ON COLUMN quotes.production_machine_id IS 'Machine assigned for production';
  END IF;
END $$;

-- Add production_date column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'production_date'
  ) THEN
    ALTER TABLE quotes ADD COLUMN production_date DATE;
    CREATE INDEX idx_quotes_production_date ON quotes(production_date) WHERE production_date IS NOT NULL;
    COMMENT ON COLUMN quotes.production_date IS 'Scheduled production date';
  END IF;
END $$;

-- Add payment_status column (auto-calculated)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE quotes ADD COLUMN payment_status TEXT DEFAULT 'not_paid';
    CREATE INDEX idx_quotes_payment_status ON quotes(payment_status);
    COMMENT ON COLUMN quotes.payment_status IS 'Auto-calculated: not_paid, partial, paid';
  END IF;
END $$;

-- =============================================================================
-- 4. CREATE TRIGGER FOR PAYMENT STATUS AUTO-UPDATE
-- =============================================================================

-- Function to update payment status
CREATE OR REPLACE FUNCTION update_quote_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid NUMERIC(10,2);
  quote_total NUMERIC(10,2);
  new_status TEXT;
  target_quote_id UUID;
BEGIN
  -- Get quote_id (works for INSERT/UPDATE/DELETE)
  IF TG_OP = 'DELETE' THEN
    target_quote_id := OLD.quote_id;
  ELSE
    target_quote_id := NEW.quote_id;
  END IF;
  
  -- Calculate total paid (sum of all non-deleted payments)
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM quote_payments
  WHERE quote_id = target_quote_id 
    AND deleted_at IS NULL;
  
  -- Get quote total (use final_total_after_discount or calculate)
  SELECT COALESCE(final_total_after_discount, total_gross) INTO quote_total
  FROM quotes
  WHERE id = target_quote_id;
  
  -- Determine payment status
  IF total_paid = 0 THEN
    new_status := 'not_paid';
  ELSIF total_paid >= quote_total THEN
    new_status := 'paid';
  ELSE
    new_status := 'partial';
  END IF;
  
  -- Update quote
  UPDATE quotes
  SET payment_status = new_status,
      updated_at = NOW()
  WHERE id = target_quote_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_quote_payment_status IS 'Auto-calculate and update quote payment_status based on payments';

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_payment_status_insert ON quote_payments;
CREATE TRIGGER trigger_update_payment_status_insert
AFTER INSERT ON quote_payments
FOR EACH ROW
EXECUTE FUNCTION update_quote_payment_status();

DROP TRIGGER IF EXISTS trigger_update_payment_status_update ON quote_payments;
CREATE TRIGGER trigger_update_payment_status_update
AFTER UPDATE ON quote_payments
FOR EACH ROW
EXECUTE FUNCTION update_quote_payment_status();

DROP TRIGGER IF EXISTS trigger_update_payment_status_delete ON quote_payments;
CREATE TRIGGER trigger_update_payment_status_delete
AFTER DELETE ON quote_payments
FOR EACH ROW
EXECUTE FUNCTION update_quote_payment_status();

-- =============================================================================
-- 5. ENSURE QUOTE_PAYMENTS TABLE HAS CORRECT STRUCTURE
-- =============================================================================

-- Ensure quote_payments has all needed columns
DO $$ 
BEGIN
  -- Add comment column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_payments' AND column_name = 'comment'
  ) THEN
    ALTER TABLE quote_payments ADD COLUMN comment TEXT;
  END IF;
END $$;

-- Update RLS policies for quote_payments
ALTER TABLE quote_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quote_payments_select_policy ON quote_payments;
CREATE POLICY quote_payments_select_policy ON quote_payments
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS quote_payments_insert_policy ON quote_payments;
CREATE POLICY quote_payments_insert_policy ON quote_payments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS quote_payments_update_policy ON quote_payments;
CREATE POLICY quote_payments_update_policy ON quote_payments
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS quote_payments_delete_policy ON quote_payments;
CREATE POLICY quote_payments_delete_policy ON quote_payments
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- =============================================================================
-- 6. UPDATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index for filtering orders (status-based)
CREATE INDEX IF NOT EXISTS idx_quotes_status_ordered ON quotes(status) 
  WHERE status IN ('ordered', 'in_production', 'ready', 'finished');

-- Index for payment lookups
CREATE INDEX IF NOT EXISTS idx_quote_payments_quote_id ON quote_payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_payments_payment_date ON quote_payments(payment_date DESC);

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- Summary:
-- ✅ Dropped: orders, order_status_history tables
-- ✅ Renamed: order_payments → quote_payments
-- ✅ Added to quotes: order_number, barcode, production_machine_id, production_date, payment_status
-- ✅ Created: Trigger for auto-updating payment_status
-- ✅ Kept: generate_order_number function (renamed)
-- ✅ Indexes: Added for performance
-- 
-- Next steps:
-- 1. Update API to use quotes table for orders
-- 2. Update frontend to show correct buttons based on status
-- 3. Build /orders page (filter by status)
-- =============================================================================

-- Test the order number generation
SELECT generate_quote_order_number();

