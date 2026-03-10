-- Create shipments table
-- This table stores shipments (szállítmányok) - can link to multiple purchase orders

-- Shipment Number Sequence
CREATE SEQUENCE IF NOT EXISTS shipment_number_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  OWNED BY NONE;

-- Shipment Number Generator
CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  SELECT nextval('shipment_number_seq') INTO next_val;
  RETURN 'SHP-' || 
         TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
         LPAD(next_val::TEXT, 7, '0');
END;
$$;

-- Shipments Table
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number VARCHAR(50) UNIQUE NOT NULL DEFAULT generate_shipment_number(),
  
  -- Relationships
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  
  -- Status workflow
  status VARCHAR(20) DEFAULT 'waiting' CHECK (
    status IN ('waiting', 'in_transit', 'arrived', 'inspecting', 'completed', 'cancelled')
  ),
  
  -- Dates
  expected_arrival_date DATE,
  actual_arrival_date DATE,
  purchased_date DATE,
  delivered_date DATE,
  
  -- Financial
  currency_id UUID REFERENCES public.currencies(id),
  
  -- Metadata
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_supplier_id 
ON public.shipments(supplier_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_warehouse_id 
ON public.shipments(warehouse_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_status 
ON public.shipments(status) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_shipment_number 
ON public.shipments(shipment_number);

-- Trigger
CREATE TRIGGER update_shipments_updated_at
BEFORE UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Shipments are viewable by authenticated users" ON public.shipments;
CREATE POLICY "Shipments are viewable by authenticated users" 
ON public.shipments
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Shipments are manageable by authenticated users" ON public.shipments;
CREATE POLICY "Shipments are manageable by authenticated users" 
ON public.shipments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;

-- Comments
COMMENT ON TABLE public.shipments IS 'Shipments (szállítmányok) - can link to multiple purchase orders from same supplier';
COMMENT ON COLUMN public.shipments.shipment_number IS 'Auto-generated format: SHP-YYYY-0000001';
