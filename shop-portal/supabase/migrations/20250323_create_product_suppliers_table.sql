-- Create product_suppliers table
-- This table stores the relationship between products and suppliers
-- A product can have multiple suppliers, with one preferred supplier

CREATE TABLE IF NOT EXISTS public.product_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    
    -- Supplier-specific product info
    supplier_sku VARCHAR(255), -- Supplier's product code
    supplier_barcode VARCHAR(255), -- Supplier's barcode (different from internal)
    
    -- Pricing & ordering
    default_cost DECIMAL(10,2), -- Last purchase price from this supplier
    last_purchased_at TIMESTAMPTZ,
    min_order_quantity INTEGER DEFAULT 1,
    lead_time_days INTEGER, -- Average delivery time
    
    -- Preferences
    is_preferred BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Partial unique index (only for non-deleted records)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_suppliers_unique_active 
ON public.product_suppliers(product_id, supplier_id) 
WHERE deleted_at IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product_id 
ON public.product_suppliers(product_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier_id 
ON public.product_suppliers(supplier_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier_barcode 
ON public.product_suppliers(supplier_barcode) 
WHERE deleted_at IS NULL AND supplier_barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_suppliers_preferred 
ON public.product_suppliers(supplier_id, is_preferred) 
WHERE deleted_at IS NULL AND is_preferred = true;

-- Trigger for updated_at
CREATE TRIGGER update_product_suppliers_updated_at
BEFORE UPDATE ON public.product_suppliers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Product suppliers are viewable by authenticated users" ON public.product_suppliers;
CREATE POLICY "Product suppliers are viewable by authenticated users" 
ON public.product_suppliers
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Product suppliers are manageable by authenticated users" ON public.product_suppliers;
CREATE POLICY "Product suppliers are manageable by authenticated users" 
ON public.product_suppliers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_suppliers TO authenticated;

-- Comments
COMMENT ON TABLE public.product_suppliers IS 'Relationship between products and suppliers. A product can have multiple suppliers.';
COMMENT ON COLUMN public.product_suppliers.supplier_barcode IS 'Supplier-specific barcode (different from product internal_barcode or gtin)';
COMMENT ON COLUMN public.product_suppliers.is_preferred IS 'Only one supplier should be preferred per product (enforced in application logic)';
