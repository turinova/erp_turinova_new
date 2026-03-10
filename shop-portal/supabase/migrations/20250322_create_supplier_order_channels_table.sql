-- Create supplier_order_channels table
-- This table stores order channel details, especially URL templates for internet-based ordering

CREATE TABLE IF NOT EXISTS public.supplier_order_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    channel_type VARCHAR NOT NULL CHECK (channel_type IN ('email', 'phone', 'in_person', 'internet')), -- Rendelési csatorna típusa
    name VARCHAR, -- Név (pl. "Webshop keresés SKU alapján")
    url_template TEXT, -- URL sablon (pl. "https://www.zar-vasalas.hu/shop_searchcomplex.php?search={{sku}}&overlay=search_error_no")
    description TEXT, -- Leírás (rövid magyarázat)
    is_default BOOLEAN DEFAULT false, -- Alapértelmezett csatorna
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add index for supplier_id lookups
CREATE INDEX IF NOT EXISTS ix_supplier_order_channels_supplier_id ON public.supplier_order_channels(supplier_id) WHERE deleted_at IS NULL;

-- Add index for channel_type filtering
CREATE INDEX IF NOT EXISTS ix_supplier_order_channels_type ON public.supplier_order_channels(channel_type) WHERE deleted_at IS NULL;

-- Add index for is_default filtering
CREATE INDEX IF NOT EXISTS ix_supplier_order_channels_default ON public.supplier_order_channels(is_default) WHERE deleted_at IS NULL AND is_default = true;

-- Create trigger for supplier_order_channels table to automatically update updated_at
DROP TRIGGER IF EXISTS update_supplier_order_channels_updated_at ON public.supplier_order_channels;
CREATE TRIGGER update_supplier_order_channels_updated_at
    BEFORE UPDATE ON public.supplier_order_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for supplier_order_channels table
ALTER TABLE public.supplier_order_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_order_channels table
DROP POLICY IF EXISTS "Supplier order channels are viewable by authenticated users" ON public.supplier_order_channels;
CREATE POLICY "Supplier order channels are viewable by authenticated users" 
ON public.supplier_order_channels
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Supplier order channels are manageable by authenticated users" ON public.supplier_order_channels;
CREATE POLICY "Supplier order channels are manageable by authenticated users" 
ON public.supplier_order_channels
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_order_channels TO authenticated;
