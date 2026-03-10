-- Create stock_movements table
-- This table is an immutable audit trail of all stock movements

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Warehouse & Product
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE RESTRICT,
  
  -- Movement details
  movement_type VARCHAR(20) NOT NULL CHECK (
    movement_type IN ('in', 'out', 'adjustment', 'transfer_in', 'transfer_out', 'reserved', 'released')
  ),
  
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity != 0),
  unit_cost DECIMAL(10,2),
  
  -- Location
  shelf_location VARCHAR(100),
  
  -- Source tracking
  source_type VARCHAR(30) NOT NULL,
  source_id UUID,
  warehouse_operation_id UUID REFERENCES public.warehouse_operations(id) ON DELETE SET NULL,
  
  -- Metadata
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_product 
ON public.stock_movements(warehouse_id, product_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id 
ON public.stock_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_source 
ON public.stock_movements(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_op 
ON public.stock_movements(warehouse_operation_id) 
WHERE warehouse_operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at 
ON public.stock_movements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_type 
ON public.stock_movements(movement_type);

-- Enable RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Stock movements are viewable by authenticated users" ON public.stock_movements;
CREATE POLICY "Stock movements are viewable by authenticated users" 
ON public.stock_movements
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Stock movements are insertable by authenticated users" ON public.stock_movements;
CREATE POLICY "Stock movements are insertable by authenticated users" 
ON public.stock_movements
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Note: Updates and deletes should be restricted (immutable audit trail)
-- No UPDATE or DELETE policies

-- Grant permissions (only SELECT and INSERT)
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;

-- Comments
COMMENT ON TABLE public.stock_movements IS 'Immutable audit trail of all stock movements. No updates or deletes allowed.';
COMMENT ON COLUMN public.stock_movements.movement_type IS 'in/out: physical movements, reserved/released: allocation, adjustment: corrections';
COMMENT ON COLUMN public.stock_movements.quantity IS 'Positive for in, negative for out';
