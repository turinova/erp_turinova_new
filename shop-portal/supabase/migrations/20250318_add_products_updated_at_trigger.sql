-- Add trigger to auto-update updated_at for shoprenter_products table
-- This ensures that updated_at is always set when a product is modified

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS update_shoprenter_products_updated_at ON public.shoprenter_products;

-- Create trigger to automatically update updated_at column
CREATE TRIGGER update_shoprenter_products_updated_at
  BEFORE UPDATE ON public.shoprenter_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER update_shoprenter_products_updated_at ON public.shoprenter_products IS 
  'Automatically updates the updated_at timestamp when a product is modified. This is essential for tracking when products need to be synced to ShopRenter.';
