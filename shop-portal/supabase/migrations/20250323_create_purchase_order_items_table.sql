-- Create purchase_order_items table
-- This table stores items (products) in purchase orders

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  
  -- Product reference
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE RESTRICT,
  product_supplier_id UUID REFERENCES public.product_suppliers(id) ON DELETE SET NULL,
  
  -- Quantities
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  received_quantity DECIMAL(10,2) DEFAULT 0,
  
  -- Pricing
  unit_cost DECIMAL(10,2) NOT NULL CHECK (unit_cost >= 0),
  vat_id UUID REFERENCES public.vat(id) ON DELETE RESTRICT,
  currency_id UUID REFERENCES public.currencies(id) ON DELETE RESTRICT,
  
  -- Units & description
  unit_id UUID REFERENCES public.units(id) ON DELETE RESTRICT,
  description TEXT, -- Product name snapshot (for historical accuracy)
  
  -- Warehouse location (assigned during receiving)
  shelf_location VARCHAR(100),
  
  -- Metadata
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_items_po_id 
ON public.purchase_order_items(purchase_order_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_po_items_product_id 
ON public.purchase_order_items(product_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_po_items_product_supplier_id 
ON public.purchase_order_items(product_supplier_id) 
WHERE deleted_at IS NULL AND product_supplier_id IS NOT NULL;

-- Trigger
CREATE TRIGGER update_po_items_updated_at
BEFORE UPDATE ON public.purchase_order_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "PO items are viewable by authenticated users" ON public.purchase_order_items;
CREATE POLICY "PO items are viewable by authenticated users" 
ON public.purchase_order_items
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "PO items are manageable by authenticated users" ON public.purchase_order_items;
CREATE POLICY "PO items are manageable by authenticated users" 
ON public.purchase_order_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;

-- Comments
COMMENT ON TABLE public.purchase_order_items IS 'Items (products) in purchase orders';
COMMENT ON COLUMN public.purchase_order_items.received_quantity IS 'Updated during shipment receiving';
COMMENT ON COLUMN public.purchase_order_items.description IS 'Product name snapshot for historical accuracy';
