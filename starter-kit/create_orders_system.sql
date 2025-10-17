-- =============================================================================
-- ORDERS SYSTEM - Complete Database Schema
-- =============================================================================
-- Description: Order management system with production tracking and payments
-- Created: 2025-01-27
-- Notes: Run manually - DO NOT auto-execute
-- =============================================================================

-- =============================================================================
-- 1. ORDERS TABLE
-- =============================================================================
-- Main orders table - snapshot of quote at time of order creation

CREATE TABLE IF NOT EXISTS orders (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiers
  order_number TEXT UNIQUE NOT NULL,  -- Format: ORD-YYYY-MM-DD-NNN
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE RESTRICT,
  
  -- Status Management
  status TEXT NOT NULL DEFAULT 'ordered',
  -- Values: ordered, in_production, ready, finished, cancelled
  
  payment_status TEXT NOT NULL DEFAULT 'not_paid',
  -- Values: not_paid, partial, paid
  -- Auto-calculated by trigger
  
  -- Customer Information (Snapshot from quote)
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_mobile TEXT,
  
  -- Billing Information (Snapshot from quote)
  billing_name TEXT,
  billing_address TEXT,
  billing_tax_number TEXT,
  billing_company_registration_number TEXT,
  
  -- Financial Totals (Snapshot from quote)
  materials_total_net NUMERIC(10,2) DEFAULT 0,
  materials_total_vat NUMERIC(10,2) DEFAULT 0,
  materials_total_gross NUMERIC(10,2) DEFAULT 0,
  
  services_total_net NUMERIC(10,2) DEFAULT 0,
  services_total_vat NUMERIC(10,2) DEFAULT 0,
  services_total_gross NUMERIC(10,2) DEFAULT 0,
  
  fees_total_net NUMERIC(10,2) DEFAULT 0,
  fees_total_vat NUMERIC(10,2) DEFAULT 0,
  fees_total_gross NUMERIC(10,2) DEFAULT 0,
  
  accessories_total_net NUMERIC(10,2) DEFAULT 0,
  accessories_total_vat NUMERIC(10,2) DEFAULT 0,
  accessories_total_gross NUMERIC(10,2) DEFAULT 0,
  
  subtotal NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  final_total NUMERIC(10,2) NOT NULL,
  
  currency_id UUID NOT NULL REFERENCES currencies(id) ON DELETE RESTRICT,
  
  -- Production Information
  production_machine_id UUID REFERENCES production_machines(id) ON DELETE RESTRICT,
  production_date DATE,
  barcode TEXT UNIQUE,
  production_started_at TIMESTAMP,
  production_finished_at TIMESTAMP,
  
  -- Audit Trail
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMP
);

COMMENT ON TABLE orders IS 'Main orders table - confirmed quotes ready for production';
COMMENT ON COLUMN orders.order_number IS 'Unique order identifier: ORD-YYYY-MM-DD-NNN';
COMMENT ON COLUMN orders.status IS 'Order workflow status: ordered → in_production → ready → finished';
COMMENT ON COLUMN orders.payment_status IS 'Auto-calculated: not_paid | partial | paid';
COMMENT ON COLUMN orders.barcode IS 'Production tracking barcode - unique per order';

-- =============================================================================
-- 2. ORDER PAYMENTS TABLE
-- =============================================================================
-- Multiple payments per order - supports partial payments and refunds

CREATE TABLE IF NOT EXISTS order_payments (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Key
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Payment Details
  amount NUMERIC(10,2) NOT NULL,
  -- Positive = payment received
  -- Negative = refund issued
  
  payment_method TEXT NOT NULL,
  -- Values: cash, transfer, card
  
  comment TEXT,
  payment_date TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Audit Trail
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMP
);

COMMENT ON TABLE order_payments IS 'Payment transactions for orders - supports multiple payments and refunds';
COMMENT ON COLUMN order_payments.amount IS 'Payment amount - positive for payments, negative for refunds';
COMMENT ON COLUMN order_payments.payment_method IS 'Payment method: cash, transfer, card';

-- =============================================================================
-- 3. ORDER STATUS HISTORY TABLE
-- =============================================================================
-- Audit trail for all status changes

