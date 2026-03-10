-- Create shipment_purchase_orders table
-- Many-to-many relationship between shipments and purchase orders

CREATE TABLE IF NOT EXISTS public.shipment_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shipment_id, purchase_order_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipment_pos_shipment_id 
ON public.shipment_purchase_orders(shipment_id);

CREATE INDEX IF NOT EXISTS idx_shipment_pos_po_id 
ON public.shipment_purchase_orders(purchase_order_id);

-- Enable RLS
ALTER TABLE public.shipment_purchase_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Shipment POs are viewable by authenticated users" ON public.shipment_purchase_orders;
CREATE POLICY "Shipment POs are viewable by authenticated users" 
ON public.shipment_purchase_orders
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Shipment POs are manageable by authenticated users" ON public.shipment_purchase_orders;
CREATE POLICY "Shipment POs are manageable by authenticated users" 
ON public.shipment_purchase_orders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_purchase_orders TO authenticated;

-- Comments
COMMENT ON TABLE public.shipment_purchase_orders IS 'Many-to-many relationship: one shipment can contain items from multiple purchase orders';
