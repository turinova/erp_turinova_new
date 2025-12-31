-- Add per-item discount fields to pos_order_items table
-- This allows individual items to have discounts (percentage or amount)
-- while maintaining the global discount on the order level

-- Add discount columns to pos_order_items
ALTER TABLE public.pos_order_items
ADD COLUMN IF NOT EXISTS discount_percentage numeric(5,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.pos_order_items.discount_percentage IS 'Item-level discount percentage (0-100)';
COMMENT ON COLUMN public.pos_order_items.discount_amount IS 'Item-level discount amount in currency units (calculated or manually set)';

-- Create index for potential queries on discounted items
CREATE INDEX IF NOT EXISTS idx_pos_order_items_discount_amount 
ON public.pos_order_items(discount_amount) 
WHERE discount_amount > 0;

