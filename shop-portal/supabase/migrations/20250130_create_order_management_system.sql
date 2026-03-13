-- =============================================================================
-- Order Management System - Complete Database Schema
-- =============================================================================
-- This migration creates the complete order management system including:
-- - Order buffer (for web order review)
-- - Orders and order items
-- - Shipping and payment methods (enhanced)
-- - All supporting tables, indexes, triggers, and RLS policies
-- =============================================================================

-- =============================================================================
-- 1. ENHANCE PAYMENT_METHODS TABLE (Add missing columns for order management)
-- =============================================================================

-- Add tenant_id if not exists (for multi-tenant support)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_methods' 
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.payment_methods ADD COLUMN tenant_id UUID;
  END IF;
END $$;

-- Add code column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_methods' 
    AND column_name = 'code'
  ) THEN
    ALTER TABLE public.payment_methods ADD COLUMN code TEXT;
  END IF;
END $$;

-- Add icon_url column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_methods' 
    AND column_name = 'icon_url'
  ) THEN
    ALTER TABLE public.payment_methods ADD COLUMN icon_url TEXT;
  END IF;
END $$;

-- Add requires_prepayment column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_methods' 
    AND column_name = 'requires_prepayment'
  ) THEN
    ALTER TABLE public.payment_methods ADD COLUMN requires_prepayment BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add payment_after_delivery column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_methods' 
    AND column_name = 'payment_after_delivery'
  ) THEN
    ALTER TABLE public.payment_methods ADD COLUMN payment_after_delivery BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create unique index for tenant_id + code if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_tenant_code 
ON public.payment_methods(tenant_id, code) 
WHERE deleted_at IS NULL AND code IS NOT NULL;

-- Create index for tenant_id if not exists
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_id 
ON public.payment_methods(tenant_id) 
WHERE tenant_id IS NOT NULL;

-- =============================================================================
-- 2. CREATE SHIPPING_METHODS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID, -- For multi-tenant support (nullable for now)
  name TEXT NOT NULL, -- Display name (e.g., "GLS csomagpont")
  code TEXT, -- Internal code (WSESHIP, GLS, etc.)
  extension TEXT, -- Extension type (GLSPARCELPOINT, etc.)
  icon_url TEXT, -- Icon/image URL for visual display
  requires_pickup_point BOOLEAN DEFAULT false, -- Whether pickup point ID is required
  supports_tracking BOOLEAN DEFAULT true, -- Whether tracking number can be added
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create indexes for shipping_methods
CREATE INDEX IF NOT EXISTS idx_shipping_methods_tenant_id 
ON public.shipping_methods(tenant_id) 
WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipping_methods_tenant_code 
ON public.shipping_methods(tenant_id, code) 
WHERE deleted_at IS NULL AND code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_methods_code 
ON public.shipping_methods(tenant_id, code) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_methods_is_active 
ON public.shipping_methods(is_active) 
WHERE deleted_at IS NULL;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_shipping_methods_updated_at ON public.shipping_methods;
CREATE TRIGGER update_shipping_methods_updated_at
  BEFORE UPDATE ON public.shipping_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shipping_methods
DROP POLICY IF EXISTS "Shipping methods are viewable by authenticated users" ON public.shipping_methods;
CREATE POLICY "Shipping methods are viewable by authenticated users" 
ON public.shipping_methods
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Shipping methods are manageable by authenticated users" ON public.shipping_methods;
CREATE POLICY "Shipping methods are manageable by authenticated users" 
ON public.shipping_methods
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_methods TO authenticated;

-- =============================================================================
-- 3. CREATE ORDER_BUFFER TABLE (Web Order Buffer - Like Thanaris)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID, -- For multi-tenant support (nullable for now)
  connection_id UUID, -- References webshop_connections(id) - will add FK later if table exists
  
  -- Platform Info
  platform_order_id TEXT NOT NULL, -- ShopRenter innerId
  platform_order_resource_id TEXT,
  
  -- Raw Webhook Data (JSONB for flexibility)
  webhook_data JSONB NOT NULL,
  
  -- Processing Status
  status TEXT DEFAULT 'pending', -- pending, processing, processed, failed, blacklisted
  processed_at TIMESTAMP,
  processed_by UUID REFERENCES public.users(id),
  error_message TEXT,
  
  -- Blacklist (if customer is blacklisted)
  is_blacklisted BOOLEAN DEFAULT false,
  blacklist_reason TEXT,
  
  -- Timestamps
  received_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT order_buffer_status_check CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'blacklisted'))
);

