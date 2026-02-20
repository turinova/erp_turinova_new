-- Add bruttó (gross) price tracking to competitor_prices
-- This allows proper comparison with our nettó prices

-- Add price_gross column for the original scraped price (usually bruttó)
ALTER TABLE public.competitor_prices 
ADD COLUMN IF NOT EXISTS price_gross DECIMAL(15,2);

-- Add price_type to track what type of price was scraped
-- 'gross' = bruttó (with VAT), 'net' = nettó (without VAT), 'unknown' = couldn't determine
ALTER TABLE public.competitor_prices 
ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'gross';

-- Add VAT rate used for conversion (Hungary default is 27%)
ALTER TABLE public.competitor_prices 
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 27.00;

-- Add comments for clarity
COMMENT ON COLUMN public.competitor_prices.price IS 'Nettó (net) price - used for comparison with our products';
COMMENT ON COLUMN public.competitor_prices.price_gross IS 'Bruttó (gross) price - the original scraped price if it was with VAT';
COMMENT ON COLUMN public.competitor_prices.price_type IS 'Type of scraped price: gross (bruttó), net (nettó), or unknown';
COMMENT ON COLUMN public.competitor_prices.vat_rate IS 'VAT rate used for conversion (default 27% for Hungary)';

-- Rename original_price to original_price_gross for consistency
-- (This is the "was" price when there's a discount, also usually bruttó)
COMMENT ON COLUMN public.competitor_prices.original_price IS 'Original/list price before discount (usually bruttó)';
