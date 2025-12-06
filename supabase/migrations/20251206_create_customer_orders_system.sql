-- ============================================
-- Customer Orders System
-- ============================================
-- This migration creates:
-- 1. customer_orders table
-- 2. customer_order_items table
-- 3. customer_order_payments table
-- 4. Sequence and function for customer_order_number generation
-- 5. Status update trigger function
-- 6. Handover function
-- ============================================

-- ============================================
-- 1. Create sequence for customer order numbers
-- ============================================
CREATE SEQUENCE IF NOT EXISTS customer_order_number_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  OWNED BY NONE;

-- ============================================
-- 2. Create function to generate customer order number
-- Format: CO-YYYYMMDD-000123
-- ============================================
CREATE OR REPLACE FUNCTION generate_customer_order_number()
RETURNS varchar(50)
LANGUAGE plpgsql
AS $$
DECLARE
  next_val bigint;
BEGIN
  SELECT nextval('customer_order_number_seq') INTO next_val;
  RETURN 'CO-' ||
         to_char(current_date, 'YYYYMMDD') ||
         '-' ||
         lpad(next_val::text, 6, '0');
END;
$$;

-- ============================================
-- 3. Create customer_orders table
-- ============================================
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number varchar(50) NOT NULL DEFAULT generate_customer_order_number(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE RESTRICT,
  customer_name varchar(255) NOT NULL,
  customer_email varchar(255) NULL,
  customer_mobile varchar(50) NULL,
  customer_discount numeric(5,2) DEFAULT 0,
  billing_name varchar(255) NULL,
  billing_country varchar(100) NULL DEFAULT 'Magyarország',
  billing_city varchar(100) NULL,
  billing_postal_code varchar(20) NULL,
  billing_street varchar(255) NULL,
  billing_house_number varchar(20) NULL,
  billing_tax_number varchar(50) NULL,
  billing_company_reg_number varchar(50) NULL,
  discount_percentage numeric(5,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  subtotal_net numeric(12,2) DEFAULT 0,
  total_vat numeric(12,2) DEFAULT 0,
  total_gross numeric(12,2) DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ordered', 'arrived', 'finished', 'handed_over', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  migrated_from_shop_order_id uuid NULL REFERENCES public.shop_orders(id) ON DELETE SET NULL,
  CONSTRAINT customer_orders_pkey PRIMARY KEY (id),
  CONSTRAINT customer_orders_order_number_key UNIQUE (order_number)
);

-- Indexes for customer_orders
CREATE INDEX IF NOT EXISTS idx_customer_orders_worker_id ON public.customer_orders(worker_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON public.customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created_at ON public.customer_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_orders_deleted_at ON public.customer_orders(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_orders_migrated_from_shop_order_id ON public.customer_orders(migrated_from_shop_order_id);

-- ============================================
-- 4. Create customer_order_items table
-- ============================================
CREATE TABLE IF NOT EXISTS public.customer_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  shop_order_item_id uuid NULL REFERENCES public.shop_order_items(id) ON DELETE SET NULL,
  item_type varchar(20) NOT NULL CHECK (item_type IN ('product', 'fee')),
  product_type varchar(30) NULL CHECK (product_type IN ('accessory', 'material', 'linear_material')),
  accessory_id uuid NULL REFERENCES public.accessories(id) ON DELETE RESTRICT,
  material_id uuid NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  linear_material_id uuid NULL REFERENCES public.linear_materials(id) ON DELETE RESTRICT,
  feetype_id uuid NULL REFERENCES public.feetypes(id) ON DELETE SET NULL,
  product_name varchar(255) NOT NULL,
  sku varchar(100) NULL,
  quantity numeric(10,2) NOT NULL,
  unit_price_net numeric(12,2) NOT NULL,
  unit_price_gross numeric(12,2) NOT NULL,
  vat_id uuid NOT NULL REFERENCES public.vat(id) ON DELETE RESTRICT,
  currency_id uuid NOT NULL REFERENCES public.currencies(id) ON DELETE RESTRICT,
  total_net numeric(12,2) NOT NULL,
  total_vat numeric(12,2) NOT NULL,
  total_gross numeric(12,2) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ordered', 'arrived', 'handed_over', 'cancelled')),
  purchase_order_item_id uuid NULL REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT customer_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT customer_order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_customer_order_items_product_fk CHECK (
    (item_type = 'product' AND (
      (accessory_id IS NOT NULL AND material_id IS NULL AND linear_material_id IS NULL) OR
      (material_id IS NOT NULL AND accessory_id IS NULL AND linear_material_id IS NULL) OR
      (linear_material_id IS NOT NULL AND accessory_id IS NULL AND material_id IS NULL) OR
      (accessory_id IS NULL AND material_id IS NULL AND linear_material_id IS NULL)
    )) OR
    (item_type = 'fee' AND accessory_id IS NULL AND material_id IS NULL AND linear_material_id IS NULL)
  )
);

-- Indexes for customer_order_items
CREATE INDEX IF NOT EXISTS idx_customer_order_items_order_id ON public.customer_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_order_items_item_type ON public.customer_order_items(item_type);
CREATE INDEX IF NOT EXISTS idx_customer_order_items_status ON public.customer_order_items(status) WHERE item_type = 'product';
CREATE INDEX IF NOT EXISTS idx_customer_order_items_accessory_id ON public.customer_order_items(accessory_id);
CREATE INDEX IF NOT EXISTS idx_customer_order_items_material_id ON public.customer_order_items(material_id);
CREATE INDEX IF NOT EXISTS idx_customer_order_items_linear_material_id ON public.customer_order_items(linear_material_id);
CREATE INDEX IF NOT EXISTS idx_customer_order_items_purchase_order_item_id ON public.customer_order_items(purchase_order_item_id);
CREATE INDEX IF NOT EXISTS idx_customer_order_items_shop_order_item_id ON public.customer_order_items(shop_order_item_id);
CREATE INDEX IF NOT EXISTS idx_customer_order_items_deleted_at ON public.customer_order_items(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 5. Create customer_order_payments table
-- ============================================
CREATE TABLE IF NOT EXISTS public.customer_order_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_order_id uuid NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  payment_type varchar(20) NOT NULL CHECK (payment_type IN ('cash', 'card')),
  amount numeric(12,2) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT customer_order_payments_pkey PRIMARY KEY (id),
  CONSTRAINT customer_order_payments_amount_positive CHECK (amount > 0)
);

-- Indexes for customer_order_payments
CREATE INDEX IF NOT EXISTS idx_customer_order_payments_order_id ON public.customer_order_payments(customer_order_id);
CREATE INDEX IF NOT EXISTS idx_customer_order_payments_payment_type ON public.customer_order_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_customer_order_payments_status ON public.customer_order_payments(status);
CREATE INDEX IF NOT EXISTS idx_customer_order_payments_deleted_at ON public.customer_order_payments(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 6. Create triggers for updated_at
-- ============================================
CREATE TRIGGER trigger_update_customer_orders_updated_at
  BEFORE UPDATE ON public.customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_customer_order_items_updated_at
  BEFORE UPDATE ON public.customer_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_customer_order_payments_updated_at
  BEFORE UPDATE ON public.customer_order_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. Create status update trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_customer_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
  v_total_active integer;
  v_deleted_status_count integer;
  v_non_deleted_count integer;
  v_handed_over_count integer;
  v_arrived_count integer;
  v_ordered_or_more_count integer;
  v_new_status varchar(20);
BEGIN
  -- Get the order_id from the affected row
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  -- Count all active product items (excluding fees and soft-deleted)
  SELECT COUNT(*)
  INTO v_total_active
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product';

  -- Count items with status = 'cancelled'
  SELECT COUNT(*)
  INTO v_deleted_status_count
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product'
    AND status = 'cancelled';

  -- Count non-cancelled items
  SELECT COUNT(*)
  INTO v_non_deleted_count
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product'
    AND status != 'cancelled';

  -- Count items that are handed_over
  SELECT COUNT(*)
  INTO v_handed_over_count
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product'
    AND status = 'handed_over';

  -- Count items that are arrived
  SELECT COUNT(*)
  INTO v_arrived_count
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product'
    AND status = 'arrived';

  -- Count items that are in_po, ordered, arrived, or handed_over
  SELECT COUNT(*)
  INTO v_ordered_or_more_count
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product'
    AND status IN ('in_po', 'ordered', 'arrived', 'handed_over');

  -- Determine the new status based on business logic (priority order)
  IF v_total_active = 0 OR (v_total_active > 0 AND v_deleted_status_count = v_total_active) THEN
    v_new_status := 'cancelled';
  ELSIF v_non_deleted_count > 0 AND v_handed_over_count = v_non_deleted_count THEN
    v_new_status := 'handed_over';
  ELSIF v_non_deleted_count > 0 AND v_arrived_count = v_non_deleted_count THEN
    v_new_status := 'finished';
  ELSIF v_non_deleted_count > 0 AND (v_arrived_count > 0 OR v_handed_over_count > 0) THEN
    v_new_status := 'arrived';
  ELSIF v_non_deleted_count > 0 AND v_ordered_or_more_count = v_non_deleted_count THEN
    -- Check if all items are 'in_po' or better
    v_new_status := 'ordered';
  ELSE
    v_new_status := 'open';
  END IF;

  -- Update the customer_orders status if it changed
  UPDATE public.customer_orders
  SET status = v_new_status,
      updated_at = NOW()
  WHERE id = v_order_id
    AND status != v_new_status;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger
CREATE TRIGGER trigger_update_customer_order_status
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_order_status();

-- ============================================
-- 8. Create hand_over_customer_order function
-- ============================================
CREATE OR REPLACE FUNCTION hand_over_customer_order(
  p_customer_order_id uuid,
  p_warehouse_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_order public.customer_orders%ROWTYPE;
  v_warehouse_id uuid;
  v_stock_movements_created integer := 0;
  v_item record;
BEGIN
  -- 1. Validate customer_order exists and is in 'finished' or 'arrived' status
  SELECT * INTO v_customer_order
  FROM public.customer_orders
  WHERE id = p_customer_order_id
    AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer order not found');
  END IF;
  
  IF v_customer_order.status NOT IN ('finished', 'arrived') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer order must be in finished or arrived status');
  END IF;
  
  -- 2. Determine warehouse
  IF p_warehouse_id IS NOT NULL THEN
    v_warehouse_id := p_warehouse_id;
  ELSE
    SELECT id INTO v_warehouse_id
    FROM public.warehouses
    WHERE is_active = true
    ORDER BY created_at
    LIMIT 1;
    
    IF v_warehouse_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No active warehouse found');
    END IF;
  END IF;
  
  -- 3. Update customer_order status to 'handed_over'
  UPDATE public.customer_orders
  SET status = 'handed_over',
      updated_at = NOW()
  WHERE id = p_customer_order_id;
  
  -- 4. Update all product items to 'handed_over' (fees don't have status)
  UPDATE public.customer_order_items
  SET status = 'handed_over',
      updated_at = NOW()
  WHERE order_id = p_customer_order_id
    AND deleted_at IS NULL
    AND item_type = 'product'
    AND status != 'handed_over';
  
  -- 5. Create stock movements (OUT) for all product items with FKs
  FOR v_item IN
    SELECT 
      coi.id,
      coi.quantity,
      coi.accessory_id,
      coi.material_id,
      coi.linear_material_id,
      coi.product_type
    FROM public.customer_order_items coi
    WHERE coi.order_id = p_customer_order_id
      AND coi.deleted_at IS NULL
      AND coi.item_type = 'product'
      AND (coi.accessory_id IS NOT NULL 
        OR coi.material_id IS NOT NULL 
        OR coi.linear_material_id IS NOT NULL)
  LOOP
    -- Create stock movement (OUT) - negative quantity
    INSERT INTO public.stock_movements (
      warehouse_id,
      product_type,
      accessory_id,
      material_id,
      linear_material_id,
      quantity,
      movement_type,
      source_type,
      source_id,
      note,
      stock_movement_number
    ) VALUES (
      v_warehouse_id,
      v_item.product_type,
      v_item.accessory_id,
      v_item.material_id,
      v_item.linear_material_id,
      -1 * v_item.quantity,  -- Negative for OUT
      'out',
      'customer_order_handover',
      p_customer_order_id,
      'Customer order handover: ' || v_customer_order.order_number,
      generate_stock_movement_number()
    );
    
    v_stock_movements_created := v_stock_movements_created + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'customer_order_id', p_customer_order_id,
    'customer_order_status', 'handed_over',
    'stock_movements_created', v_stock_movements_created
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================
-- 9. Update stock_movements source_type constraint
-- ============================================
-- Check if constraint exists and update it
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE public.stock_movements 
    DROP CONSTRAINT IF EXISTS stock_movements_source_type_check;
  
  -- Add new constraint with 'customer_order_handover'
  ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_source_type_check 
    CHECK (source_type IN (
      'purchase_receipt',
      'pos_sale',
      'adjustment',
      'customer_order_handover'
    ));
EXCEPTION
  WHEN OTHERS THEN
    -- If constraint doesn't exist, create it
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT stock_movements_source_type_check 
      CHECK (source_type IN (
        'purchase_receipt',
        'pos_sale',
        'adjustment',
        'customer_order_handover'
      ));
END $$;

-- ============================================
-- 10. Add customer_order_item_id to purchase_order_items
-- ============================================
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS customer_order_item_id uuid NULL REFERENCES public.customer_order_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_customer_order_item_id 
  ON public.purchase_order_items(customer_order_item_id);

-- ============================================
-- 11. Add pages to pages table
-- ============================================
INSERT INTO public.pages (path, name, description, category, is_active) VALUES
  ('/customer-order-items', 'Ügyfél rendelés tételek', 'Ügyfél rendelés tételek kezelése', 'Beszerzés', true),
  ('/fulfillment-orders', 'Ügyfél rendelések', 'Ügyfél rendelések kezelése', 'Értékesítés', true)
ON CONFLICT (path) DO NOTHING;