-- Create indexes for order_buffer
CREATE INDEX IF NOT EXISTS idx_order_buffer_tenant_id ON public.order_buffer(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_buffer_connection_id ON public.order_buffer(connection_id) WHERE connection_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_buffer_connection_platform_order 
ON public.order_buffer(connection_id, platform_order_id) 
WHERE connection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_buffer_status ON public.order_buffer(status);
CREATE INDEX IF NOT EXISTS idx_order_buffer_received_at ON public.order_buffer(received_at);
CREATE INDEX IF NOT EXISTS idx_order_buffer_is_blacklisted ON public.order_buffer(is_blacklisted) WHERE is_blacklisted = true;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_order_buffer_updated_at ON public.order_buffer;
CREATE TRIGGER update_order_buffer_updated_at
  BEFORE UPDATE ON public.order_buffer
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.order_buffer ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_buffer
DROP POLICY IF EXISTS "Order buffer is viewable by authenticated users" ON public.order_buffer;
CREATE POLICY "Order buffer is viewable by authenticated users" 
ON public.order_buffer
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Order buffer is manageable by authenticated users" ON public.order_buffer;
CREATE POLICY "Order buffer is manageable by authenticated users" 
ON public.order_buffer
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_buffer TO authenticated;

-- =============================================================================
-- 4. CREATE ORDERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID, -- For multi-tenant support (nullable for now)
  connection_id UUID, -- References webshop_connections(id) - will add FK later if table exists
  
  -- Order Identification
  order_number TEXT UNIQUE NOT NULL, -- ORD-YYYY-MM-DD-NNN
  platform_order_id TEXT, -- ShopRenter innerId
  platform_order_resource_id TEXT, -- ShopRenter resource ID
  invoice_number TEXT, -- From ShopRenter
  invoice_prefix TEXT,
  
  -- Customer Link
  customer_person_id UUID, -- References customer_persons(id) - will add FK later if table exists
  
  -- Customer Info (Snapshot at order time)
  customer_firstname TEXT NOT NULL,
  customer_lastname TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_group_id UUID, -- References customer_groups(id) - will add FK later if table exists
  
  -- Shipping Address
  shipping_firstname TEXT NOT NULL,
  shipping_lastname TEXT NOT NULL,
  shipping_company TEXT,
  shipping_address1 TEXT NOT NULL,
  shipping_address2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_postcode TEXT NOT NULL,
  shipping_country_code TEXT, -- ISO 2
  shipping_zone_name TEXT,
  shipping_method_id UUID REFERENCES public.shipping_methods(id),
  shipping_method_name TEXT, -- Snapshot from ShopRenter
  shipping_method_code TEXT, -- WSESHIP, GLS, etc.
  shipping_method_extension TEXT, -- Extension type
  shipping_receiving_point_id TEXT, -- Pickup point ID
  shipping_net_price NUMERIC(10,2),
  shipping_gross_price NUMERIC(10,2),
  shipping_additional_cost_net NUMERIC(10,2) DEFAULT 0,
  shipping_additional_cost_gross NUMERIC(10,2) DEFAULT 0,
  expected_delivery_date DATE,
  tracking_number TEXT,
  
  -- Billing Address
  billing_firstname TEXT NOT NULL,
  billing_lastname TEXT NOT NULL,
  billing_company TEXT,
  billing_address1 TEXT NOT NULL,
  billing_address2 TEXT,
  billing_city TEXT NOT NULL,
  billing_postcode TEXT NOT NULL,
  billing_country_code TEXT, -- ISO 2
  billing_zone_name TEXT,
  billing_tax_number TEXT,
  
  -- Payment Info
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_method_name TEXT, -- Snapshot from ShopRenter
  payment_method_code TEXT, -- COD, BANK_TRANSFER, etc.
  payment_method_after BOOLEAN DEFAULT true, -- true = pay later
  payment_net_price NUMERIC(10,2) DEFAULT 0,
  payment_gross_price NUMERIC(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending', -- pending, partial, paid, refunded
  payment_date TIMESTAMP,
  
  -- Order Totals
  subtotal_net NUMERIC(10,2) NOT NULL,
  subtotal_gross NUMERIC(10,2) NOT NULL,
  tax_amount NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) DEFAULT 0, -- Coupon + quantity discounts
  shipping_total_net NUMERIC(10,2) DEFAULT 0,
  shipping_total_gross NUMERIC(10,2) DEFAULT 0,
  payment_total_net NUMERIC(10,2) DEFAULT 0,
  payment_total_gross NUMERIC(10,2) DEFAULT 0,
  total_net NUMERIC(10,2) NOT NULL,
  total_gross NUMERIC(10,2) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'HUF',
  
  -- Status & Workflow
  status TEXT NOT NULL DEFAULT 'pending_review', -- pending_review, new, packing, shipped, delivered, cancelled, refunded
  platform_status_id TEXT, -- ShopRenter status ID
  platform_status_text TEXT, -- ShopRenter status text
  
  -- Stock & Fulfillment
  fulfillability_status TEXT DEFAULT 'unknown', -- unknown, checking, fully_fulfillable, partially_fulfillable, not_fulfillable, po_created
  stock_reserved BOOLEAN DEFAULT false, -- Whether stock is reserved for this order
  warehouse_id UUID, -- References warehouses(id) - will add FK later if table exists
  fulfillment_date DATE, -- When order was fulfilled
  
  -- Additional Info
  customer_comment TEXT,
  internal_notes TEXT, -- ERP-only notes
  language_code TEXT DEFAULT 'hu',
  ip_address TEXT,
  cart_token TEXT,
  loyalty_points_earned INTEGER DEFAULT 0,
  loyalty_points_used INTEGER DEFAULT 0,
  
  -- Timestamps
  order_date TIMESTAMP NOT NULL, -- From ShopRenter dateCreated
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  CONSTRAINT orders_status_check CHECK (status IN ('pending_review', 'new', 'packing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
  CONSTRAINT orders_fulfillability_status_check CHECK (fulfillability_status IN ('unknown', 'checking', 'fully_fulfillable', 'partially_fulfillable', 'not_fulfillable', 'po_created'))
);

-- Create indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON public.orders(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_connection_id ON public.orders(connection_id) WHERE connection_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_platform_order_id ON public.orders(connection_id, platform_order_id) WHERE connection_id IS NOT NULL AND platform_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_person_id ON public.orders(customer_person_id) WHERE customer_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillability_status ON public.orders(fulfillability_status);
CREATE INDEX IF NOT EXISTS idx_orders_stock_reserved ON public.orders(stock_reserved) WHERE stock_reserved = true;
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
DROP POLICY IF EXISTS "Orders are viewable by authenticated users" ON public.orders;
CREATE POLICY "Orders are viewable by authenticated users" 
ON public.orders
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Orders are manageable by authenticated users" ON public.orders;
CREATE POLICY "Orders are manageable by authenticated users" 
ON public.orders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;

-- =============================================================================
-- 5. CREATE ORDER_ITEMS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  
  -- Product Link
  product_id UUID, -- References shoprenter_products(id) - nullable if product doesn't exist
  
  -- Product Info (Snapshot at order time)
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  product_model_number TEXT, -- Manufacturer part number
  product_gtin TEXT, -- Barcode
  product_image_url TEXT,
  product_category TEXT, -- Comma-separated
  
  -- Pricing (Snapshot)
  unit_price_net NUMERIC(10,2) NOT NULL,
  unit_price_gross NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL, -- e.g., 27.00
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_net NUMERIC(10,2) NOT NULL,
  line_total_gross NUMERIC(10,2) NOT NULL,
  
  -- Physical Properties
  weight NUMERIC(10,3),
  weight_unit_id UUID, -- References weight_units(id) - will add FK later if table exists
  length NUMERIC(10,2),
  width NUMERIC(10,2),
  height NUMERIC(10,2),
  dimension_unit_id UUID, -- References units(id) - usually 'cm'
  
  -- Platform Info
  platform_order_item_id TEXT, -- ShopRenter orderProduct innerId
  platform_order_item_resource_id TEXT,
  
  -- Stock & Fulfillment
  fulfillability_status TEXT DEFAULT 'unknown', -- unknown, checking, fully_fulfillable, partially_fulfillable, not_fulfillable, po_created
  reserved_quantity INTEGER DEFAULT 0, -- How much is reserved from stock
  purchase_order_id UUID, -- References purchase_orders(id) - will add FK later if table exists
  purchase_order_item_id UUID, -- References purchase_order_items(id) - will add FK later if table exists
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, reserved, picked, packed, shipped, delivered, cancelled
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  CONSTRAINT order_items_status_check CHECK (status IN ('pending', 'reserved', 'picked', 'packed', 'shipped', 'delivered', 'cancelled')),
  CONSTRAINT order_items_fulfillability_status_check CHECK (fulfillability_status IN ('unknown', 'checking', 'fully_fulfillable', 'partially_fulfillable', 'not_fulfillable', 'po_created'))
);

-- Create indexes for order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_fulfillability_status ON public.order_items(fulfillability_status);
CREATE INDEX IF NOT EXISTS idx_order_items_purchase_order_id ON public.order_items(purchase_order_id) WHERE purchase_order_id IS NOT NULL;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_order_items_updated_at ON public.order_items;
CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_items
DROP POLICY IF EXISTS "Order items are viewable by authenticated users" ON public.order_items;
CREATE POLICY "Order items are viewable by authenticated users" 
ON public.order_items
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Order items are manageable by authenticated users" ON public.order_items;
CREATE POLICY "Order items are manageable by authenticated users" 
ON public.order_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;

-- =============================================================================
-- 6. CREATE ORDER_ITEM_OPTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_item_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  option_name TEXT NOT NULL, -- e.g., "Size", "Color"
  option_value TEXT NOT NULL, -- e.g., "Large", "Red"
  price_adjustment_net NUMERIC(10,2) DEFAULT 0, -- Can be negative
  price_adjustment_gross NUMERIC(10,2) DEFAULT 0,
  price_prefix TEXT CHECK (price_prefix IN ('+', '-')), -- + or -
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for order_item_options
CREATE INDEX IF NOT EXISTS idx_order_item_options_order_item_id ON public.order_item_options(order_item_id);

-- Enable RLS
ALTER TABLE public.order_item_options ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_item_options
DROP POLICY IF EXISTS "Order item options are viewable by authenticated users" ON public.order_item_options;
CREATE POLICY "Order item options are viewable by authenticated users" 
ON public.order_item_options
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Order item options are manageable by authenticated users" ON public.order_item_options;
CREATE POLICY "Order item options are manageable by authenticated users" 
ON public.order_item_options
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_options TO authenticated;

-- =============================================================================
-- 7. CREATE ORDER_ITEM_ADDONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  addon_name TEXT NOT NULL,
  addon_sku TEXT,
  addon_type TEXT,
  unit_price_net NUMERIC(10,2) NOT NULL,
  unit_price_gross NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total_net NUMERIC(10,2) NOT NULL,
  line_total_gross NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for order_item_addons
CREATE INDEX IF NOT EXISTS idx_order_item_addons_order_item_id ON public.order_item_addons(order_item_id);

-- Enable RLS
ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_item_addons
DROP POLICY IF EXISTS "Order item addons are viewable by authenticated users" ON public.order_item_addons;
CREATE POLICY "Order item addons are viewable by authenticated users" 
ON public.order_item_addons
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Order item addons are manageable by authenticated users" ON public.order_item_addons;
CREATE POLICY "Order item addons are manageable by authenticated users" 
ON public.order_item_addons
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_addons TO authenticated;

-- =============================================================================
-- 8. CREATE ORDER_TOTALS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_totals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Subtotal", "VAT (27%)", "Shipping", "Total"
  value_net NUMERIC(10,2) NOT NULL,
  value_gross NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL, -- SUB_TOTAL, TAX, SUB_TOTAL_WITH_TAX, SHIPPING, PAYMENT, COUPON, DISCOUNT, TOTAL
  sort_order INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT order_totals_type_check CHECK (type IN ('SUB_TOTAL', 'TAX', 'SUB_TOTAL_WITH_TAX', 'SHIPPING', 'PAYMENT', 'COUPON', 'DISCOUNT', 'TOTAL'))
);

-- Create indexes for order_totals
CREATE INDEX IF NOT EXISTS idx_order_totals_order_id ON public.order_totals(order_id);
CREATE INDEX IF NOT EXISTS idx_order_totals_type ON public.order_totals(type);

-- Enable RLS
ALTER TABLE public.order_totals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_totals
DROP POLICY IF EXISTS "Order totals are viewable by authenticated users" ON public.order_totals;
CREATE POLICY "Order totals are viewable by authenticated users" 
ON public.order_totals
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Order totals are manageable by authenticated users" ON public.order_totals;
CREATE POLICY "Order totals are manageable by authenticated users" 
ON public.order_totals
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_totals TO authenticated;

-- =============================================================================
-- 9. CREATE ORDER_STATUS_HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- ERP status
  platform_status_id TEXT, -- ShopRenter status ID
  platform_status_text TEXT, -- ShopRenter status text
  comment TEXT,
  changed_by UUID REFERENCES public.users(id), -- If manual change
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'webhook', -- webhook, manual, api
  
  CONSTRAINT order_status_history_source_check CHECK (source IN ('webhook', 'manual', 'api'))
);

