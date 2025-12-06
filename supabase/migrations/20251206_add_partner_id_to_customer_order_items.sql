-- ============================================
-- Add partner_id column to customer_order_items
-- ============================================

-- Add partner_id column
ALTER TABLE public.customer_order_items 
ADD COLUMN IF NOT EXISTS partner_id uuid NULL;

-- Add foreign key constraint
ALTER TABLE public.customer_order_items
ADD CONSTRAINT customer_order_items_partner_id_fkey 
FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_customer_order_items_partner_id 
ON public.customer_order_items(partner_id) 
WHERE partner_id IS NOT NULL;

-- ============================================
-- Backfill existing customer_order_items with partner_id
-- ============================================

-- Update items with accessory_id: get partner_id from accessories
UPDATE public.customer_order_items coi
SET partner_id = a.partners_id
FROM public.accessories a
WHERE coi.accessory_id = a.id
  AND coi.partner_id IS NULL
  AND a.partners_id IS NOT NULL;

-- Update items with material_id: get partner_id from materials
UPDATE public.customer_order_items coi
SET partner_id = m.partners_id
FROM public.materials m
WHERE coi.material_id = m.id
  AND coi.partner_id IS NULL
  AND m.partners_id IS NOT NULL;

-- Update items with linear_material_id: get partner_id from linear_materials
UPDATE public.customer_order_items coi
SET partner_id = lm.partners_id
FROM public.linear_materials lm
WHERE coi.linear_material_id = lm.id
  AND coi.partner_id IS NULL
  AND lm.partners_id IS NOT NULL;

-- Update items with shop_order_item_id: get partner_id from shop_order_items
UPDATE public.customer_order_items coi
SET partner_id = soi.partner_id
FROM public.shop_order_items soi
WHERE coi.shop_order_item_id = soi.id
  AND coi.partner_id IS NULL
  AND soi.partner_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.customer_order_items.partner_id IS 
  'Supplier/partner ID for this item. Populated from accessories/materials/linear_materials or shop_order_items.';

