-- Migration: Add indexes on foreign keys and remove duplicate indexes
-- This improves query performance without affecting functionality

-- ============================================================================
-- ADD INDEXES ON FOREIGN KEYS
-- ============================================================================

-- Accessories
CREATE INDEX IF NOT EXISTS idx_accessories_default_warehouse_id 
ON public.accessories(default_warehouse_id);

-- Customer Order Items
CREATE INDEX IF NOT EXISTS idx_customer_order_items_currency_id 
ON public.customer_order_items(currency_id);

CREATE INDEX IF NOT EXISTS idx_customer_order_items_feetype_id 
ON public.customer_order_items(feetype_id);

CREATE INDEX IF NOT EXISTS idx_customer_order_items_vat_id 
ON public.customer_order_items(vat_id);

-- Linear Material Price History
CREATE INDEX IF NOT EXISTS idx_linear_material_price_history_changed_by 
ON public.linear_material_price_history(changed_by);

CREATE INDEX IF NOT EXISTS idx_linear_material_price_history_new_currency_id 
ON public.linear_material_price_history(new_currency_id);

CREATE INDEX IF NOT EXISTS idx_linear_material_price_history_new_vat_id 
ON public.linear_material_price_history(new_vat_id);

CREATE INDEX IF NOT EXISTS idx_linear_material_price_history_old_currency_id 
ON public.linear_material_price_history(old_currency_id);

CREATE INDEX IF NOT EXISTS idx_linear_material_price_history_old_vat_id 
ON public.linear_material_price_history(old_vat_id);

-- Linear Materials
CREATE INDEX IF NOT EXISTS idx_linear_materials_default_warehouse_id 
ON public.linear_materials(default_warehouse_id);

-- Materials
CREATE INDEX IF NOT EXISTS idx_materials_default_warehouse_id 
ON public.materials(default_warehouse_id);

-- POS Order Items
CREATE INDEX IF NOT EXISTS idx_pos_order_items_currency_id 
ON public.pos_order_items(currency_id);

CREATE INDEX IF NOT EXISTS idx_pos_order_items_feetype_id 
ON public.pos_order_items(feetype_id);

CREATE INDEX IF NOT EXISTS idx_pos_order_items_vat_id 
ON public.pos_order_items(vat_id);

-- Product Suggestions
CREATE INDEX IF NOT EXISTS idx_product_suggestions_accessory_id 
ON public.product_suggestions(accessory_id);

CREATE INDEX IF NOT EXISTS idx_product_suggestions_quote_id 
ON public.product_suggestions(quote_id);

CREATE INDEX IF NOT EXISTS idx_product_suggestions_raw_currency_id 
ON public.product_suggestions(raw_currency_id);

CREATE INDEX IF NOT EXISTS idx_product_suggestions_raw_partner_id 
ON public.product_suggestions(raw_partner_id);

CREATE INDEX IF NOT EXISTS idx_product_suggestions_raw_units_id 
ON public.product_suggestions(raw_units_id);

CREATE INDEX IF NOT EXISTS idx_product_suggestions_raw_vat_id 
ON public.product_suggestions(raw_vat_id);

CREATE INDEX IF NOT EXISTS idx_product_suggestions_reviewed_by 
ON public.product_suggestions(reviewed_by);

-- Purchase Order Items
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_accessory_id 
ON public.purchase_order_items(accessory_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_currency_id 
ON public.purchase_order_items(currency_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_linear_material_id 
ON public.purchase_order_items(linear_material_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_material_id 
ON public.purchase_order_items(material_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_units_id 
ON public.purchase_order_items(units_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_vat_id 
ON public.purchase_order_items(vat_id);

-- Quote Accessories
CREATE INDEX IF NOT EXISTS idx_quote_accessories_product_suggestion_id 
ON public.quote_accessories(product_suggestion_id);

-- Quote Payments
CREATE INDEX IF NOT EXISTS idx_quote_payments_created_by 
ON public.quote_payments(created_by);

-- Shop Order Items
CREATE INDEX IF NOT EXISTS idx_shop_order_items_accessory_id 
ON public.shop_order_items(accessory_id);

CREATE INDEX IF NOT EXISTS idx_shop_order_items_currency_id 
ON public.shop_order_items(currency_id);

CREATE INDEX IF NOT EXISTS idx_shop_order_items_linear_material_id 
ON public.shop_order_items(linear_material_id);

CREATE INDEX IF NOT EXISTS idx_shop_order_items_material_id 
ON public.shop_order_items(material_id);

CREATE INDEX IF NOT EXISTS idx_shop_order_items_units_id 
ON public.shop_order_items(units_id);

CREATE INDEX IF NOT EXISTS idx_shop_order_items_vat_id 
ON public.shop_order_items(vat_id);

-- ============================================================================
-- REMOVE DUPLICATE INDEXES
-- ============================================================================

-- Quote Edge Materials Breakdown
-- Keep: idx_quote_edge_materials_breakdown_pricing_id (more descriptive name)
-- Drop: idx_qemb_pricing_id
DROP INDEX IF EXISTS public.idx_qemb_pricing_id;

-- Quote Materials Pricing
-- Keep: idx_quote_materials_pricing_quote_id (more descriptive name)
-- Drop: idx_qmp_quote_id
DROP INDEX IF EXISTS public.idx_qmp_quote_id;

-- Quote Payments
-- Keep: idx_quote_payments_payment_date (more descriptive name)
-- Drop: idx_order_payments_payment_date
DROP INDEX IF EXISTS public.idx_order_payments_payment_date;

-- Quote Payments
-- Keep: idx_quote_payments_quote_id (more descriptive name, matches table)
-- Drop: idx_order_payments_order_id
DROP INDEX IF EXISTS public.idx_order_payments_order_id;

-- Quote Services Breakdown
-- Keep: idx_quote_services_breakdown_pricing_id (more descriptive name)
-- Drop: idx_qsb_pricing_id
DROP INDEX IF EXISTS public.idx_qsb_pricing_id;