-- Create indexes for order_status_history
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at ON public.order_status_history(changed_at);

-- Enable RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_status_history
DROP POLICY IF EXISTS "Order status history is viewable by authenticated users" ON public.order_status_history;
CREATE POLICY "Order status history is viewable by authenticated users" 
ON public.order_status_history
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Order status history is manageable by authenticated users" ON public.order_status_history;
CREATE POLICY "Order status history is manageable by authenticated users" 
ON public.order_status_history
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_status_history TO authenticated;

-- =============================================================================
-- 10. CREATE ORDER_PAYMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL, -- Can be negative for refunds
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_method_name TEXT, -- Snapshot
  payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
  transaction_id TEXT, -- From credit card payment
  reference_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  CONSTRAINT order_payments_amount_check CHECK (amount != 0)
);

-- Create indexes for order_payments
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON public.order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_payment_date ON public.order_payments(payment_date);

-- Enable RLS
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_payments
DROP POLICY IF EXISTS "Order payments are viewable by authenticated users" ON public.order_payments;
CREATE POLICY "Order payments are viewable by authenticated users" 
ON public.order_payments
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Order payments are manageable by authenticated users" ON public.order_payments;
CREATE POLICY "Order payments are manageable by authenticated users" 
ON public.order_payments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_payments TO authenticated;

