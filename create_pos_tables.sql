-- ============================================
-- POS Payment Processing System - MVP
-- ============================================
-- This migration creates:
-- 1. pos_orders table
-- 2. pos_order_items table
-- 3. pos_payments table
-- 4. Sequence and function for pos_order_number generation
-- 5. PostgreSQL function create_pos_sale() for atomic transactions
-- ============================================

-- ============================================
-- 1. Create sequence for POS order numbers
-- ============================================
CREATE SEQUENCE IF NOT EXISTS pos_order_number_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  OWNED BY NONE;

-- ============================================
-- 2. Create function to generate POS order number
-- Format: POS-YYYYMMDD-000123
-- ============================================
CREATE OR REPLACE FUNCTION generate_pos_order_number()
RETURNS varchar
LANGUAGE plpgsql
AS $$
DECLARE
  next_val bigint;
BEGIN
  SELECT nextval('pos_order_number_seq') INTO next_val;
  RETURN 'POS-' ||
         to_char(current_date, 'YYYYMMDD') ||
         '-' ||
         lpad(next_val::text, 6, '0');
END;
$$;

-- ============================================
-- 3. Create pos_orders table
-- ============================================
CREATE TABLE IF NOT EXISTS public.pos_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pos_order_number varchar(50) NOT NULL DEFAULT generate_pos_order_number(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE RESTRICT,
  customer_name varchar(255) NULL,
  customer_email varchar(255) NULL,
  customer_mobile varchar(50) NULL,
  billing_name varchar(255) NULL,
  billing_country varchar(100) NULL DEFAULT 'Magyarország',
  billing_city varchar(100) NULL,
  billing_postal_code varchar(20) NULL,
  billing_street varchar(255) NULL,
  billing_house_number varchar(20) NULL,
  billing_tax_number varchar(50) NULL,
  billing_company_reg_number varchar(50) NULL,
  discount_percentage numeric(5,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  subtotal_net numeric(12,2) NOT NULL DEFAULT 0,
  total_vat numeric(12,2) NOT NULL DEFAULT 0,
  total_gross numeric(12,2) NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','cancelled','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT pos_orders_pkey PRIMARY KEY (id),
  CONSTRAINT pos_orders_pos_order_number_key UNIQUE (pos_order_number)
);

-- Indexes for pos_orders
CREATE INDEX IF NOT EXISTS idx_pos_orders_worker_id ON public.pos_orders(worker_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_status ON public.pos_orders(status);
CREATE INDEX IF NOT EXISTS idx_pos_orders_created_at ON public.pos_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_pos_orders_deleted_at ON public.pos_orders(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 4. Create pos_order_items table
-- ============================================
CREATE TABLE IF NOT EXISTS public.pos_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pos_order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  item_type varchar(20) NOT NULL CHECK (item_type IN ('product','fee')),
  accessory_id uuid NULL REFERENCES public.accessories(id) ON DELETE RESTRICT,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT pos_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT chk_pos_order_items_product_accessory CHECK (
    (item_type = 'product' AND accessory_id IS NOT NULL) OR
    (item_type = 'fee' AND accessory_id IS NULL)
  )
);

-- Indexes for pos_order_items
CREATE INDEX IF NOT EXISTS idx_pos_order_items_pos_order_id ON public.pos_order_items(pos_order_id);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_item_type ON public.pos_order_items(item_type);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_accessory_id ON public.pos_order_items(accessory_id);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_deleted_at ON public.pos_order_items(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 5. Create pos_payments table
-- ============================================
CREATE TABLE IF NOT EXISTS public.pos_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pos_order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  payment_type varchar(20) NOT NULL CHECK (payment_type IN ('cash','card')),
  amount numeric(12,2) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending','failed','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_payments_pkey PRIMARY KEY (id)
);

-- Indexes for pos_payments
CREATE INDEX IF NOT EXISTS idx_pos_payments_pos_order_id ON public.pos_payments(pos_order_id);
CREATE INDEX IF NOT EXISTS idx_pos_payments_payment_type ON public.pos_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_pos_payments_status ON public.pos_payments(status);

-- ============================================
-- 6. Create trigger for updated_at on pos_orders
-- ============================================
CREATE OR REPLACE FUNCTION update_pos_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pos_orders_updated_at
  BEFORE UPDATE ON public.pos_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_orders_updated_at();

-- ============================================
-- 7. Create trigger for updated_at on pos_order_items
-- ============================================
CREATE OR REPLACE FUNCTION update_pos_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pos_order_items_updated_at
  BEFORE UPDATE ON public.pos_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_order_items_updated_at();

-- ============================================
-- 8. Create trigger for updated_at on pos_payments
-- ============================================
CREATE OR REPLACE FUNCTION update_pos_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pos_payments_updated_at
  BEFORE UPDATE ON public.pos_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_payments_updated_at();

-- ============================================
-- 9. Create PostgreSQL function for atomic POS sale creation
-- ============================================
CREATE OR REPLACE FUNCTION create_pos_sale(
  p_worker_id uuid,
  p_payment_type text,
  p_customer jsonb DEFAULT '{}'::jsonb,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_fees jsonb DEFAULT '[]'::jsonb,
  p_discount jsonb DEFAULT '{"percentage": 0, "amount": 0}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_warehouse_id uuid;
  v_pos_order_id uuid;
  v_pos_order_number varchar(50);
  v_item jsonb;
  v_fee jsonb;
  v_subtotal_net numeric(12,2) := 0;
  v_total_vat numeric(12,2) := 0;
  v_total_gross numeric(12,2) := 0;
  v_discount_percentage numeric(5,2);
  v_discount_amount numeric(12,2);
  v_item_total_net numeric(12,2);
  v_item_total_vat numeric(12,2);
  v_item_total_gross numeric(12,2);
  v_result jsonb;
BEGIN
  -- Step 1: Get default warehouse (is_active = true, LIMIT 1)
  SELECT id INTO v_warehouse_id
  FROM public.warehouses
  WHERE is_active = true
  LIMIT 1;

  IF v_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Nincs aktív raktár. Kérjük, állítson be legalább egy aktív raktárt.';
  END IF;

  -- Step 2: Calculate totals from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_total_net := (v_item->>'quantity')::numeric * (v_item->>'unit_price_net')::numeric;
    v_item_total_vat := (v_item->>'quantity')::numeric * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric);
    v_item_total_gross := (v_item->>'quantity')::numeric * (v_item->>'unit_price_gross')::numeric;
    
    v_subtotal_net := v_subtotal_net + v_item_total_net;
    v_total_vat := v_total_vat + v_item_total_vat;
    v_total_gross := v_total_gross + v_item_total_gross;
  END LOOP;

  -- Step 3: Add fees to totals
  FOR v_fee IN SELECT * FROM jsonb_array_elements(p_fees)
  LOOP
    v_item_total_net := (v_fee->>'quantity')::numeric * (v_fee->>'unit_price_net')::numeric;
    v_item_total_vat := (v_fee->>'quantity')::numeric * ((v_fee->>'unit_price_gross')::numeric - (v_fee->>'unit_price_net')::numeric);
    v_item_total_gross := (v_fee->>'quantity')::numeric * (v_fee->>'unit_price_gross')::numeric;
    
    v_subtotal_net := v_subtotal_net + v_item_total_net;
    v_total_vat := v_total_vat + v_item_total_vat;
    v_total_gross := v_total_gross + v_item_total_gross;
  END LOOP;

  -- Step 4: Apply discount
  v_discount_percentage := COALESCE((p_discount->>'percentage')::numeric, 0);
  v_discount_amount := COALESCE((p_discount->>'amount')::numeric, 0);
  
  -- If discount_amount is provided, use it; otherwise calculate from percentage
  IF v_discount_amount = 0 AND v_discount_percentage > 0 THEN
    v_discount_amount := (v_total_gross * v_discount_percentage) / 100;
  END IF;
  
  v_total_gross := v_total_gross - v_discount_amount;
  -- Recalculate VAT proportionally (simplified: reduce VAT by discount percentage)
  IF v_total_gross > 0 THEN
    v_total_vat := v_total_vat * (v_total_gross / (v_total_gross + v_discount_amount));
    v_subtotal_net := v_total_gross - v_total_vat;
  ELSE
    v_total_vat := 0;
    v_subtotal_net := 0;
  END IF;

  -- Step 5: Insert pos_order
  INSERT INTO public.pos_orders (
    worker_id,
    customer_name,
    customer_email,
    customer_mobile,
    billing_name,
    billing_country,
    billing_city,
    billing_postal_code,
    billing_street,
    billing_house_number,
    billing_tax_number,
    billing_company_reg_number,
    discount_percentage,
    discount_amount,
    subtotal_net,
    total_vat,
    total_gross,
    status
  ) VALUES (
    p_worker_id,
    NULLIF(p_customer->>'name', ''),
    NULLIF(p_customer->>'email', ''),
    NULLIF(p_customer->>'mobile', ''),
    NULLIF(p_customer->>'billing_name', ''),
    COALESCE(NULLIF(p_customer->>'billing_country', ''), 'Magyarország'),
    NULLIF(p_customer->>'billing_city', ''),
    NULLIF(p_customer->>'billing_postal_code', ''),
    NULLIF(p_customer->>'billing_street', ''),
    NULLIF(p_customer->>'billing_house_number', ''),
    NULLIF(p_customer->>'billing_tax_number', ''),
    NULLIF(p_customer->>'billing_company_reg_number', ''),
    v_discount_percentage,
    v_discount_amount,
    v_subtotal_net,
    v_total_vat,
    v_total_gross,
    'completed'
  )
  RETURNING id, pos_order_number INTO v_pos_order_id, v_pos_order_number;

  -- Step 6: Insert pos_order_items (products)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.pos_order_items (
      pos_order_id,
      item_type,
      accessory_id,
      product_name,
      sku,
      quantity,
      unit_price_net,
      unit_price_gross,
      vat_id,
      currency_id,
      total_net,
      total_vat,
      total_gross
    ) VALUES (
      v_pos_order_id,
      'product',
      (v_item->>'accessory_id')::uuid,
      v_item->>'name',
      NULLIF(v_item->>'sku', ''),
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price_net')::numeric,
      (v_item->>'unit_price_gross')::numeric,
      (v_item->>'vat_id')::uuid,
      (v_item->>'currency_id')::uuid,
      (v_item->>'quantity')::numeric * (v_item->>'unit_price_net')::numeric,
      (v_item->>'quantity')::numeric * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric),
      (v_item->>'quantity')::numeric * (v_item->>'unit_price_gross')::numeric
    );
  END LOOP;

  -- Step 7: Insert pos_order_items (fees)
  FOR v_fee IN SELECT * FROM jsonb_array_elements(p_fees)
  LOOP
    INSERT INTO public.pos_order_items (
      pos_order_id,
      item_type,
      feetype_id,
      product_name,
      sku,
      quantity,
      unit_price_net,
      unit_price_gross,
      vat_id,
      currency_id,
      total_net,
      total_vat,
      total_gross
    ) VALUES (
      v_pos_order_id,
      'fee',
      CASE WHEN v_fee->>'feetype_id' IS NOT NULL AND v_fee->>'feetype_id' != '' THEN (v_fee->>'feetype_id')::uuid ELSE NULL END,
      v_fee->>'name',
      NULL,
      (v_fee->>'quantity')::numeric,
      (v_fee->>'unit_price_net')::numeric,
      (v_fee->>'unit_price_gross')::numeric,
      (v_fee->>'vat_id')::uuid,
      (v_fee->>'currency_id')::uuid,
      (v_fee->>'quantity')::numeric * (v_fee->>'unit_price_net')::numeric,
      (v_fee->>'quantity')::numeric * ((v_fee->>'unit_price_gross')::numeric - (v_fee->>'unit_price_net')::numeric),
      (v_fee->>'quantity')::numeric * (v_fee->>'unit_price_gross')::numeric
    );
  END LOOP;

  -- Step 8: Insert pos_payment
  INSERT INTO public.pos_payments (
    pos_order_id,
    payment_type,
    amount,
    status
  ) VALUES (
    v_pos_order_id,
    p_payment_type,
    v_total_gross,
    'completed'
  );

  -- Step 9: Create stock movements for each product item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.stock_movements (
      warehouse_id,
      product_type,
      accessory_id,
      quantity,
      movement_type,
      source_type,
      source_id,
      note
    ) VALUES (
      v_warehouse_id,
      'accessory',
      (v_item->>'accessory_id')::uuid,
      -1 * (v_item->>'quantity')::numeric, -- negative for outgoing
      'out',
      'pos_sale',
      v_pos_order_id,
      'POS order: ' || v_pos_order_number
    );
  END LOOP;

  -- Step 10: Return result
  SELECT jsonb_build_object(
    'pos_order', (
      SELECT jsonb_build_object(
        'id', id,
        'pos_order_number', pos_order_number,
        'worker_id', worker_id,
        'total_gross', total_gross,
        'status', status,
        'created_at', created_at
      )
      FROM public.pos_orders
      WHERE id = v_pos_order_id
    ),
    'items', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'item_type', item_type,
          'product_name', product_name,
          'quantity', quantity,
          'total_gross', total_gross
        )
      )
      FROM public.pos_order_items
      WHERE pos_order_id = v_pos_order_id
    ),
    'payment', (
      SELECT jsonb_build_object(
        'id', id,
        'payment_type', payment_type,
        'amount', amount,
        'status', status
      )
      FROM public.pos_payments
      WHERE pos_order_id = v_pos_order_id
    )
  ) INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Hiba a POS rendelés létrehozásakor: %', SQLERRM;
END;
$$;

