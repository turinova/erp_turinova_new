-- Update pos_order_items table to support materials and linear_materials
-- Run this in Supabase SQL Editor

-- 1. Add columns if they don't exist
ALTER TABLE public.pos_order_items 
ADD COLUMN IF NOT EXISTS product_type varchar(30) NULL,
ADD COLUMN IF NOT EXISTS material_id uuid NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS linear_material_id uuid NULL REFERENCES public.linear_materials(id) ON DELETE RESTRICT;

-- 2. Drop the old constraint
ALTER TABLE public.pos_order_items 
DROP CONSTRAINT IF EXISTS chk_pos_order_items_product_accessory;

-- 3. Add new constraint that allows accessory_id, material_id, or linear_material_id for products
ALTER TABLE public.pos_order_items 
ADD CONSTRAINT chk_pos_order_items_product_accessory CHECK (
  (item_type = 'product' AND (
    (accessory_id IS NOT NULL AND material_id IS NULL AND linear_material_id IS NULL) OR
    (material_id IS NOT NULL AND accessory_id IS NULL AND linear_material_id IS NULL) OR
    (linear_material_id IS NOT NULL AND accessory_id IS NULL AND material_id IS NULL)
  )) OR
  (item_type = 'fee' AND accessory_id IS NULL AND material_id IS NULL AND linear_material_id IS NULL)
);

-- 4. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_pos_order_items_product_type ON public.pos_order_items(product_type);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_material_id ON public.pos_order_items(material_id);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_linear_material_id ON public.pos_order_items(linear_material_id);