-- =============================================================================
-- 11. CREATE ORDER_PLATFORM_MAPPINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_platform_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL, -- References webshop_connections(id) - will add FK later if table exists
  platform_order_id TEXT NOT NULL, -- ShopRenter innerId
  platform_order_resource_id TEXT,
  last_synced_from_platform_at TIMESTAMP,
  last_synced_to_platform_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT order_platform_mappings_unique UNIQUE(connection_id, platform_order_id)
);

-- Create indexes for order_platform_mappings
CREATE INDEX IF NOT EXISTS idx_order_platform_mappings_order_id ON public.order_platform_mappings(order_id);
CREATE INDEX IF NOT EXISTS idx_order_platform_mappings_connection_id ON public.order_platform_mappings(connection_id);

-- Enable RLS
ALTER TABLE public.order_platform_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_platform_mappings
DROP POLICY IF EXISTS "Order platform mappings are viewable by authenticated users" ON public.order_platform_mappings;
CREATE POLICY "Order platform mappings are viewable by authenticated users" 
ON public.order_platform_mappings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Order platform mappings are manageable by authenticated users" ON public.order_platform_mappings;
CREATE POLICY "Order platform mappings are manageable by authenticated users" 
ON public.order_platform_mappings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_platform_mappings TO authenticated;

