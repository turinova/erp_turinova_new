-- Create purchase_orders table
-- This table stores purchase orders (beszerzési rendelések)

-- PO Number Sequence
CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  OWNED BY NONE;

-- PO Number Generator Function
CREATE OR REPLACE FUNCTION generate_purchase_order_number()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  SELECT nextval('purchase_order_number_seq') INTO next_val;
  RETURN 'POR-' || 
         TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
         LPAD(next_val::TEXT, 6, '0');
END;
$$;

-- Purchase Orders Table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) UNIQUE NOT NULL DEFAULT generate_purchase_order_number(),
  
  -- Relationships
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  
  -- Status workflow
  status VARCHAR(20) DEFAULT 'draft' CHECK (
    status IN ('draft', 'pending_approval', 'approved', 'partially_received', 'received', 'cancelled')
  ),
  
  -- Email tracking (only relevant when status != 'approved')
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  
  -- Dates
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id),
  
  -- Financial summary (calculated, stored for performance)
  currency_id UUID REFERENCES public.currencies(id),
  total_net DECIMAL(12,2) DEFAULT 0,
  total_vat DECIMAL(12,2) DEFAULT 0,
  total_gross DECIMAL(12,2) DEFAULT 0,
  
  -- Physical summary
  total_weight DECIMAL(10,2) DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  total_quantity DECIMAL(10,2) DEFAULT 0,
  
  -- Metadata
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id 
ON public.purchase_orders(supplier_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_warehouse_id 
ON public.purchase_orders(warehouse_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status 
ON public.purchase_orders(status) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_email_sent 
ON public.purchase_orders(email_sent) 
WHERE deleted_at IS NULL AND status != 'approved';

CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date 
ON public.purchase_orders(order_date DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number 
ON public.purchase_orders(po_number);

-- Trigger
CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Purchase orders are viewable by authenticated users" ON public.purchase_orders;
CREATE POLICY "Purchase orders are viewable by authenticated users" 
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Purchase orders are manageable by authenticated users" ON public.purchase_orders;
CREATE POLICY "Purchase orders are manageable by authenticated users" 
ON public.purchase_orders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;

-- Comments
COMMENT ON TABLE public.purchase_orders IS 'Purchase orders (beszerzési rendelések)';
COMMENT ON COLUMN public.purchase_orders.email_sent IS 'Email tracking only relevant when status != approved';
COMMENT ON COLUMN public.purchase_orders.po_number IS 'Auto-generated format: POR-YYYY-000001';
