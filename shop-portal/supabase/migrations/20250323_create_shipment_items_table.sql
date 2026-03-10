-- Create shipment_items table
-- This table stores items in shipments (supports unexpected products not in PO)

CREATE TABLE IF NOT EXISTS public.shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  
  -- Link to PO item (NULL if unexpected product)
  purchase_order_item_id UUID REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  
  -- Product reference (required for all items)
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE RESTRICT,
  
  -- Quantities
  expected_quantity DECIMAL(10,2) DEFAULT 0,
  received_quantity DECIMAL(10,2) DEFAULT 0,
  inspected_quantity DECIMAL(10,2) DEFAULT 0,
  accepted_quantity DECIMAL(10,2) DEFAULT 0,
  rejected_quantity DECIMAL(10,2) DEFAULT 0,
  
  -- Pricing (for unexpected items)
  unit_cost DECIMAL(10,2),
  vat_id UUID REFERENCES public.vat(id),
  currency_id UUID REFERENCES public.currencies(id),
  
  -- Warehouse location
  shelf_location VARCHAR(100),
  
  -- Quality control
  inspection_notes TEXT,
  is_unexpected BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints
-- Drop constraint if exists, then add it
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_quantities_sum' 
    AND conrelid = 'public.shipment_items'::regclass
  ) THEN
    ALTER TABLE public.shipment_items DROP CONSTRAINT check_quantities_sum;
  END IF;
END $$;

ALTER TABLE public.shipment_items 
ADD CONSTRAINT check_quantities_sum 
  CHECK (inspected_quantity = accepted_quantity + rejected_quantity);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id 
ON public.shipment_items(shipment_id);

CREATE INDEX IF NOT EXISTS idx_shipment_items_po_item_id 
ON public.shipment_items(purchase_order_item_id) 
WHERE purchase_order_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipment_items_product_id 
ON public.shipment_items(product_id);

CREATE INDEX IF NOT EXISTS idx_shipment_items_unexpected 
ON public.shipment_items(is_unexpected) 
WHERE is_unexpected = true;

-- Trigger
CREATE TRIGGER update_shipment_items_updated_at
BEFORE UPDATE ON public.shipment_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Shipment items are viewable by authenticated users" ON public.shipment_items;
CREATE POLICY "Shipment items are viewable by authenticated users" 
ON public.shipment_items
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Shipment items are manageable by authenticated users" ON public.shipment_items;
CREATE POLICY "Shipment items are manageable by authenticated users" 
ON public.shipment_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_items TO authenticated;

-- Comments
COMMENT ON TABLE public.shipment_items IS 'Items in shipments. Supports unexpected products not in purchase order.';
COMMENT ON COLUMN public.shipment_items.is_unexpected IS 'TRUE if product was not in the purchase order';
COMMENT ON COLUMN public.shipment_items.unit_cost IS 'Required for unexpected items';