CREATE TABLE IF NOT EXISTS order_status_history (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Key
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Status Change
  from_status TEXT,
  to_status TEXT NOT NULL,
  
  -- Additional Context
  comment TEXT,
  scanned_barcode TEXT,
  
  -- Audit Trail
  changed_at TIMESTAMP DEFAULT NOW() NOT NULL,
  changed_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE order_status_history IS 'Complete audit trail of order status changes';
COMMENT ON COLUMN order_status_history.scanned_barcode IS 'Barcode used to trigger status change (if applicable)';

-- =============================================================================
-- 4. INDEXES
-- =============================================================================

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_quote_id ON orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_barcode ON orders(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_production_date ON orders(production_date) WHERE production_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at) WHERE deleted_at IS NULL;

-- Order payments indexes
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_payment_date ON order_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_payments_deleted_at ON order_payments(deleted_at) WHERE deleted_at IS NULL;

-- Order status history indexes
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at ON order_status_history(changed_at DESC);

-- =============================================================================
-- 5. FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Function: Generate Order Number
-- Format: ORD-YYYY-MM-DD-NNN (auto-increment per day)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_order_number(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
DECLARE
  date_str TEXT;
  next_num INTEGER;
  new_order_number TEXT;
BEGIN
  -- Format date as YYYY-MM-DD
  date_str := TO_CHAR(target_date, 'YYYY-MM-DD');
  
  -- Get the next number for this date
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(order_number FROM 'ORD-\d{4}-\d{2}-\d{2}-(\d+)') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM orders
  WHERE order_number LIKE 'ORD-' || date_str || '-%'
    AND deleted_at IS NULL;
  
  -- Generate new order number with zero-padded sequence
  new_order_number := 'ORD-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  
  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_order_number IS 'Generate unique order number: ORD-YYYY-MM-DD-NNN';

-- -----------------------------------------------------------------------------
-- Function: Update Order Payment Status
-- Auto-calculate payment_status based on total paid amount
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid NUMERIC(10,2);
  order_total NUMERIC(10,2);
  new_status TEXT;
BEGIN
  -- Get order_id (works for INSERT/UPDATE/DELETE)
  DECLARE
    target_order_id UUID;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      target_order_id := OLD.order_id;
    ELSE
      target_order_id := NEW.order_id;
    END IF;
    
    -- Calculate total paid (sum of all non-deleted payments)
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM order_payments
    WHERE order_id = target_order_id 
      AND deleted_at IS NULL;
    
    -- Get order total
    SELECT final_total INTO order_total
    FROM orders
    WHERE id = target_order_id;
    
    -- Determine payment status
    IF total_paid = 0 THEN
      new_status := 'not_paid';
    ELSIF total_paid >= order_total THEN
      new_status := 'paid';
    ELSE
      new_status := 'partial';
    END IF;
    
    -- Update order
    UPDATE orders
    SET payment_status = new_status,
        updated_at = NOW()
    WHERE id = target_order_id;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_order_payment_status IS 'Auto-calculate and update order payment_status based on payments';

-- -----------------------------------------------------------------------------
-- Function: Record Status Change History
-- Automatically log all status changes to order_status_history
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (
      order_id,
      from_status,
      to_status,
      changed_at,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NOW(),
      NEW.updated_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_order_status_change IS 'Automatically log order status changes to history table';

-- =============================================================================
-- 6. TRIGGERS
-- =============================================================================

-- Trigger: Auto-update payment status on payment INSERT/UPDATE/DELETE
DROP TRIGGER IF EXISTS trigger_update_payment_status_insert ON order_payments;
CREATE TRIGGER trigger_update_payment_status_insert
AFTER INSERT ON order_payments
FOR EACH ROW
EXECUTE FUNCTION update_order_payment_status();

DROP TRIGGER IF EXISTS trigger_update_payment_status_update ON order_payments;
CREATE TRIGGER trigger_update_payment_status_update
AFTER UPDATE ON order_payments
FOR EACH ROW
EXECUTE FUNCTION update_order_payment_status();

DROP TRIGGER IF EXISTS trigger_update_payment_status_delete ON order_payments;
CREATE TRIGGER trigger_update_payment_status_delete
AFTER DELETE ON order_payments
FOR EACH ROW
EXECUTE FUNCTION update_order_payment_status();

-- Trigger: Record status changes to history
DROP TRIGGER IF EXISTS trigger_record_status_change ON orders;
CREATE TRIGGER trigger_record_status_change
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION record_order_status_change();

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Orders policies
DROP POLICY IF EXISTS orders_select_policy ON orders;
CREATE POLICY orders_select_policy ON orders
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS orders_insert_policy ON orders;
CREATE POLICY orders_insert_policy ON orders
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS orders_update_policy ON orders;
CREATE POLICY orders_update_policy ON orders
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS orders_delete_policy ON orders;
CREATE POLICY orders_delete_policy ON orders
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Order payments policies
DROP POLICY IF EXISTS order_payments_select_policy ON order_payments;
CREATE POLICY order_payments_select_policy ON order_payments
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS order_payments_insert_policy ON order_payments;
CREATE POLICY order_payments_insert_policy ON order_payments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS order_payments_update_policy ON order_payments;
CREATE POLICY order_payments_update_policy ON order_payments
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS order_payments_delete_policy ON order_payments;
CREATE POLICY order_payments_delete_policy ON order_payments
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Order status history policies
DROP POLICY IF EXISTS order_status_history_select_policy ON order_status_history;
CREATE POLICY order_status_history_select_policy ON order_status_history
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS order_status_history_insert_policy ON order_status_history;
CREATE POLICY order_status_history_insert_policy ON order_status_history
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- 8. TEST DATA (OPTIONAL - FOR DEVELOPMENT)
-- =============================================================================

-- Test the order number generation
-- SELECT generate_order_number(); -- Should return: ORD-2025-01-27-001
-- SELECT generate_order_number(); -- Should return: ORD-2025-01-27-002

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- Next steps:
-- 1. Run this SQL file manually in Supabase SQL Editor
-- 2. Verify tables created: SELECT * FROM orders LIMIT 1;
-- 3. Test order number generation: SELECT generate_order_number();
-- 4. Proceed with frontend implementation
-- =============================================================================

