-- Create warehouse_operations table
-- This table tracks warehouse operations (bevételezés, transfers, etc.)

-- Warehouse Operation Number Sequence
CREATE SEQUENCE IF NOT EXISTS warehouse_operation_number_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  OWNED BY NONE;

-- Warehouse Operation Number Generator
CREATE OR REPLACE FUNCTION generate_warehouse_operation_number()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  SELECT nextval('warehouse_operation_number_seq') INTO next_val;
  RETURN 'WOP-' || 
         TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
         LPAD(next_val::TEXT, 7, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS public.warehouse_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_number VARCHAR(50) UNIQUE NOT NULL DEFAULT generate_warehouse_operation_number(),
  
  -- Relationships
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  
  -- Operation details
  operation_type VARCHAR(20) NOT NULL CHECK (
    operation_type IN ('receiving', 'transfer', 'adjustment', 'picking', 'return')
  ),
  
  status VARCHAR(20) DEFAULT 'waiting' CHECK (
    status IN ('waiting', 'in_progress', 'completed', 'cancelled')
  ),
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- User tracking
  created_by UUID REFERENCES public.users(id),
  completed_by UUID REFERENCES public.users(id),
  
  -- Metadata
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_ops_shipment_id 
ON public.warehouse_operations(shipment_id) 
WHERE shipment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_ops_warehouse_id 
ON public.warehouse_operations(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_ops_status 
ON public.warehouse_operations(status);

CREATE INDEX IF NOT EXISTS idx_warehouse_ops_type 
ON public.warehouse_operations(operation_type);

CREATE INDEX IF NOT EXISTS idx_warehouse_ops_operation_number 
ON public.warehouse_operations(operation_number);

-- Trigger
CREATE TRIGGER update_warehouse_ops_updated_at
BEFORE UPDATE ON public.warehouse_operations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.warehouse_operations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Warehouse ops are viewable by authenticated users" ON public.warehouse_operations;
CREATE POLICY "Warehouse ops are viewable by authenticated users" 
ON public.warehouse_operations
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Warehouse ops are manageable by authenticated users" ON public.warehouse_operations;
CREATE POLICY "Warehouse ops are manageable by authenticated users" 
ON public.warehouse_operations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_operations TO authenticated;

-- Comments
COMMENT ON TABLE public.warehouse_operations IS 'Warehouse operations (raktári műveletek) - receiving, transfers, adjustments, etc.';
COMMENT ON COLUMN public.warehouse_operations.operation_number IS 'Auto-generated format: WOP-YYYY-0000002';