-- =============================================================================
-- 12. CREATE FUNCTION: generate_order_number()
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  today_date TEXT;
  sequence_num INTEGER;
  order_num TEXT;
BEGIN
  -- Get today's date in YYYY-MM-DD format
  today_date := TO_CHAR(NOW(), 'YYYY-MM-DD');
  
  -- Get the next sequence number for today
  -- Count existing orders with today's date prefix
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM LENGTH('ORD-' || today_date || '-') + 1) AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM public.orders
  WHERE order_number LIKE 'ORD-' || today_date || '-%'
    AND deleted_at IS NULL;
  
  -- Format: ORD-YYYY-MM-DD-NNN (with leading zeros)
  order_num := 'ORD-' || today_date || '-' || LPAD(sequence_num::TEXT, 3, '0');
  
  RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 13. CREATE FUNCTION: update_order_payment_status()
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  order_total NUMERIC(10,2);
  total_paid NUMERIC(10,2);
  new_payment_status TEXT;
BEGIN
  -- Get order total
  SELECT total_gross INTO order_total
  FROM public.orders
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Calculate total paid (sum of all non-deleted payments)
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
    AND deleted_at IS NULL;
  
  -- Determine payment status
  IF total_paid = 0 THEN
    new_payment_status := 'pending';
  ELSIF total_paid < order_total THEN
    new_payment_status := 'partial';
  ELSIF total_paid >= order_total THEN
    new_payment_status := 'paid';
  ELSE
    new_payment_status := 'pending';
  END IF;
  
  -- Update order payment status
  UPDATE public.orders
  SET payment_status = new_payment_status
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating payment status
DROP TRIGGER IF EXISTS trigger_update_order_payment_status ON public.order_payments;
CREATE TRIGGER trigger_update_order_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON public.order_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_payment_status();

