-- Create currencies table
-- This table stores available currencies for suppliers and orders

CREATE TABLE IF NOT EXISTS public.currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    code VARCHAR(3) NOT NULL, -- ISO currency code (HUF, EUR, USD, etc.)
    symbol VARCHAR(10), -- Currency symbol (Ft, €, $, etc.)
    rate DECIMAL(10,4) NOT NULL DEFAULT 1.0000, -- Exchange rate relative to base currency
    is_base BOOLEAN DEFAULT false, -- Whether this is the base currency
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS currencies_name_unique_active 
ON public.currencies (name) 
WHERE deleted_at IS NULL;

-- Add unique constraint on code (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS currencies_code_unique_active 
ON public.currencies (code) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_currencies_deleted_at ON public.currencies(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for currencies table to automatically update updated_at
DROP TRIGGER IF EXISTS update_currencies_updated_at ON public.currencies;
CREATE TRIGGER update_currencies_updated_at
    BEFORE UPDATE ON public.currencies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for currencies table
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for currencies table
DROP POLICY IF EXISTS "Currencies are viewable by authenticated users" ON public.currencies;
CREATE POLICY "Currencies are viewable by authenticated users" 
ON public.currencies
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Currencies are manageable by authenticated users" ON public.currencies;
CREATE POLICY "Currencies are manageable by authenticated users" 
ON public.currencies
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.currencies TO authenticated;

-- Insert sample data with HUF as base currency
-- Insert only if they don't already exist (checking by name)
INSERT INTO public.currencies (name, code, symbol, rate, is_base) 
SELECT * FROM (VALUES 
    ('Forint', 'HUF', 'Ft', 1.0000, true),
    ('Euró', 'EUR', '€', 0.0025, false),
    ('Amerikai dollár', 'USD', '$', 0.0027, false),
    ('Font', 'GBP', '£', 0.0021, false)
) AS v(name, code, symbol, rate, is_base)
WHERE NOT EXISTS (
    SELECT 1 FROM public.currencies 
    WHERE currencies.name = v.name AND currencies.deleted_at IS NULL
);

-- Add foreign key constraint to suppliers table
ALTER TABLE public.suppliers 
ADD CONSTRAINT suppliers_default_currency_id_fkey 
FOREIGN KEY (default_currency_id) 
REFERENCES public.currencies(id) 
ON DELETE SET NULL;