-- =============================================================================
-- 14. CREATE FUNCTION: record_order_status_change()
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only record if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history (
      order_id,
      status,
      platform_status_id,
      platform_status_text,
      changed_by,
      changed_at,
      source
    )
    VALUES (
      NEW.id,
      NEW.status,
      NEW.platform_status_id,
      NEW.platform_status_text,
      auth.uid(), -- Current user (if authenticated)
      NOW(),
      'manual' -- Default to manual, can be overridden
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-recording status changes
DROP TRIGGER IF EXISTS trigger_record_order_status_change ON public.orders;
CREATE TRIGGER trigger_record_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.record_order_status_change();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.order_buffer IS 'Buffer for web orders before processing into actual orders (like Thanaris)';
COMMENT ON TABLE public.orders IS 'Main orders table with complete order information';
COMMENT ON TABLE public.order_items IS 'Order line items with product snapshots';
COMMENT ON TABLE public.order_item_options IS 'Product options for order items (size, color, etc.)';
COMMENT ON TABLE public.order_item_addons IS 'Product addons for order items';
COMMENT ON TABLE public.order_totals IS 'Order total breakdown (subtotal, tax, shipping, etc.)';
COMMENT ON TABLE public.order_status_history IS 'Complete audit trail of order status changes';
COMMENT ON TABLE public.order_payments IS 'Payment records for orders (supports multiple payments and refunds)';
COMMENT ON TABLE public.order_platform_mappings IS 'Mappings between ERP orders and platform orders (ShopRenter)';
COMMENT ON TABLE public.shipping_methods IS 'Master data for shipping methods';
COMMENT ON FUNCTION public.generate_order_number IS 'Generates unique order numbers in format ORD-YYYY-MM-DD-NNN';
COMMENT ON FUNCTION public.update_order_payment_status IS 'Auto-updates order payment_status based on payment records';
COMMENT ON FUNCTION public.record_order_status_change IS 'Auto-records order status changes to history table';
