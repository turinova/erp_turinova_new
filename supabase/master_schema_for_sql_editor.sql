--
-- PostgreSQL database dump
--


-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
--
-- Name: machine_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.machine_type_enum AS ENUM (
    'Korpus'
);


--
-- Name: quote_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quote_status AS ENUM (
    'draft',
    'accepted',
    'in_production',
    'done',
    'rejected',
    'ordered',
    'ready',
    'finished',
    'cancelled'
);


--


--


--


--


--


--


--
--
-- Name: calculate_accessory_net_price(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_accessory_net_price() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Auto-calculate net_price when base_price or multiplier changes
  NEW.net_price = ROUND(NEW.base_price * NEW.multiplier);
  RETURN NEW;
END;
$$;


--
-- Name: calculate_linear_materials_price_per_m(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_linear_materials_price_per_m() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Calculate price_per_m from base_price * multiplier
    NEW.price_per_m = ROUND((NEW.base_price * NEW.multiplier)::numeric, 2);
    RETURN NEW;
END;
$$;


--
-- Name: calculate_materials_price_per_sqm(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_materials_price_per_sqm() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Calculate price_per_sqm from base_price * multiplier
    NEW.price_per_sqm = ROUND((NEW.base_price * NEW.multiplier)::numeric, 2);
    RETURN NEW;
END;
$$;


--
-- Name: create_pos_sale(uuid, text, jsonb, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_pos_sale(p_worker_id uuid, p_payment_type text, p_customer jsonb DEFAULT '{}'::jsonb, p_items jsonb DEFAULT '[]'::jsonb, p_fees jsonb DEFAULT '[]'::jsonb, p_discount jsonb DEFAULT '{"amount": 0, "percentage": 0}'::jsonb) RETURNS jsonb
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
  v_product_type varchar(30);
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

  -- Step 3: Calculate totals from fees
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
    v_product_type := COALESCE(v_item->>'product_type', 'accessory');
    
    INSERT INTO public.pos_order_items (
      pos_order_id,
      item_type,
      product_type,
      accessory_id,
      material_id,
      linear_material_id,
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
      v_product_type,
      CASE WHEN v_item->>'accessory_id' IS NOT NULL AND v_item->>'accessory_id' != '' THEN (v_item->>'accessory_id')::uuid ELSE NULL END,
      CASE WHEN v_item->>'material_id' IS NOT NULL AND v_item->>'material_id' != '' THEN (v_item->>'material_id')::uuid ELSE NULL END,
      CASE WHEN v_item->>'linear_material_id' IS NOT NULL AND v_item->>'linear_material_id' != '' THEN (v_item->>'linear_material_id')::uuid ELSE NULL END,
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
    v_product_type := COALESCE(v_item->>'product_type', 'accessory');
    
    IF v_product_type = 'accessory' AND v_item->>'accessory_id' IS NOT NULL AND v_item->>'accessory_id' != '' THEN
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
    ELSIF v_product_type = 'material' AND v_item->>'material_id' IS NOT NULL AND v_item->>'material_id' != '' THEN
      INSERT INTO public.stock_movements (
        warehouse_id,
        product_type,
        material_id,
        quantity,
        movement_type,
        source_type,
        source_id,
        note
      ) VALUES (
        v_warehouse_id,
        'material',
        (v_item->>'material_id')::uuid,
        -1 * (v_item->>'quantity')::numeric, -- negative for outgoing
        'out',
        'pos_sale',
        v_pos_order_id,
        'POS order: ' || v_pos_order_number
      );
    ELSIF v_product_type = 'linear_material' AND v_item->>'linear_material_id' IS NOT NULL AND v_item->>'linear_material_id' != '' THEN
      INSERT INTO public.stock_movements (
        warehouse_id,
        product_type,
        linear_material_id,
        quantity,
        movement_type,
        source_type,
        source_id,
        note
      ) VALUES (
        v_warehouse_id,
        'linear_material',
        (v_item->>'linear_material_id')::uuid,
        -1 * (v_item->>'quantity')::numeric, -- negative for outgoing
        'out',
        'pos_sale',
        v_pos_order_id,
        'POS order: ' || v_pos_order_number
      );
    END IF;
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


--
-- Name: generate_order_number(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number(target_date date DEFAULT CURRENT_DATE) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  date_str TEXT;
  next_num INTEGER;
  new_order_number TEXT;
  max_attempts INTEGER := 100; -- Safety limit
  attempt INTEGER := 0;
BEGIN
  date_str := TO_CHAR(target_date, 'YYYY-MM-DD');
  
  -- Find the highest number (including deleted orders)
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(order_number FROM 'ORD-\d{4}-\d{2}-\d{2}-(\d+)') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM orders
  WHERE order_number LIKE 'ORD-' || date_str || '-%';
  -- NOTE: Removed "AND deleted_at IS NULL" - we need to see ALL numbers
  
  -- Loop until we find an available number
  LOOP
    new_order_number := 'ORD-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
    
    -- Check if this number exists (deleted or not)
    IF NOT EXISTS (
      SELECT 1 FROM orders WHERE order_number = new_order_number
    ) THEN
      -- Number is available, return it
      RETURN new_order_number;
    END IF;
    
    -- Number exists, try next one
    next_num := next_num + 1;
    attempt := attempt + 1;
    
    -- Safety check to prevent infinite loop
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique order number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;


--
-- Name: FUNCTION generate_order_number(target_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_order_number(target_date date) IS 'Generate unique order number: ORD-YYYY-MM-DD-NNN';


--
-- Name: generate_pos_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_pos_order_number() RETURNS character varying
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


--
-- Name: generate_purchase_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_purchase_order_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_val bigint;
BEGIN
  -- Pl.: PO-20251116-000123
  SELECT nextval('purchase_order_number_seq') INTO next_val;

  RETURN 'PO-' ||
         to_char(current_date, 'YYYYMMDD') ||
         '-' ||
         lpad(next_val::text, 6, '0');
END;
$$;


--
-- Name: generate_quote_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_quote_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  new_quote_number VARCHAR(50);
  max_attempts INTEGER := 100; -- Safety limit
  attempt INTEGER := 0;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  
  -- Find the highest number (including deleted quotes)
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(quote_number FROM POSITION('-' IN quote_number) + 6)
      AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM public.quotes
  WHERE quote_number LIKE 'Q-' || current_year || '-%';
  -- NOTE: Removed "AND deleted_at IS NULL" - we need to see ALL numbers
  
  -- Loop until we find an available number
  LOOP
    new_quote_number := 'Q-' || current_year || '-' || LPAD(next_number::TEXT, 3, '0');
    
    -- Check if this number exists (deleted or not)
    IF NOT EXISTS (
      SELECT 1 FROM public.quotes WHERE quote_number = new_quote_number
    ) THEN
      -- Number is available, return it
      RETURN new_quote_number;
    END IF;
    
    -- Number exists, try next one
    next_number := next_number + 1;
    attempt := attempt + 1;
    
    -- Safety check to prevent infinite loop
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique quote number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;


--
-- Name: generate_quote_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_quote_order_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  date_str TEXT;
  next_num INTEGER;
  new_order_number TEXT;
BEGIN
  -- Format date as YYYY-MM-DD
  date_str := TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');
  
  -- Get the next number for this date from quotes table
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(order_number FROM 'ORD-\d{4}-\d{2}-\d{2}-(\d+)') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM quotes
  WHERE order_number LIKE 'ORD-' || date_str || '-%'
    AND deleted_at IS NULL;
  
  -- Generate new order number with zero-padded sequence
  new_order_number := 'ORD-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  
  RETURN new_order_number;
END;
$$;


--
-- Name: FUNCTION generate_quote_order_number(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_quote_order_number() IS 'Generate unique order number for quotes: ORD-YYYY-MM-DD-NNN';


--
-- Name: generate_shipment_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_shipment_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_val bigint;
BEGIN
  -- Pl.: SH-20251116-000123
  SELECT nextval('shipment_number_seq') INTO next_val;

  RETURN 'SH-' ||
         to_char(current_date, 'YYYYMMDD') ||
         '-' ||
         lpad(next_val::text, 6, '0');
END;
$$;


--
-- Name: generate_shop_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_shop_order_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_num INTEGER;
    order_num TEXT;
BEGIN
    SELECT nextval('shop_order_number_seq') INTO next_num;
    order_num := 'SO-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(next_num::TEXT, 3, '0');
    RETURN order_num;
END;
$$;


--
-- Name: generate_stock_movement_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_stock_movement_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_val bigint;
BEGIN
  SELECT nextval('stock_movement_number_seq') INTO next_val;

  RETURN 'SM-' ||
         to_char(current_date, 'YYYYMMDD') ||
         '-' ||
         lpad(next_val::text, 6, '0');
END;
$$;


--
-- Name: get_user_permissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_permissions(user_uuid uuid) RETURNS TABLE(page_path character varying, page_name character varying, can_access boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.path,
    p.name,
    COALESCE(up.can_access, false) as can_access
  FROM pages p
  LEFT JOIN user_permissions up ON p.id = up.page_id AND up.user_id = user_uuid
  WHERE p.is_active = true
  ORDER BY p.category, p.name;
END;
$$;


--
-- Name: grant_default_permissions_to_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_default_permissions_to_new_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  BEGIN
    -- Grant access to all active pages
    INSERT INTO public.user_permissions (user_id, page_id, can_access)
    SELECT 
      NEW.id,
      p.id,
      true
    FROM public.pages p
    WHERE p.is_active = true
    ON CONFLICT (user_id, page_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to grant default permissions: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_page_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_page_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_record RECORD;
BEGIN
  IF NEW.is_active = TRUE THEN
    FOR user_record IN SELECT id FROM auth.users LOOP
      INSERT INTO public.user_permissions (user_id, page_id, can_access)
      VALUES (user_record.id, NEW.id, TRUE)
      ON CONFLICT (user_id, page_id) DO UPDATE SET can_access = TRUE;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  page_record RECORD;
BEGIN
  FOR page_record IN SELECT id FROM public.pages WHERE is_active = TRUE LOOP
    INSERT INTO public.user_permissions (user_id, page_id, can_access)
    VALUES (NEW.id, page_record.id, TRUE)
    ON CONFLICT (user_id, page_id) DO UPDATE SET can_access = TRUE;
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: lookup_user_pin(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lookup_user_pin(pin_code character varying) RETURNS TABLE(user_id uuid, worker_id uuid, failed_attempts integer, locked_until timestamp with time zone, is_active boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.user_id,
    up.worker_id,
    up.failed_attempts,
    up.locked_until,
    up.is_active
  FROM public.user_pins up
  WHERE up.pin = pin_code
    AND up.is_active = true;
END;
$$;


--
-- Name: receive_shipment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receive_shipment(p_shipment_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_shipment record;
  v_po record;
  v_item record;
  v_received_count integer := 0;
  v_total_items integer := 0;
  v_all_received boolean := true;
  v_po_item record;
  v_received_qty numeric(10,2);
  v_ordered_qty numeric(10,2);
  v_result jsonb;
BEGIN
  -- Validate shipment exists and is in draft status
  SELECT s.*, po.id as po_id, po.status as po_status
  INTO v_shipment
  FROM public.shipments s
  INNER JOIN public.purchase_orders po ON po.id = s.purchase_order_id
  WHERE s.id = p_shipment_id
    AND s.deleted_at IS NULL
    AND po.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Shipment not found or deleted'
    );
  END IF;

  IF v_shipment.status != 'draft' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Shipment can only be received from draft status'
    );
  END IF;

  -- Load purchase order
  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = v_shipment.purchase_order_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Purchase order not found'
    );
  END IF;

  -- Check if any items have quantity_received > 0
  SELECT COUNT(*) INTO v_received_count
  FROM public.shipment_items si
  WHERE si.shipment_id = p_shipment_id
    AND si.deleted_at IS NULL
    AND si.quantity_received > 0;

  IF v_received_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No received quantities provided'
    );
  END IF;

  -- Process each shipment item and create stock movements
  FOR v_item IN
    SELECT 
      si.id,
      si.purchase_order_item_id,
      si.quantity_received,
      poi.product_type,
      poi.accessory_id,
      poi.material_id,
      poi.linear_material_id
    FROM public.shipment_items si
    INNER JOIN public.purchase_order_items poi ON poi.id = si.purchase_order_item_id
    WHERE si.shipment_id = p_shipment_id
      AND si.deleted_at IS NULL
      AND poi.deleted_at IS NULL
      AND si.quantity_received > 0
  LOOP
    -- Insert stock movement
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
      v_shipment.warehouse_id,
      v_item.product_type,
      v_item.accessory_id,
      v_item.material_id,
      v_item.linear_material_id,
      v_item.quantity_received, -- positive quantity
      'in',
      'purchase_receipt',
      p_shipment_id,
      v_shipment.note,
      generate_stock_movement_number()
    );
  END LOOP;

  -- Update shipment status to 'received'
  UPDATE public.shipments
  SET status = 'received',
      updated_at = now()
  WHERE id = p_shipment_id;

  -- Recalculate PO status based on ALL shipments for this PO
  -- For each PO item, sum received quantities across all shipments
  FOR v_po_item IN
    SELECT poi.id, poi.quantity as ordered_qty
    FROM public.purchase_order_items poi
    WHERE poi.purchase_order_id = v_po.id
      AND poi.deleted_at IS NULL
  LOOP
    -- Sum received quantities from all shipments for this PO item
    SELECT COALESCE(SUM(si.quantity_received), 0) INTO v_received_qty
    FROM public.shipment_items si
    INNER JOIN public.shipments s ON s.id = si.shipment_id
    WHERE si.purchase_order_item_id = v_po_item.id
      AND s.purchase_order_id = v_po.id
      AND si.deleted_at IS NULL
      AND s.deleted_at IS NULL
      AND s.status = 'received';

    v_ordered_qty := v_po_item.ordered_qty;

    -- If any item is not fully received, PO is partial
    IF v_received_qty < v_ordered_qty THEN
      v_all_received := false;
      EXIT; -- Exit loop early
    END IF;
  END LOOP;

  -- Update PO status
  IF v_all_received THEN
    UPDATE public.purchase_orders
    SET status = 'received',
        updated_at = now()
    WHERE id = v_po.id;
  ELSE
    UPDATE public.purchase_orders
    SET status = 'partial',
        updated_at = now()
    WHERE id = v_po.id;
  END IF;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'shipment_id', p_shipment_id,
    'shipment_status', 'received',
    'po_status', CASE WHEN v_all_received THEN 'received' ELSE 'partial' END,
    'items_received', v_received_count
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback is automatic in a function
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


--
-- Name: sync_user_from_auth(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_from_auth() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, created_at, updated_at, last_sign_in_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.created_at, 
    NEW.updated_at, 
    NEW.last_sign_in_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = EXCLUDED.updated_at,
    last_sign_in_at = EXCLUDED.last_sign_in_at;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_user_from_auth failed for user %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: update_accessories_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_accessories_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_feetypes_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_feetypes_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_media_files_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_media_files_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_pos_order(uuid, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pos_order(p_pos_order_id uuid, p_customer_data jsonb, p_discount jsonb, p_items jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_warehouse_id uuid;
  v_pos_order_number varchar(50);
  v_subtotal_net numeric(12,2) := 0;
  v_total_vat numeric(12,2) := 0;
  v_total_gross numeric(12,2) := 0;
  v_discount_percentage numeric(5,2) := 0;
  v_discount_amount numeric(12,2) := 0;
  v_item_total_net numeric(12,2);
  v_item_total_vat numeric(12,2);
  v_item_total_gross numeric(12,2);
  v_item jsonb;
  v_existing_item record;
  v_existing_movement record;
  v_old_quantity numeric(10,2);
  v_product_type varchar(30);
  v_new_quantity numeric(10,2);
  v_quantity_diff numeric(10,2);
  v_result jsonb;
BEGIN
  -- Step 1: Verify order exists
  SELECT pos_order_number INTO v_pos_order_number
  FROM public.pos_orders
  WHERE id = p_pos_order_id AND deleted_at IS NULL;
  
  IF v_pos_order_number IS NULL THEN
    RAISE EXCEPTION 'POS rendelés nem található vagy törölve';
  END IF;

  -- Step 2: Get warehouse_id from existing stock movements (or query active warehouse)
  SELECT warehouse_id INTO v_warehouse_id
  FROM public.stock_movements
  WHERE source_type = 'pos_sale' AND source_id = p_pos_order_id
  LIMIT 1;
  
  -- If no existing movements, get active warehouse
  IF v_warehouse_id IS NULL THEN
    SELECT id INTO v_warehouse_id
    FROM public.warehouses
    WHERE is_active = true
    LIMIT 1;
    
    IF v_warehouse_id IS NULL THEN
      RAISE EXCEPTION 'Nincs aktív raktár. Kérjük, állítson be legalább egy aktív raktárt.';
    END IF;
  END IF;

  -- Step 3: Calculate totals from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Skip soft-deleted items (they will be handled separately)
    IF v_item->>'deleted' = 'true' THEN
      CONTINUE;
    END IF;
    
    v_item_total_net := (v_item->>'quantity')::numeric * (v_item->>'unit_price_net')::numeric;
    v_item_total_vat := (v_item->>'quantity')::numeric * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric);
    v_item_total_gross := (v_item->>'quantity')::numeric * (v_item->>'unit_price_gross')::numeric;
    
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

  -- Step 5: Update pos_orders
  UPDATE public.pos_orders
  SET
    customer_name = NULLIF(p_customer_data->>'customer_name', ''),
    customer_email = NULLIF(p_customer_data->>'customer_email', ''),
    customer_mobile = NULLIF(p_customer_data->>'customer_mobile', ''),
    billing_name = NULLIF(p_customer_data->>'billing_name', ''),
    billing_country = COALESCE(NULLIF(p_customer_data->>'billing_country', ''), 'Magyarország'),
    billing_city = NULLIF(p_customer_data->>'billing_city', ''),
    billing_postal_code = NULLIF(p_customer_data->>'billing_postal_code', ''),
    billing_street = NULLIF(p_customer_data->>'billing_street', ''),
    billing_house_number = NULLIF(p_customer_data->>'billing_house_number', ''),
    billing_tax_number = NULLIF(p_customer_data->>'billing_tax_number', ''),
    billing_company_reg_number = NULLIF(p_customer_data->>'billing_company_reg_number', ''),
    discount_percentage = v_discount_percentage,
    discount_amount = v_discount_amount,
    subtotal_net = v_subtotal_net,
    total_vat = v_total_vat,
    total_gross = v_total_gross,
    updated_at = now()
  WHERE id = p_pos_order_id;

  -- Step 6: Handle pos_order_items (update, insert, soft-delete)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- If item has an ID, it's an existing item
    IF v_item->>'id' IS NOT NULL AND v_item->>'id' != '' THEN
      -- Check if item should be soft-deleted
      IF v_item->>'deleted' = 'true' THEN
        -- Soft delete the item
        UPDATE public.pos_order_items
        SET deleted_at = now(), updated_at = now()
        WHERE id = (v_item->>'id')::uuid;
        
        -- If it's a product (not a fee), create reverse stock movement
        IF (v_item->>'item_type')::text = 'product' THEN
          -- Get the old quantity and product info from the item before deletion
          SELECT quantity, product_type, accessory_id, material_id, linear_material_id INTO v_existing_item
          FROM public.pos_order_items
          WHERE id = (v_item->>'id')::uuid;
          
          -- Create IN movement to reverse the original OUT movement
          IF v_existing_item.quantity IS NOT NULL AND v_existing_item.quantity > 0 THEN
            IF v_existing_item.accessory_id IS NOT NULL THEN
              INSERT INTO public.stock_movements (
                warehouse_id, product_type, accessory_id, quantity, movement_type, source_type, source_id, note
              ) VALUES (
                v_warehouse_id, 'accessory', v_existing_item.accessory_id, v_existing_item.quantity, 'in', 'pos_sale', p_pos_order_id,
                'POS rendelés módosítás: tétel törölve - ' || v_pos_order_number
              );
            ELSIF v_existing_item.material_id IS NOT NULL THEN
              INSERT INTO public.stock_movements (
                warehouse_id, product_type, material_id, quantity, movement_type, source_type, source_id, note
              ) VALUES (
                v_warehouse_id, 'material', v_existing_item.material_id, v_existing_item.quantity, 'in', 'pos_sale', p_pos_order_id,
                'POS rendelés módosítás: tétel törölve - ' || v_pos_order_number
              );
            ELSIF v_existing_item.linear_material_id IS NOT NULL THEN
              INSERT INTO public.stock_movements (
                warehouse_id, product_type, linear_material_id, quantity, movement_type, source_type, source_id, note
              ) VALUES (
                v_warehouse_id, 'linear_material', v_existing_item.linear_material_id, v_existing_item.quantity, 'in', 'pos_sale', p_pos_order_id,
                'POS rendelés módosítás: tétel törölve - ' || v_pos_order_number
              );
            END IF;
          END IF;
        END IF;
      ELSE
        -- Update existing item
        SELECT quantity INTO v_old_quantity
        FROM public.pos_order_items
        WHERE id = (v_item->>'id')::uuid;
        
        v_new_quantity := (v_item->>'quantity')::numeric;
        v_item_total_net := v_new_quantity * (v_item->>'unit_price_net')::numeric;
        v_item_total_vat := v_new_quantity * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric);
        v_item_total_gross := v_new_quantity * (v_item->>'unit_price_gross')::numeric;
        
        UPDATE public.pos_order_items
        SET
          product_type = COALESCE((v_item->>'product_type')::varchar, 'accessory'),
          product_name = v_item->>'product_name',
          sku = NULLIF(v_item->>'sku', ''),
          quantity = v_new_quantity,
          unit_price_net = (v_item->>'unit_price_net')::numeric,
          unit_price_gross = (v_item->>'unit_price_gross')::numeric,
          vat_id = (v_item->>'vat_id')::uuid,
          currency_id = (v_item->>'currency_id')::uuid,
          accessory_id = CASE WHEN (v_item->>'accessory_id') IS NOT NULL AND (v_item->>'accessory_id') != '' THEN (v_item->>'accessory_id')::uuid ELSE NULL END,
          material_id = CASE WHEN (v_item->>'material_id') IS NOT NULL AND (v_item->>'material_id') != '' THEN (v_item->>'material_id')::uuid ELSE NULL END,
          linear_material_id = CASE WHEN (v_item->>'linear_material_id') IS NOT NULL AND (v_item->>'linear_material_id') != '' THEN (v_item->>'linear_material_id')::uuid ELSE NULL END,
          total_net = v_item_total_net,
          total_vat = v_item_total_vat,
          total_gross = v_item_total_gross,
          updated_at = now()
        WHERE id = (v_item->>'id')::uuid;
        
        -- If it's a product (not a fee), handle stock movements for all product types
        IF (v_item->>'item_type')::text = 'product' THEN
          -- Calculate quantity difference
          v_quantity_diff := v_new_quantity - COALESCE(v_old_quantity, 0);
          
          IF v_quantity_diff != 0 THEN
            -- Determine product type and ID
            IF (v_item->>'accessory_id') IS NOT NULL AND (v_item->>'accessory_id') != '' THEN
              -- Accessory
              IF v_quantity_diff < 0 THEN
                INSERT INTO public.stock_movements (
                  warehouse_id, product_type, accessory_id, quantity, movement_type, source_type, source_id, note
                ) VALUES (
                  v_warehouse_id, 'accessory', (v_item->>'accessory_id')::uuid, ABS(v_quantity_diff), 'in', 'pos_sale', p_pos_order_id,
                  'POS rendelés módosítás: mennyiség csökkentve - ' || v_pos_order_number
                );
              ELSE
                INSERT INTO public.stock_movements (
                  warehouse_id, product_type, accessory_id, quantity, movement_type, source_type, source_id, note
                ) VALUES (
                  v_warehouse_id, 'accessory', (v_item->>'accessory_id')::uuid, -1 * v_quantity_diff, 'out', 'pos_sale', p_pos_order_id,
                  'POS rendelés módosítás: mennyiség növelve - ' || v_pos_order_number
                );
              END IF;
            ELSIF (v_item->>'material_id') IS NOT NULL AND (v_item->>'material_id') != '' THEN
              -- Material
              IF v_quantity_diff < 0 THEN
                INSERT INTO public.stock_movements (
                  warehouse_id, product_type, material_id, quantity, movement_type, source_type, source_id, note
                ) VALUES (
                  v_warehouse_id, 'material', (v_item->>'material_id')::uuid, ABS(v_quantity_diff), 'in', 'pos_sale', p_pos_order_id,
                  'POS rendelés módosítás: mennyiség csökkentve - ' || v_pos_order_number
                );
              ELSE
                INSERT INTO public.stock_movements (
                  warehouse_id, product_type, material_id, quantity, movement_type, source_type, source_id, note
                ) VALUES (
                  v_warehouse_id, 'material', (v_item->>'material_id')::uuid, -1 * v_quantity_diff, 'out', 'pos_sale', p_pos_order_id,
                  'POS rendelés módosítás: mennyiség növelve - ' || v_pos_order_number
                );
              END IF;
            ELSIF (v_item->>'linear_material_id') IS NOT NULL AND (v_item->>'linear_material_id') != '' THEN
              -- Linear material
              IF v_quantity_diff < 0 THEN
                INSERT INTO public.stock_movements (
                  warehouse_id, product_type, linear_material_id, quantity, movement_type, source_type, source_id, note
                ) VALUES (
                  v_warehouse_id, 'linear_material', (v_item->>'linear_material_id')::uuid, ABS(v_quantity_diff), 'in', 'pos_sale', p_pos_order_id,
                  'POS rendelés módosítás: mennyiség csökkentve - ' || v_pos_order_number
                );
              ELSE
                INSERT INTO public.stock_movements (
                  warehouse_id, product_type, linear_material_id, quantity, movement_type, source_type, source_id, note
                ) VALUES (
                  v_warehouse_id, 'linear_material', (v_item->>'linear_material_id')::uuid, -1 * v_quantity_diff, 'out', 'pos_sale', p_pos_order_id,
                  'POS rendelés módosítás: mennyiség növelve - ' || v_pos_order_number
                );
              END IF;
            END IF;
          END IF;
        END IF;
      END IF;
    ELSE
      -- New item (no ID)
      IF v_item->>'deleted' != 'true' THEN
        v_item_total_net := (v_item->>'quantity')::numeric * (v_item->>'unit_price_net')::numeric;
        v_item_total_vat := (v_item->>'quantity')::numeric * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric);
        v_item_total_gross := (v_item->>'quantity')::numeric * (v_item->>'unit_price_gross')::numeric;
        
        INSERT INTO public.pos_order_items (
          pos_order_id,
          item_type,
          product_type,
          accessory_id,
          material_id,
          linear_material_id,
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
          p_pos_order_id,
          (v_item->>'item_type')::varchar,
          COALESCE((v_item->>'product_type')::varchar, 'accessory'),
          CASE WHEN (v_item->>'accessory_id') IS NOT NULL AND (v_item->>'accessory_id') != '' THEN (v_item->>'accessory_id')::uuid ELSE NULL END,
          CASE WHEN (v_item->>'material_id') IS NOT NULL AND (v_item->>'material_id') != '' THEN (v_item->>'material_id')::uuid ELSE NULL END,
          CASE WHEN (v_item->>'linear_material_id') IS NOT NULL AND (v_item->>'linear_material_id') != '' THEN (v_item->>'linear_material_id')::uuid ELSE NULL END,
          CASE WHEN (v_item->>'feetype_id') IS NOT NULL AND (v_item->>'feetype_id') != '' THEN (v_item->>'feetype_id')::uuid ELSE NULL END,
          v_item->>'product_name',
          NULLIF(v_item->>'sku', ''),
          (v_item->>'quantity')::numeric,
          (v_item->>'unit_price_net')::numeric,
          (v_item->>'unit_price_gross')::numeric,
          (v_item->>'vat_id')::uuid,
          (v_item->>'currency_id')::uuid,
          v_item_total_net,
          v_item_total_vat,
          v_item_total_gross
        );
        
        -- If it's a new product (not a fee), create OUT stock movement for all product types
        IF (v_item->>'item_type')::text = 'product' THEN
          IF (v_item->>'accessory_id') IS NOT NULL AND (v_item->>'accessory_id') != '' THEN
            INSERT INTO public.stock_movements (
              warehouse_id, product_type, accessory_id, quantity, movement_type, source_type, source_id, note
            ) VALUES (
              v_warehouse_id, 'accessory', (v_item->>'accessory_id')::uuid, -1 * (v_item->>'quantity')::numeric, 'out', 'pos_sale', p_pos_order_id,
              'POS rendelés módosítás: új tétel hozzáadva - ' || v_pos_order_number
            );
          ELSIF (v_item->>'material_id') IS NOT NULL AND (v_item->>'material_id') != '' THEN
            INSERT INTO public.stock_movements (
              warehouse_id, product_type, material_id, quantity, movement_type, source_type, source_id, note
            ) VALUES (
              v_warehouse_id, 'material', (v_item->>'material_id')::uuid, -1 * (v_item->>'quantity')::numeric, 'out', 'pos_sale', p_pos_order_id,
              'POS rendelés módosítás: új tétel hozzáadva - ' || v_pos_order_number
            );
          ELSIF (v_item->>'linear_material_id') IS NOT NULL AND (v_item->>'linear_material_id') != '' THEN
            INSERT INTO public.stock_movements (
              warehouse_id, product_type, linear_material_id, quantity, movement_type, source_type, source_id, note
            ) VALUES (
              v_warehouse_id, 'linear_material', (v_item->>'linear_material_id')::uuid, -1 * (v_item->>'quantity')::numeric, 'out', 'pos_sale', p_pos_order_id,
              'POS rendelés módosítás: új tétel hozzáadva - ' || v_pos_order_number
            );
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Step 7: Return updated order data
  SELECT jsonb_build_object(
    'success', true,
    'pos_order_id', p_pos_order_id,
    'pos_order_number', v_pos_order_number,
    'subtotal_net', v_subtotal_net,
    'total_vat', v_total_vat,
    'total_gross', v_total_gross,
    'discount_percentage', v_discount_percentage,
    'discount_amount', v_discount_amount
  ) INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Hiba a POS rendelés frissítésekor: %', SQLERRM;
END;
$$;


--
-- Name: update_pos_order_items_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pos_order_items_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_pos_orders_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pos_orders_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_pos_payments_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pos_payments_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_production_machines_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_production_machines_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_quote_accessories_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_quote_accessories_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_quote_fees_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_quote_fees_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_quote_payment_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_quote_payment_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_quote_id UUID;
  v_final_total NUMERIC(12,2);
  v_total_paid NUMERIC(12,2);
  v_new_status TEXT;
  v_tolerance CONSTANT NUMERIC := 1.0; -- 1 Ft tolerance for rounding
BEGIN
  -- Get quote_id from the affected row
  IF (TG_OP = 'DELETE') THEN
    v_quote_id := OLD.quote_id;
  ELSE
    v_quote_id := NEW.quote_id;
  END IF;

  -- Get quote's final total
  SELECT final_total_after_discount INTO v_final_total
  FROM quotes
  WHERE id = v_quote_id;

  -- Calculate total paid (excluding soft-deleted payments)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM quote_payments
  WHERE quote_id = v_quote_id
    AND deleted_at IS NULL;

  -- Determine payment status with tolerance
  IF v_total_paid = 0 THEN
    v_new_status := 'not_paid';
  ELSIF v_total_paid >= v_final_total - v_tolerance THEN
    -- Consider "paid" if within 1 Ft of final total (handles rounding)
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Update quote's payment status
  UPDATE quotes
  SET payment_status = v_new_status,
      updated_at = NOW()
  WHERE id = v_quote_id;

  RETURN NULL; -- Result is ignored for AFTER triggers
END;
$$;


--
-- Name: FUNCTION update_quote_payment_status(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_quote_payment_status() IS 'Auto-calculate and update quote payment_status based on payments';


--
-- Name: update_quote_status_timestamps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_quote_status_timestamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only update if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Update the appropriate timestamp based on new status
    CASE NEW.status
      WHEN 'ordered' THEN 
        -- Only set if not already set (preserve first transition)
        IF NEW.ordered_at IS NULL THEN
          NEW.ordered_at := NOW();
        END IF;
        
      WHEN 'in_production' THEN 
        IF NEW.in_production_at IS NULL THEN
          NEW.in_production_at := NOW();
        END IF;
        
      WHEN 'ready' THEN 
        IF NEW.ready_at IS NULL THEN
          NEW.ready_at := NOW();
        END IF;
        
      WHEN 'finished' THEN 
        IF NEW.finished_at IS NULL THEN
          NEW.finished_at := NOW();
        END IF;
        
      WHEN 'cancelled' THEN 
        IF NEW.cancelled_at IS NULL THEN
          NEW.cancelled_at := NOW();
        END IF;
        
      ELSE
        -- No timestamp update for 'draft' or other statuses
        NULL;
    END CASE;
    
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION update_quote_status_timestamps(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_quote_status_timestamps() IS 'Automatically updates status timestamp columns when quote status changes. Only sets timestamp on first transition to preserve original date.';


--
-- Name: update_shop_order_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_shop_order_status() RETURNS trigger
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

  -- Count all active items (excluding soft-deleted: deleted_at IS NULL)
  SELECT COUNT(*)
  INTO v_total_active
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL;

  -- Count items with status = 'deleted'
  SELECT COUNT(*)
  INTO v_deleted_status_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'deleted';

  -- Count non-deleted items (status != 'deleted')
  SELECT COUNT(*)
  INTO v_non_deleted_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status != 'deleted';

  -- Count items that are handed_over
  SELECT COUNT(*)
  INTO v_handed_over_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'handed_over';

  -- Count items that are arrived
  SELECT COUNT(*)
  INTO v_arrived_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'arrived';

  -- Count items that are ordered, arrived, or handed_over
  SELECT COUNT(*)
  INTO v_ordered_or_more_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status IN ('ordered', 'arrived', 'handed_over');

  -- Determine the new status based on business logic (priority order)
  IF v_total_active = 0 OR (v_total_active > 0 AND v_deleted_status_count = v_total_active) THEN
    -- Priority 1: All items are deleted → order is deleted
    v_new_status := 'deleted';
  ELSIF v_non_deleted_count > 0 AND v_handed_over_count = v_non_deleted_count THEN
    -- Priority 2: All non-deleted items are handed_over → order is handed_over (final state)
    v_new_status := 'handed_over';
  ELSIF v_non_deleted_count > 0 AND v_arrived_count = v_non_deleted_count THEN
    -- Priority 3: All non-deleted items are arrived → order is finished (ready for handover)
    v_new_status := 'finished';
  ELSIF v_non_deleted_count > 0 AND (v_arrived_count > 0 OR v_handed_over_count > 0) THEN
    -- Priority 4: Mix of arrived/handed_over (partial handover) → order stays at arrived
    v_new_status := 'arrived';
  ELSIF v_non_deleted_count > 0 AND v_ordered_or_more_count = v_non_deleted_count THEN
    -- Priority 5: All non-deleted items are ordered or better → order is ordered
    v_new_status := 'ordered';
  ELSE
    -- Priority 6: Otherwise → order is open (some items still need to be ordered)
    v_new_status := 'open';
  END IF;

  -- Update the shop_orders status if it changed
  UPDATE shop_orders
  SET status = v_new_status,
      updated_at = NOW()
  WHERE id = v_order_id
    AND status != v_new_status; -- Only update if status actually changed

  -- Return the appropriate row based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


--
-- Name: FUNCTION update_shop_order_status(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_shop_order_status() IS 'Automatically updates shop_orders.status based on shop_order_items statuses:
   Priority 1: deleted - All items have status=deleted
   Priority 2: handed_over - All non-deleted items handed over to customer (final state)
   Priority 3: finished - All non-deleted items have arrived (ready for handover)
   Priority 4: arrived - Mix of arrived/handed_over (partial handover in progress)
   Priority 5: ordered - All non-deleted items are ordered or better
   Priority 6: open - Some non-deleted items still need ordering';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_user_pins_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_pins_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


--


SET default_tablespace = '';

SET default_table_access_method = heap;

--
--
-- Name: accessories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    sku character varying(100) NOT NULL,
    net_price integer NOT NULL,
    vat_id uuid NOT NULL,
    currency_id uuid NOT NULL,
    units_id uuid NOT NULL,
    partners_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    base_price integer NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.38,
    barcode character varying(64),
    last_purchase_net_price integer,
    is_stock_tracked boolean DEFAULT true NOT NULL,
    default_warehouse_id uuid,
    image_url text,
    CONSTRAINT accessories_base_price_positive CHECK ((base_price > 0)),
    CONSTRAINT accessories_multiplier_range CHECK (((multiplier >= 1.00) AND (multiplier <= 5.00)))
);


--
-- Name: COLUMN accessories.image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accessories.image_url IS 'URL to the product image';


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: currencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.currencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    rate numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    shop_order_item_id uuid,
    product_type character varying(30) NOT NULL,
    accessory_id uuid,
    material_id uuid,
    linear_material_id uuid,
    quantity numeric(10,2) NOT NULL,
    net_price integer NOT NULL,
    vat_id uuid NOT NULL,
    currency_id uuid NOT NULL,
    units_id uuid NOT NULL,
    description character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    note text,
    CONSTRAINT purchase_order_items_net_price_positive CHECK ((net_price >= 0)),
    CONSTRAINT purchase_order_items_product_type_check CHECK (((product_type)::text = ANY ((ARRAY['accessory'::character varying, 'material'::character varying, 'linear_material'::character varying])::text[]))),
    CONSTRAINT purchase_order_items_quantity_positive CHECK ((quantity > (0)::numeric))
);


--
-- Name: shipment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipment_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shipment_id uuid NOT NULL,
    purchase_order_item_id uuid NOT NULL,
    quantity_received numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    note text,
    CONSTRAINT shipment_items_quantity_nonnegative CHECK ((quantity_received >= (0)::numeric))
);


--
-- Name: shipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    partner_id uuid NOT NULL,
    shipment_date date DEFAULT CURRENT_DATE NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    note text,
    shipment_number character varying(50) DEFAULT public.generate_shipment_number() NOT NULL,
    CONSTRAINT shipments_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'received'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_id uuid NOT NULL,
    product_type character varying(30) NOT NULL,
    accessory_id uuid,
    material_id uuid,
    linear_material_id uuid,
    quantity numeric(10,2) NOT NULL,
    movement_type character varying(20) NOT NULL,
    source_type character varying(30) NOT NULL,
    source_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    stock_movement_number character varying(50) DEFAULT public.generate_stock_movement_number() NOT NULL,
    CONSTRAINT stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying, 'adjustment'::character varying])::text[]))),
    CONSTRAINT stock_movements_product_type_check CHECK (((product_type)::text = ANY ((ARRAY['accessory'::character varying, 'material'::character varying, 'linear_material'::character varying])::text[]))),
    CONSTRAINT stock_movements_quantity_nonzero CHECK ((quantity <> (0)::numeric))
);


--
-- Name: current_stock; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.current_stock AS
 WITH stock_aggregated AS (
         SELECT stock_movements.warehouse_id,
            stock_movements.product_type,
            stock_movements.accessory_id,
            stock_movements.material_id,
            stock_movements.linear_material_id,
            sum(stock_movements.quantity) AS quantity_on_hand,
            max(stock_movements.created_at) AS last_movement_at
           FROM public.stock_movements
          GROUP BY stock_movements.warehouse_id, stock_movements.product_type, stock_movements.accessory_id, stock_movements.material_id, stock_movements.linear_material_id
        ), material_costs AS (
         SELECT sm.material_id,
            sm.warehouse_id,
            avg(poi.net_price) AS avg_cost_per_unit
           FROM (((public.stock_movements sm
             JOIN public.shipments s ON (((s.id = sm.source_id) AND ((sm.source_type)::text = 'purchase_receipt'::text))))
             JOIN public.shipment_items si ON (((si.shipment_id = s.id) AND (si.deleted_at IS NULL))))
             JOIN public.purchase_order_items poi ON (((poi.id = si.purchase_order_item_id) AND (poi.material_id = sm.material_id) AND ((poi.product_type)::text = 'material'::text) AND (poi.deleted_at IS NULL))))
          WHERE (((sm.movement_type)::text = 'in'::text) AND ((sm.product_type)::text = 'material'::text))
          GROUP BY sm.material_id, sm.warehouse_id
        ), linear_material_costs AS (
         SELECT sm.linear_material_id,
            sm.warehouse_id,
            avg(poi.net_price) AS avg_cost_per_unit
           FROM (((public.stock_movements sm
             JOIN public.shipments s ON (((s.id = sm.source_id) AND ((sm.source_type)::text = 'purchase_receipt'::text))))
             JOIN public.shipment_items si ON (((si.shipment_id = s.id) AND (si.deleted_at IS NULL))))
             JOIN public.purchase_order_items poi ON (((poi.id = si.purchase_order_item_id) AND (poi.linear_material_id = sm.linear_material_id) AND ((poi.product_type)::text = 'linear_material'::text) AND (poi.deleted_at IS NULL))))
          WHERE (((sm.movement_type)::text = 'in'::text) AND ((sm.product_type)::text = 'linear_material'::text))
          GROUP BY sm.linear_material_id, sm.warehouse_id
        )
 SELECT sa.warehouse_id,
    sa.product_type,
    sa.accessory_id,
    sa.material_id,
    sa.linear_material_id,
    sa.quantity_on_hand,
    sa.last_movement_at,
        CASE
            WHEN (((sa.product_type)::text = 'accessory'::text) AND (sa.accessory_id IS NOT NULL)) THEN (sa.quantity_on_hand * (COALESCE(a.net_price, 0))::numeric)
            WHEN (((sa.product_type)::text = 'material'::text) AND (sa.material_id IS NOT NULL)) THEN (sa.quantity_on_hand * COALESCE(mc.avg_cost_per_unit, (0)::numeric))
            WHEN (((sa.product_type)::text = 'linear_material'::text) AND (sa.linear_material_id IS NOT NULL)) THEN (sa.quantity_on_hand * COALESCE(lmc.avg_cost_per_unit, (0)::numeric))
            ELSE (0)::numeric
        END AS stock_value
   FROM (((stock_aggregated sa
     LEFT JOIN public.accessories a ON (((a.id = sa.accessory_id) AND ((sa.product_type)::text = 'accessory'::text) AND (a.deleted_at IS NULL))))
     LEFT JOIN material_costs mc ON (((mc.material_id = sa.material_id) AND (mc.warehouse_id = sa.warehouse_id) AND ((sa.product_type)::text = 'material'::text))))
     LEFT JOIN linear_material_costs lmc ON (((lmc.linear_material_id = sa.linear_material_id) AND (lmc.warehouse_id = sa.warehouse_id) AND ((sa.product_type)::text = 'linear_material'::text))));


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    email character varying,
    mobile character varying,
    discount_percent numeric(5,2) DEFAULT 0,
    billing_name character varying,
    billing_country character varying DEFAULT 'Magyarország'::character varying,
    billing_city character varying,
    billing_postal_code character varying,
    billing_street character varying,
    billing_house_number character varying,
    billing_tax_number character varying,
    billing_company_reg_number character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    sms_notification boolean DEFAULT true NOT NULL
);


--
-- Name: COLUMN customers.sms_notification; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.sms_notification IS 'Indicates whether the customer wants to receive SMS notifications. Defaults to true (opt-out model).';


--
-- Name: cutting_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cutting_fees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fee_per_meter numeric(10,2) DEFAULT 300 NOT NULL,
    currency_id uuid NOT NULL,
    vat_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    panthelyfuras_fee_per_hole numeric(10,2) DEFAULT 50,
    duplungolas_fee_per_sqm numeric(10,2) DEFAULT 200,
    szogvagas_fee_per_panel numeric(10,2) DEFAULT 100
);


--
-- Name: TABLE cutting_fees; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cutting_fees IS 'Global cutting fee configuration';


--
-- Name: COLUMN cutting_fees.fee_per_meter; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cutting_fees.fee_per_meter IS 'Fee charged per meter of cutting (default: 300 Ft/m)';


--
-- Name: COLUMN cutting_fees.currency_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cutting_fees.currency_id IS 'Currency for cutting fee';


--
-- Name: COLUMN cutting_fees.vat_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cutting_fees.vat_id IS 'VAT rate for cutting fee';


--
-- Name: COLUMN cutting_fees.panthelyfuras_fee_per_hole; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cutting_fees.panthelyfuras_fee_per_hole IS 'Fee charged per hinge hole (default: 50 Ft/hole)';


--
-- Name: COLUMN cutting_fees.duplungolas_fee_per_sqm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cutting_fees.duplungolas_fee_per_sqm IS 'Fee charged per square meter for groove cutting (default: 200 Ft/m²)';


--
-- Name: COLUMN cutting_fees.szogvagas_fee_per_panel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cutting_fees.szogvagas_fee_per_panel IS 'Fee charged per panel for angle cutting (default: 100 Ft/panel)';


--
-- Name: edge_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edge_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    type character varying(10) NOT NULL,
    thickness numeric(5,2) NOT NULL,
    width integer NOT NULL,
    decor character varying(10) NOT NULL,
    price numeric(10,0) NOT NULL,
    vat_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    "ráhagyás" integer DEFAULT 0 NOT NULL,
    favourite_priority integer
);


--
-- Name: COLUMN edge_materials.active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edge_materials.active IS 'Whether this edge material is currently active for use. Inactive edge materials are excluded from optimization.';


--
-- Name: COLUMN edge_materials."ráhagyás"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edge_materials."ráhagyás" IS 'Edge overhang in millimeters. Used in optimization calculations. Default is 0mm.';


--
-- Name: feetypes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feetypes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    net_price numeric(12,2) NOT NULL,
    vat_id uuid NOT NULL,
    currency_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN feetypes.net_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feetypes.net_price IS 'Net price (can be negative for discounts/adjustments)';


--
-- Name: linear_material_price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linear_material_price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    linear_material_id uuid NOT NULL,
    old_price numeric(10,2),
    new_price numeric(10,2) NOT NULL,
    old_currency_id uuid,
    new_currency_id uuid,
    old_vat_id uuid,
    new_vat_id uuid,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: linear_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linear_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    width numeric(10,2) NOT NULL,
    length numeric(10,2) NOT NULL,
    thickness numeric(10,2) NOT NULL,
    type text NOT NULL,
    image_url text,
    price_per_m numeric(10,2) DEFAULT 0 NOT NULL,
    currency_id uuid,
    vat_id uuid,
    on_stock boolean DEFAULT true NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    base_price integer NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.38 NOT NULL,
    partners_id uuid,
    units_id uuid NOT NULL,
    barcode character varying(64),
    last_purchase_net_price integer,
    is_stock_tracked boolean DEFAULT true NOT NULL,
    default_warehouse_id uuid,
    CONSTRAINT linear_materials_base_price_positive CHECK ((base_price > 0)),
    CONSTRAINT linear_materials_multiplier_range CHECK (((multiplier >= 1.00) AND (multiplier <= 5.00)))
);


--
-- Name: machine_edge_material_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_edge_material_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    edge_material_id uuid NOT NULL,
    machine_code character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    machine_type public.machine_type_enum DEFAULT 'Korpus'::public.machine_type_enum NOT NULL
);


--
-- Name: machine_linear_material_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_linear_material_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    linear_material_id uuid NOT NULL,
    machine_type text DEFAULT 'Korpus'::text NOT NULL,
    machine_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: machine_material_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_material_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid,
    machine_code character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    machine_type public.machine_type_enum NOT NULL
);


--
-- Name: material_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name character varying NOT NULL,
    row_id uuid NOT NULL,
    action character varying NOT NULL,
    actor character varying,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: material_group_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_group_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid,
    kerf_mm integer DEFAULT 3,
    trim_top_mm integer DEFAULT 0,
    trim_right_mm integer DEFAULT 0,
    trim_bottom_mm integer DEFAULT 0,
    trim_left_mm integer DEFAULT 0,
    rotatable boolean DEFAULT true,
    waste_multi double precision DEFAULT 1.0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: material_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: material_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid,
    kerf_mm integer NOT NULL,
    trim_top_mm integer NOT NULL,
    trim_right_mm integer NOT NULL,
    trim_bottom_mm integer NOT NULL,
    trim_left_mm integer NOT NULL,
    rotatable boolean NOT NULL,
    waste_multi double precision NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    usage_limit numeric(3,2) DEFAULT 0.65,
    CONSTRAINT material_settings_usage_limit_check CHECK (((usage_limit >= (0)::numeric) AND (usage_limit <= (1)::numeric)))
);


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid,
    group_id uuid,
    name character varying NOT NULL,
    length_mm integer NOT NULL,
    width_mm integer NOT NULL,
    thickness_mm integer NOT NULL,
    grain_direction boolean DEFAULT false,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    on_stock boolean DEFAULT true NOT NULL,
    price_per_sqm numeric(10,2) DEFAULT 0 NOT NULL,
    currency_id uuid,
    vat_id uuid,
    active boolean DEFAULT true NOT NULL,
    base_price integer NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.38 NOT NULL,
    partners_id uuid,
    units_id uuid NOT NULL,
    barcode character varying(64),
    last_purchase_net_price integer,
    is_stock_tracked boolean DEFAULT true NOT NULL,
    default_warehouse_id uuid,
    CONSTRAINT materials_base_price_positive CHECK ((base_price > 0)),
    CONSTRAINT materials_multiplier_range CHECK (((multiplier >= 1.00) AND (multiplier <= 5.00)))
);


--
-- Name: COLUMN materials.price_per_sqm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.materials.price_per_sqm IS 'Price per square meter in the specified currency';


--
-- Name: COLUMN materials.currency_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.materials.currency_id IS 'Foreign key to currencies table';


--
-- Name: COLUMN materials.vat_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.materials.vat_id IS 'Foreign key to vat table';


--
-- Name: COLUMN materials.active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.materials.active IS 'Whether this material is currently active for use in optimization and operations. Inactive materials are excluded from calculations.';


--
-- Name: material_effective_settings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.material_effective_settings AS
 SELECT m.id AS material_id,
    COALESCE(ms.kerf_mm, mgs.kerf_mm, 3) AS kerf_mm,
    COALESCE(ms.trim_top_mm, mgs.trim_top_mm, 0) AS trim_top_mm,
    COALESCE(ms.trim_right_mm, mgs.trim_right_mm, 0) AS trim_right_mm,
    COALESCE(ms.trim_bottom_mm, mgs.trim_bottom_mm, 0) AS trim_bottom_mm,
    COALESCE(ms.trim_left_mm, mgs.trim_left_mm, 0) AS trim_left_mm,
    COALESCE(ms.rotatable, mgs.rotatable, true) AS rotatable,
    COALESCE(ms.waste_multi, mgs.waste_multi, (1.0)::double precision) AS waste_multi,
    COALESCE(ms.usage_limit, 0.65) AS usage_limit,
    m.grain_direction
   FROM (((public.materials m
     LEFT JOIN public.material_settings ms ON ((m.id = ms.material_id)))
     LEFT JOIN public.material_groups mg ON ((m.group_id = mg.id)))
     LEFT JOIN public.material_group_settings mgs ON ((mg.id = mgs.group_id)))
  WHERE (m.deleted_at IS NULL);


--
-- Name: material_inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_inventory_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    sku character varying(100) NOT NULL,
    transaction_type character varying(20) NOT NULL,
    quantity integer NOT NULL,
    unit_price integer,
    reference_type character varying(30) NOT NULL,
    reference_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    comment text,
    CONSTRAINT check_price_required CHECK (((((transaction_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying])::text[])) AND (unit_price IS NOT NULL)) OR (((transaction_type)::text = ANY ((ARRAY['reserved'::character varying, 'released'::character varying])::text[])) AND (unit_price IS NULL)))),
    CONSTRAINT check_quantity_sign CHECK (((((transaction_type)::text = 'in'::text) AND (quantity > 0)) OR (((transaction_type)::text = 'out'::text) AND (quantity < 0)) OR (((transaction_type)::text = ANY ((ARRAY['reserved'::character varying, 'released'::character varying])::text[])) AND (quantity > 0)))),
    CONSTRAINT material_inventory_transactions_reference_type_check CHECK (((reference_type)::text = ANY ((ARRAY['shop_order_item'::character varying, 'quote'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT material_inventory_transactions_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying, 'reserved'::character varying, 'released'::character varying])::text[])))
);


--
-- Name: TABLE material_inventory_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.material_inventory_transactions IS 'Soft inventory tracking for materials using transaction log approach. Each row represents a movement (in/out/reserved/released). Phase 1: bevételezés only.';


--
-- Name: COLUMN material_inventory_transactions.sku; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_inventory_transactions.sku IS 'Denormalized machine_code from machine_material_map for fast queries without joins';


--
-- Name: COLUMN material_inventory_transactions.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_inventory_transactions.quantity IS 'Number of boards: positive for IN, negative for OUT, positive absolute value for RESERVED/RELEASED';


--
-- Name: COLUMN material_inventory_transactions.unit_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_inventory_transactions.unit_price IS 'Price per board at transaction time. Required for IN/OUT, NULL for RESERVED/RELEASED. Used for average cost calculation.';


--
-- Name: COLUMN material_inventory_transactions.reference_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_inventory_transactions.reference_type IS 'Type of source document: shop_order_item (bevételezés), quote (foglalás/kivételezés), manual (corrections)';


--
-- Name: material_inventory_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.material_inventory_summary AS
 SELECT m.id AS material_id,
    m.name AS material_name,
    mmm.machine_code AS sku,
    b.name AS brand_name,
    m.length_mm,
    m.width_mm,
    m.thickness_mm,
    COALESCE(sum(
        CASE
            WHEN ((mit.transaction_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying])::text[])) THEN mit.quantity
            ELSE 0
        END), (0)::bigint) AS quantity_on_hand,
    COALESCE(sum(
        CASE
            WHEN ((mit.transaction_type)::text = 'reserved'::text) THEN mit.quantity
            WHEN ((mit.transaction_type)::text = 'released'::text) THEN (- mit.quantity)
            ELSE 0
        END), (0)::bigint) AS quantity_reserved,
    (COALESCE(sum(
        CASE
            WHEN ((mit.transaction_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying])::text[])) THEN mit.quantity
            ELSE 0
        END), (0)::bigint) - COALESCE(sum(
        CASE
            WHEN ((mit.transaction_type)::text = 'reserved'::text) THEN mit.quantity
            WHEN ((mit.transaction_type)::text = 'released'::text) THEN (- mit.quantity)
            ELSE 0
        END), (0)::bigint)) AS quantity_available,
    COALESCE(((sum(
        CASE
            WHEN ((mit.transaction_type)::text = 'in'::text) THEN (mit.quantity * mit.unit_price)
            ELSE 0
        END))::numeric / (NULLIF(sum(
        CASE
            WHEN ((mit.transaction_type)::text = 'in'::text) THEN mit.quantity
            ELSE 0
        END), 0))::numeric), (0)::numeric) AS average_cost_per_board,
    COALESCE(((sum(
        CASE
            WHEN ((mit.transaction_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying])::text[])) THEN mit.quantity
            ELSE 0
        END))::numeric * ((sum(
        CASE
            WHEN ((mit.transaction_type)::text = 'in'::text) THEN (mit.quantity * mit.unit_price)
            ELSE 0
        END))::numeric / (NULLIF(sum(
        CASE
            WHEN ((mit.transaction_type)::text = 'in'::text) THEN mit.quantity
            ELSE 0
        END), 0))::numeric)), (0)::numeric) AS total_inventory_value,
    max(mit.created_at) AS last_movement_at
   FROM (((public.materials m
     JOIN public.machine_material_map mmm ON (((mmm.material_id = m.id) AND (mmm.machine_type = 'Korpus'::public.machine_type_enum))))
     LEFT JOIN public.brands b ON ((b.id = m.brand_id)))
     LEFT JOIN public.material_inventory_transactions mit ON ((mit.material_id = m.id)))
  WHERE (m.deleted_at IS NULL)
  GROUP BY m.id, m.name, mmm.machine_code, b.name, m.length_mm, m.width_mm, m.thickness_mm;


--
-- Name: VIEW material_inventory_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.material_inventory_summary IS 'Real-time inventory summary per material. Aggregates transactions to show current stock levels with average cost valuation.';


--
-- Name: material_price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    old_price_per_sqm numeric(10,2) NOT NULL,
    new_price_per_sqm numeric(10,2) NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE material_price_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.material_price_history IS 'Tracks all price changes for materials over time';


--
-- Name: COLUMN material_price_history.material_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_price_history.material_id IS 'Reference to the material whose price changed';


--
-- Name: COLUMN material_price_history.old_price_per_sqm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_price_history.old_price_per_sqm IS 'Price before the change';


--
-- Name: COLUMN material_price_history.new_price_per_sqm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_price_history.new_price_per_sqm IS 'Price after the change';


--
-- Name: COLUMN material_price_history.changed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_price_history.changed_by IS 'User who made the price change';


--
-- Name: COLUMN material_price_history.changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_price_history.changed_at IS 'Timestamp when the price was changed';


--
-- Name: materials_with_settings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.materials_with_settings AS
 SELECT m.id,
    b.name AS brand_name,
    m.name AS material_name,
    m.length_mm,
    m.width_mm,
    m.thickness_mm,
    m.grain_direction,
    m.on_stock,
    m.image_url,
    mes.kerf_mm,
    mes.trim_top_mm,
    mes.trim_right_mm,
    mes.trim_bottom_mm,
    mes.trim_left_mm,
    mes.rotatable,
    mes.waste_multi,
    mes.usage_limit,
    m.created_at,
    m.updated_at
   FROM ((public.materials m
     JOIN public.brands b ON ((m.brand_id = b.id)))
     JOIN public.material_effective_settings mes ON ((m.id = mes.material_id)))
  WHERE (m.deleted_at IS NULL);


--
-- Name: media_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_filename text NOT NULL,
    stored_filename text NOT NULL,
    storage_path text NOT NULL,
    full_url text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    mimetype text DEFAULT 'image/webp'::text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE media_files; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.media_files IS 'Tracks all uploaded media files with original and stored filenames for better management';


--
-- Name: COLUMN media_files.original_filename; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_files.original_filename IS 'Original filename when uploaded (e.g., H1379_ST36_Orleans.webp)';


--
-- Name: COLUMN media_files.stored_filename; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_files.stored_filename IS 'Filename as stored in Supabase (e.g., material-id-timestamp.webp)';


--
-- Name: COLUMN media_files.storage_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_files.storage_path IS 'Full path in storage bucket (e.g., materials/stored_filename.webp)';


--
-- Name: COLUMN media_files.full_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_files.full_url IS 'Full public URL to access the image';


--
-- Name: COLUMN media_files.size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_files.size IS 'File size in bytes';


--
-- Name: pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    path character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    country character varying,
    postal_code character varying,
    city character varying,
    address character varying,
    mobile character varying,
    email character varying,
    tax_number character varying,
    company_registration_number character varying,
    bank_account character varying,
    notes text,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    contact_person character varying,
    vat_id uuid,
    currency_id uuid,
    payment_terms integer DEFAULT 30 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT partners_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text])))
);


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    comment text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: TABLE payment_methods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_methods IS 'Available payment methods for quotes and orders';


--
-- Name: COLUMN payment_methods.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_methods.name IS 'Payment method name (e.g., Készpénz, Bankkártya) - max 50 characters';


--
-- Name: COLUMN payment_methods.comment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_methods.comment IS 'Optional description or notes about the payment method';


--
-- Name: COLUMN payment_methods.active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_methods.active IS 'Whether this payment method is currently active/available';


--
-- Name: COLUMN payment_methods.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_methods.deleted_at IS 'Soft delete timestamp - NULL means not deleted';


--
-- Name: pos_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pos_order_id uuid NOT NULL,
    item_type character varying(20) NOT NULL,
    accessory_id uuid,
    feetype_id uuid,
    product_name character varying(255) NOT NULL,
    sku character varying(100),
    quantity numeric(10,2) NOT NULL,
    unit_price_net numeric(12,2) NOT NULL,
    unit_price_gross numeric(12,2) NOT NULL,
    vat_id uuid NOT NULL,
    currency_id uuid NOT NULL,
    total_net numeric(12,2) NOT NULL,
    total_vat numeric(12,2) NOT NULL,
    total_gross numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    product_type character varying(30),
    material_id uuid,
    linear_material_id uuid,
    CONSTRAINT chk_pos_order_items_product_accessory CHECK (((((item_type)::text = 'product'::text) AND (((accessory_id IS NOT NULL) AND (material_id IS NULL) AND (linear_material_id IS NULL)) OR ((material_id IS NOT NULL) AND (accessory_id IS NULL) AND (linear_material_id IS NULL)) OR ((linear_material_id IS NOT NULL) AND (accessory_id IS NULL) AND (material_id IS NULL)))) OR (((item_type)::text = 'fee'::text) AND (accessory_id IS NULL) AND (material_id IS NULL) AND (linear_material_id IS NULL)))),
    CONSTRAINT pos_order_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['product'::character varying, 'fee'::character varying])::text[])))
);


--
-- Name: pos_order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pos_order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pos_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pos_order_number character varying(50) DEFAULT public.generate_pos_order_number() NOT NULL,
    worker_id uuid NOT NULL,
    customer_name character varying(255),
    customer_email character varying(255),
    customer_mobile character varying(50),
    billing_name character varying(255),
    billing_country character varying(100) DEFAULT 'Magyarország'::character varying,
    billing_city character varying(100),
    billing_postal_code character varying(20),
    billing_street character varying(255),
    billing_house_number character varying(20),
    billing_tax_number character varying(50),
    billing_company_reg_number character varying(50),
    discount_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    subtotal_net numeric(12,2) DEFAULT 0 NOT NULL,
    total_vat numeric(12,2) DEFAULT 0 NOT NULL,
    total_gross numeric(12,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT pos_orders_status_check CHECK (((status)::text = ANY ((ARRAY['completed'::character varying, 'cancelled'::character varying, 'refunded'::character varying])::text[])))
);


--
-- Name: pos_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pos_order_id uuid NOT NULL,
    payment_type character varying(20) NOT NULL,
    amount numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT pos_payments_payment_type_check CHECK (((payment_type)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying])::text[]))),
    CONSTRAINT pos_payments_status_check CHECK (((status)::text = ANY ((ARRAY['completed'::character varying, 'pending'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


--
-- Name: product_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type character varying(30) DEFAULT 'shop_order'::character varying NOT NULL,
    shop_order_item_id uuid,
    raw_product_name character varying(255) NOT NULL,
    raw_sku character varying(100),
    raw_base_price integer,
    raw_multiplier numeric(3,2),
    raw_quantity numeric(10,2),
    raw_units_id uuid,
    raw_partner_id uuid,
    raw_vat_id uuid,
    raw_currency_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    admin_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    accessory_id uuid,
    suggestion_hash text GENERATED ALWAYS AS (md5((((((((((((((((((COALESCE(raw_product_name, ''::character varying))::text || '|'::text) || (COALESCE(raw_sku, ''::character varying))::text) || '|'::text) || COALESCE((raw_base_price)::text, ''::text)) || '|'::text) || COALESCE((raw_multiplier)::text, ''::text)) || '|'::text) || COALESCE((raw_quantity)::text, ''::text)) || '|'::text) || COALESCE((raw_units_id)::text, ''::text)) || '|'::text) || COALESCE((raw_partner_id)::text, ''::text)) || '|'::text) || COALESCE((raw_vat_id)::text, ''::text)) || '|'::text) || COALESCE((raw_currency_id)::text, ''::text)))) STORED,
    quote_id uuid,
    CONSTRAINT product_suggestions_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['shop_order'::character varying, 'order'::character varying])::text[]))),
    CONSTRAINT product_suggestions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: production_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_name character varying(255) NOT NULL,
    comment text,
    usage_limit_per_day integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: purchase_order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number character varying(50) DEFAULT public.generate_purchase_order_number() NOT NULL,
    partner_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    source_type character varying(30) DEFAULT 'stock_replenishment'::character varying NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_date date,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    note text,
    CONSTRAINT purchase_orders_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['stock_replenishment'::character varying, 'customer_order'::character varying])::text[]))),
    CONSTRAINT purchase_orders_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'confirmed'::character varying, 'partial'::character varying, 'received'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: quote_accessories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_accessories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    accessory_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    accessory_name character varying(255) NOT NULL,
    sku character varying(255) NOT NULL,
    unit_price_net numeric(12,2) NOT NULL,
    vat_rate numeric(5,4) NOT NULL,
    unit_id uuid NOT NULL,
    unit_name character varying(100) NOT NULL,
    currency_id uuid NOT NULL,
    total_net numeric(12,2) NOT NULL,
    total_vat numeric(12,2) NOT NULL,
    total_gross numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    base_price integer NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.38 NOT NULL,
    product_suggestion_id uuid,
    CONSTRAINT chk_quote_accessories_base_price_positive CHECK ((base_price >= 0)),
    CONSTRAINT chk_quote_accessories_multiplier_range CHECK (((multiplier >= 1.00) AND (multiplier <= 5.00))),
    CONSTRAINT chk_quote_accessories_real_or_snapshot CHECK (((accessory_id IS NOT NULL) OR ((accessory_name IS NOT NULL) AND (sku IS NOT NULL) AND (base_price IS NOT NULL) AND (multiplier IS NOT NULL) AND (unit_id IS NOT NULL) AND (unit_name IS NOT NULL) AND (currency_id IS NOT NULL) AND (vat_rate IS NOT NULL) AND (unit_price_net IS NOT NULL) AND (total_net IS NOT NULL) AND (total_vat IS NOT NULL) AND (total_gross IS NOT NULL)))),
    CONSTRAINT quote_accessories_quantity_check CHECK ((quantity > 0))
);


--
-- Name: TABLE quote_accessories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.quote_accessories IS 'Junction table linking quotes to accessories with quantity and snapshot pricing';


--
-- Name: COLUMN quote_accessories.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_accessories.quantity IS 'Number of units of this accessory';


--
-- Name: COLUMN quote_accessories.unit_price_net; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_accessories.unit_price_net IS 'Snapshot of net price per unit at time of adding';


--
-- Name: COLUMN quote_accessories.total_net; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_accessories.total_net IS 'Calculated: unit_price_net × quantity';


--
-- Name: COLUMN quote_accessories.base_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_accessories.base_price IS 'Base price component for calculating net price (base_price × multiplier)';


--
-- Name: COLUMN quote_accessories.multiplier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_accessories.multiplier IS 'Multiplier component for calculating net price (base_price × multiplier)';


--
-- Name: quote_edge_materials_breakdown; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_edge_materials_breakdown (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_materials_pricing_id uuid NOT NULL,
    edge_material_id uuid NOT NULL,
    edge_material_name character varying(255) NOT NULL,
    total_length_m numeric(10,2) NOT NULL,
    price_per_m numeric(10,2) NOT NULL,
    net_price numeric(12,2) NOT NULL,
    vat_amount numeric(12,2) NOT NULL,
    gross_price numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_fees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    feetype_id uuid NOT NULL,
    fee_name character varying(255) NOT NULL,
    unit_price_net numeric(12,2) NOT NULL,
    vat_rate numeric(5,4) NOT NULL,
    vat_amount numeric(12,2) NOT NULL,
    gross_price numeric(12,2) NOT NULL,
    currency_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    quantity integer DEFAULT 1 NOT NULL,
    comment text,
    CONSTRAINT quote_fees_quantity_check CHECK ((quantity > 0))
);


--
-- Name: TABLE quote_fees; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.quote_fees IS 'Junction table linking quotes to fees with snapshot pricing';


--
-- Name: COLUMN quote_fees.unit_price_net; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_fees.unit_price_net IS 'Net price per unit (can be negative for discounts/adjustments)';


--
-- Name: COLUMN quote_fees.vat_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_fees.vat_rate IS 'Snapshot of VAT rate at time of adding';


--
-- Name: COLUMN quote_fees.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_fees.quantity IS 'Quantity of this fee (multiplies unit price)';


--
-- Name: COLUMN quote_fees.comment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_fees.comment IS 'Optional per-quote comment for this fee';


--
-- Name: quote_materials_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_materials_pricing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    material_id uuid NOT NULL,
    material_name character varying(255) NOT NULL,
    board_width_mm integer NOT NULL,
    board_length_mm integer NOT NULL,
    thickness_mm integer NOT NULL,
    grain_direction boolean NOT NULL,
    on_stock boolean NOT NULL,
    boards_used integer NOT NULL,
    usage_percentage numeric(5,2) NOT NULL,
    pricing_method character varying(20) NOT NULL,
    charged_sqm numeric(10,4),
    price_per_sqm numeric(10,2) NOT NULL,
    vat_rate numeric(5,4) NOT NULL,
    currency character varying(10) NOT NULL,
    usage_limit numeric(5,4) NOT NULL,
    waste_multi numeric(5,2) NOT NULL,
    material_net numeric(12,2) NOT NULL,
    material_vat numeric(12,2) NOT NULL,
    material_gross numeric(12,2) NOT NULL,
    edge_materials_net numeric(12,2) DEFAULT 0 NOT NULL,
    edge_materials_vat numeric(12,2) DEFAULT 0 NOT NULL,
    edge_materials_gross numeric(12,2) DEFAULT 0 NOT NULL,
    cutting_length_m numeric(10,2) NOT NULL,
    cutting_net numeric(12,2) DEFAULT 0 NOT NULL,
    cutting_vat numeric(12,2) DEFAULT 0 NOT NULL,
    cutting_gross numeric(12,2) DEFAULT 0 NOT NULL,
    services_net numeric(12,2) DEFAULT 0 NOT NULL,
    services_vat numeric(12,2) DEFAULT 0 NOT NULL,
    services_gross numeric(12,2) DEFAULT 0 NOT NULL,
    total_net numeric(12,2) NOT NULL,
    total_vat numeric(12,2) NOT NULL,
    total_gross numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_panels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_panels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    material_id uuid NOT NULL,
    width_mm integer NOT NULL,
    height_mm integer NOT NULL,
    quantity integer NOT NULL,
    label character varying(255),
    edge_material_a_id uuid,
    edge_material_b_id uuid,
    edge_material_c_id uuid,
    edge_material_d_id uuid,
    panthelyfuras_quantity integer DEFAULT 0 NOT NULL,
    panthelyfuras_oldal character varying(50),
    duplungolas boolean DEFAULT false NOT NULL,
    szogvagas boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method text NOT NULL,
    comment text,
    payment_date timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid,
    deleted_at timestamp without time zone
);


--
-- Name: TABLE quote_payments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.quote_payments IS 'Payment transactions for orders - supports multiple payments and refunds';


--
-- Name: COLUMN quote_payments.amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_payments.amount IS 'Payment amount - positive for payments, negative for refunds';


--
-- Name: COLUMN quote_payments.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_payments.payment_method IS 'Payment method: cash, transfer, card';


--
-- Name: quote_services_breakdown; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_services_breakdown (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_materials_pricing_id uuid NOT NULL,
    service_type character varying(50) NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    net_price numeric(12,2) NOT NULL,
    vat_amount numeric(12,2) NOT NULL,
    gross_price numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    quote_number character varying(50) NOT NULL,
    status public.quote_status DEFAULT 'draft'::public.quote_status NOT NULL,
    total_net numeric(12,2) NOT NULL,
    total_vat numeric(12,2) NOT NULL,
    total_gross numeric(12,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    final_total_after_discount numeric(12,2) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    fees_total_net numeric(12,2) DEFAULT 0,
    fees_total_vat numeric(12,2) DEFAULT 0,
    fees_total_gross numeric(12,2) DEFAULT 0,
    accessories_total_net numeric(12,2) DEFAULT 0,
    accessories_total_vat numeric(12,2) DEFAULT 0,
    accessories_total_gross numeric(12,2) DEFAULT 0,
    order_number text,
    barcode text,
    production_machine_id uuid,
    production_date date,
    payment_status text DEFAULT 'not_paid'::text,
    source character varying(20) DEFAULT 'internal'::character varying,
    comment text,
    payment_method_id uuid,
    ordered_at timestamp with time zone,
    in_production_at timestamp with time zone,
    ready_at timestamp with time zone,
    finished_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    ready_notification_sent_at timestamp with time zone,
    last_storage_reminder_sent_at timestamp with time zone
);


--
-- Name: COLUMN quotes.fees_total_net; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.fees_total_net IS 'Sum of all fees net prices';


--
-- Name: COLUMN quotes.fees_total_vat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.fees_total_vat IS 'Sum of all fees VAT amounts';


--
-- Name: COLUMN quotes.fees_total_gross; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.fees_total_gross IS 'Sum of all fees gross prices';


--
-- Name: COLUMN quotes.accessories_total_net; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.accessories_total_net IS 'Sum of all accessories total net prices';


--
-- Name: COLUMN quotes.accessories_total_vat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.accessories_total_vat IS 'Sum of all accessories total VAT amounts';


--
-- Name: COLUMN quotes.accessories_total_gross; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.accessories_total_gross IS 'Sum of all accessories total gross prices';


--
-- Name: COLUMN quotes.order_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.order_number IS 'Generated when quote becomes an order: ORD-YYYY-MM-DD-NNN';


--
-- Name: COLUMN quotes.barcode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.barcode IS 'Production tracking barcode';


--
-- Name: COLUMN quotes.production_machine_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.production_machine_id IS 'Machine assigned for production';


--
-- Name: COLUMN quotes.production_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.production_date IS 'Scheduled production date';


--
-- Name: COLUMN quotes.payment_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.payment_status IS 'Auto-calculated: not_paid, partial, paid';


--
-- Name: COLUMN quotes.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.source IS 'Source of quote: internal (created by company) or customer_portal (submitted by customer)';


--
-- Name: COLUMN quotes.comment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.comment IS 'Internal comment/note for the quote or order (max 250 characters enforced in app)';


--
-- Name: COLUMN quotes.payment_method_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.payment_method_id IS 'Selected payment method (NULL for admin quotes, populated for customer portal quotes)';


--
-- Name: COLUMN quotes.ordered_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.ordered_at IS 'Timestamp when quote status changed to ordered. Used for analytics and lead time calculations.';


--
-- Name: COLUMN quotes.in_production_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.in_production_at IS 'Timestamp when quote status changed to in_production. Used for production time tracking.';


--
-- Name: COLUMN quotes.ready_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.ready_at IS 'Timestamp when quote status changed to ready. Used for completion time analytics.';


--
-- Name: COLUMN quotes.finished_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.finished_at IS 'Timestamp when quote status changed to finished (handed over to customer). Used for delivery time tracking.';


--
-- Name: COLUMN quotes.cancelled_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.cancelled_at IS 'Timestamp when quote status changed to cancelled. Used for cancellation analytics.';


--
-- Name: COLUMN quotes.ready_notification_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.ready_notification_sent_at IS 'Timestamp when "Készre jelentés" SMS was sent to customer. NULL if SMS not sent or customer has SMS disabled. Set when order becomes ready and SMS is successfully sent.';


--
-- Name: COLUMN quotes.last_storage_reminder_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.last_storage_reminder_sent_at IS 'Timestamp when last "Tárolás figyelmeztetés" SMS was sent to customer. NULL if no reminder sent yet. Updated each time a storage reminder is sent (tracks only the most recent reminder).';


--
-- Name: shipment_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shipment_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shop_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_name character varying(255) NOT NULL,
    sku character varying(100),
    type character varying(100),
    base_price integer NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.38,
    quantity numeric(10,2) NOT NULL,
    units_id uuid,
    partner_id uuid,
    vat_id uuid,
    currency_id uuid,
    megjegyzes text,
    status character varying(20) DEFAULT 'open'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    product_type character varying(30),
    accessory_id uuid,
    material_id uuid,
    linear_material_id uuid,
    CONSTRAINT shop_order_items_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('ordered'::character varying)::text, ('arrived'::character varying)::text, ('handed_over'::character varying)::text, ('deleted'::character varying)::text])))
);


--
-- Name: COLUMN shop_order_items.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shop_order_items.quantity IS 'Quantity with support for 2 decimal places (e.g., 2.50, 1.75)';


--
-- Name: shop_order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shop_order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shop_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number character varying(50) NOT NULL,
    worker_id uuid NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255),
    customer_mobile character varying(50),
    customer_discount numeric(5,2) DEFAULT 0,
    billing_name character varying(255),
    billing_country character varying(100),
    billing_city character varying(100),
    billing_postal_code character varying(20),
    billing_street character varying(255),
    billing_house_number character varying(20),
    billing_tax_number character varying(50),
    billing_company_reg_number character varying(50),
    status character varying(20) DEFAULT 'open'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    sms_sent_at timestamp with time zone,
    CONSTRAINT shop_orders_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('ordered'::character varying)::text, ('arrived'::character varying)::text, ('finished'::character varying)::text, ('handed_over'::character varying)::text, ('deleted'::character varying)::text])))
);


--
-- Name: COLUMN shop_orders.sms_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shop_orders.sms_sent_at IS 'Timestamp when Beszerzés SMS notification was sent to customer. NULL if SMS not sent yet or customer has SMS disabled.';


--
-- Name: CONSTRAINT shop_orders_status_check ON shop_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT shop_orders_status_check ON public.shop_orders IS 'Valid statuses: open, ordered, arrived (partial delivery), finished (all arrived), handed_over (delivered to customer), deleted';


--
-- Name: sms_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_template text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    template_name character varying(100) NOT NULL
);


--
-- Name: TABLE sms_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sms_settings IS 'Stores customizable SMS notification message templates. Templates: "Készre jelentés" (order ready), "Tárolás figyelmeztetés" (storage warning), "Beszerzés" (procurement complete)';


--
-- Name: COLUMN sms_settings.message_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_settings.message_template IS 'SMS message template with placeholders: {customer_name}, {order_number}, {company_name}, {material_name}';


--
-- Name: COLUMN sms_settings.template_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_settings.template_name IS 'Name of the SMS template (e.g., "Készre jelentés", "Tárolás figyelmeztetés")';


--
-- Name: stock_movement_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_movement_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_company; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_company (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    country character varying,
    postal_code character varying,
    city character varying,
    address character varying,
    phone_number character varying,
    email character varying,
    website character varying,
    tax_number character varying,
    company_registration_number character varying,
    vat_id character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    shortform character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    page_id uuid NOT NULL,
    can_access boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_pins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_pins (
    user_id uuid NOT NULL,
    pin character varying(6) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone,
    is_active boolean DEFAULT true,
    failed_attempts integer DEFAULT 0,
    locked_until timestamp with time zone,
    worker_id uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_sign_in_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: vat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vat (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    kulcs numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    mobile character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    nickname character varying(100),
    color character varying(7) DEFAULT '#1976d2'::character varying
);


--
-- Name: accessories accessories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_pkey PRIMARY KEY (id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: cutting_fees cutting_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cutting_fees
    ADD CONSTRAINT cutting_fees_pkey PRIMARY KEY (id);


--
-- Name: edge_materials edge_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edge_materials
    ADD CONSTRAINT edge_materials_pkey PRIMARY KEY (id);


--
-- Name: feetypes feetypes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feetypes
    ADD CONSTRAINT feetypes_pkey PRIMARY KEY (id);


--
-- Name: linear_material_price_history linear_material_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_pkey PRIMARY KEY (id);


--
-- Name: linear_materials linear_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_pkey PRIMARY KEY (id);


--
-- Name: machine_edge_material_map machine_edge_material_map_edge_material_id_machine_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_edge_material_map
    ADD CONSTRAINT machine_edge_material_map_edge_material_id_machine_type_key UNIQUE (edge_material_id, machine_type);


--
-- Name: machine_edge_material_map machine_edge_material_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_edge_material_map
    ADD CONSTRAINT machine_edge_material_map_pkey PRIMARY KEY (id);


--
-- Name: machine_linear_material_map machine_linear_material_map_linear_material_id_machine_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_linear_material_map
    ADD CONSTRAINT machine_linear_material_map_linear_material_id_machine_type_key UNIQUE (linear_material_id, machine_type);


--
-- Name: machine_linear_material_map machine_linear_material_map_machine_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_linear_material_map
    ADD CONSTRAINT machine_linear_material_map_machine_code_key UNIQUE (machine_code);


--
-- Name: machine_linear_material_map machine_linear_material_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_linear_material_map
    ADD CONSTRAINT machine_linear_material_map_pkey PRIMARY KEY (id);


--
-- Name: machine_material_map machine_material_map_material_id_machine_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_material_map
    ADD CONSTRAINT machine_material_map_material_id_machine_type_key UNIQUE (material_id, machine_type);


--
-- Name: machine_material_map machine_material_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_material_map
    ADD CONSTRAINT machine_material_map_pkey PRIMARY KEY (id);


--
-- Name: material_audit material_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_audit
    ADD CONSTRAINT material_audit_pkey PRIMARY KEY (id);


--
-- Name: material_group_settings material_group_settings_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_group_settings
    ADD CONSTRAINT material_group_settings_group_id_key UNIQUE (group_id);


--
-- Name: material_group_settings material_group_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_group_settings
    ADD CONSTRAINT material_group_settings_pkey PRIMARY KEY (id);


--
-- Name: material_groups material_groups_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_groups
    ADD CONSTRAINT material_groups_name_key UNIQUE (name);


--
-- Name: material_groups material_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_groups
    ADD CONSTRAINT material_groups_pkey PRIMARY KEY (id);


--
-- Name: material_inventory_transactions material_inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_inventory_transactions
    ADD CONSTRAINT material_inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: material_price_history material_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_price_history
    ADD CONSTRAINT material_price_history_pkey PRIMARY KEY (id);


--
-- Name: material_settings material_settings_material_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_settings
    ADD CONSTRAINT material_settings_material_id_key UNIQUE (material_id);


--
-- Name: material_settings material_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_settings
    ADD CONSTRAINT material_settings_pkey PRIMARY KEY (id);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: media_files media_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_pkey PRIMARY KEY (id);


--
-- Name: media_files media_files_stored_filename_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_stored_filename_key UNIQUE (stored_filename);


--
-- Name: quote_payments order_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_payments
    ADD CONSTRAINT order_payments_pkey PRIMARY KEY (id);


--
-- Name: pages pages_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_path_key UNIQUE (path);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: partners partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_name_key UNIQUE (name);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: pos_order_items pos_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_pkey PRIMARY KEY (id);


--
-- Name: pos_orders pos_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_orders
    ADD CONSTRAINT pos_orders_pkey PRIMARY KEY (id);


--
-- Name: pos_orders pos_orders_pos_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_orders
    ADD CONSTRAINT pos_orders_pos_order_number_key UNIQUE (pos_order_number);


--
-- Name: pos_payments pos_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_payments
    ADD CONSTRAINT pos_payments_pkey PRIMARY KEY (id);


--
-- Name: product_suggestions product_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_pkey PRIMARY KEY (id);


--
-- Name: production_machines production_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_machines
    ADD CONSTRAINT production_machines_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: quote_accessories quote_accessories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_accessories
    ADD CONSTRAINT quote_accessories_pkey PRIMARY KEY (id);


--
-- Name: quote_edge_materials_breakdown quote_edge_materials_breakdown_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_edge_materials_breakdown
    ADD CONSTRAINT quote_edge_materials_breakdown_pkey PRIMARY KEY (id);


--
-- Name: quote_fees quote_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_fees
    ADD CONSTRAINT quote_fees_pkey PRIMARY KEY (id);


--
-- Name: quote_materials_pricing quote_materials_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_materials_pricing
    ADD CONSTRAINT quote_materials_pricing_pkey PRIMARY KEY (id);


--
-- Name: quote_panels quote_panels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_pkey PRIMARY KEY (id);


--
-- Name: quote_services_breakdown quote_services_breakdown_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_services_breakdown
    ADD CONSTRAINT quote_services_breakdown_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_barcode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_barcode_key UNIQUE (barcode);


--
-- Name: quotes quotes_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_order_number_key UNIQUE (order_number);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_quote_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_quote_number_key UNIQUE (quote_number);


--
-- Name: shipment_items shipment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_shipment_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_shipment_number_unique UNIQUE (shipment_number);


--
-- Name: shop_order_items shop_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_pkey PRIMARY KEY (id);


--
-- Name: shop_orders shop_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_order_number_key UNIQUE (order_number);


--
-- Name: shop_orders shop_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_pkey PRIMARY KEY (id);


--
-- Name: sms_settings sms_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_settings
    ADD CONSTRAINT sms_settings_pkey PRIMARY KEY (id);


--
-- Name: sms_settings sms_settings_template_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_settings
    ADD CONSTRAINT sms_settings_template_name_unique UNIQUE (template_name);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: tenant_company tenant_company_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_company
    ADD CONSTRAINT tenant_company_pkey PRIMARY KEY (id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_user_page_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_page_unique UNIQUE (user_id, page_id);


--
-- Name: user_pins user_pins_pin_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pins
    ADD CONSTRAINT user_pins_pin_key UNIQUE (pin);


--
-- Name: user_pins user_pins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pins
    ADD CONSTRAINT user_pins_pkey PRIMARY KEY (user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vat vat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vat
    ADD CONSTRAINT vat_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: workers workers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT workers_pkey PRIMARY KEY (id);


--
-- Name: accessories_sku_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX accessories_sku_unique_active ON public.accessories USING btree (sku) WHERE (deleted_at IS NULL);


--
-- Name: brands_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX brands_name_unique_active ON public.brands USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: currencies_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX currencies_name_unique_active ON public.currencies USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: customers_email_unique_not_null; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_email_unique_not_null ON public.customers USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: customers_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_name_unique_active ON public.customers USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: feetypes_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX feetypes_name_unique_active ON public.feetypes USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_accessories_barcode_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_barcode_active ON public.accessories USING btree (barcode) WHERE (deleted_at IS NULL);


--
-- Name: idx_accessories_base_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_base_price ON public.accessories USING btree (base_price);


--
-- Name: idx_accessories_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_currency_id ON public.accessories USING btree (currency_id);


--
-- Name: idx_accessories_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_deleted_at ON public.accessories USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_accessories_multiplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_multiplier ON public.accessories USING btree (multiplier);


--
-- Name: idx_accessories_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_name_active ON public.accessories USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_accessories_partners_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_partners_id ON public.accessories USING btree (partners_id);


--
-- Name: idx_accessories_sku_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_sku_active ON public.accessories USING btree (sku) WHERE (deleted_at IS NULL);


--
-- Name: idx_accessories_units_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_units_id ON public.accessories USING btree (units_id);


--
-- Name: idx_accessories_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_vat_id ON public.accessories USING btree (vat_id);


--
-- Name: idx_brands_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brands_active_ordered ON public.brands USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_brands_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brands_name_active ON public.brands USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_currencies_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_currencies_active_ordered ON public.currencies USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_currencies_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_currencies_name_active ON public.currencies USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_customers_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_active_ordered ON public.customers USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_customers_email_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_email_active ON public.customers USING btree (email) WHERE (deleted_at IS NULL);


--
-- Name: idx_customers_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_name_active ON public.customers USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_customers_sms_notification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_sms_notification ON public.customers USING btree (sms_notification) WHERE (deleted_at IS NULL);


--
-- Name: idx_cutting_fees_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cutting_fees_currency_id ON public.cutting_fees USING btree (currency_id);


--
-- Name: idx_cutting_fees_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cutting_fees_vat_id ON public.cutting_fees USING btree (vat_id);


--
-- Name: idx_edge_materials_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_active ON public.edge_materials USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_active_only; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_active_only ON public.edge_materials USING btree (active) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_active_ordered ON public.edge_materials USING btree (deleted_at, type) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_active_type_decor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_active_type_decor ON public.edge_materials USING btree (deleted_at, type, decor) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_brand_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_brand_active ON public.edge_materials USING btree (brand_id, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_brand_id ON public.edge_materials USING btree (brand_id);


--
-- Name: idx_edge_materials_decor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_decor ON public.edge_materials USING btree (decor);


--
-- Name: idx_edge_materials_dimensions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_dimensions_active ON public.edge_materials USING btree (thickness, width, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_favourite_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_favourite_priority ON public.edge_materials USING btree (favourite_priority) WHERE ((deleted_at IS NULL) AND (favourite_priority IS NOT NULL));


--
-- Name: idx_edge_materials_price_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_price_active ON public.edge_materials USING btree (price, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_type ON public.edge_materials USING btree (type);


--
-- Name: idx_edge_materials_unique_fields; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_unique_fields ON public.edge_materials USING btree (brand_id, type, thickness, width, decor, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_vat_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_vat_active ON public.edge_materials USING btree (vat_id, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_vat_id ON public.edge_materials USING btree (vat_id);


--
-- Name: idx_feetypes_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feetypes_currency_id ON public.feetypes USING btree (currency_id);


--
-- Name: idx_feetypes_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feetypes_deleted_at ON public.feetypes USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_feetypes_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feetypes_name_active ON public.feetypes USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_feetypes_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feetypes_vat_id ON public.feetypes USING btree (vat_id);


--
-- Name: idx_linear_materials_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_active ON public.linear_materials USING btree (active) WHERE (deleted_at IS NULL);


--
-- Name: idx_linear_materials_base_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_base_price ON public.linear_materials USING btree (base_price);


--
-- Name: idx_linear_materials_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_brand_id ON public.linear_materials USING btree (brand_id);


--
-- Name: idx_linear_materials_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_currency_id ON public.linear_materials USING btree (currency_id);


--
-- Name: idx_linear_materials_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_deleted_at ON public.linear_materials USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_linear_materials_multiplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_multiplier ON public.linear_materials USING btree (multiplier);


--
-- Name: idx_linear_materials_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_name ON public.linear_materials USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_linear_materials_on_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_on_stock ON public.linear_materials USING btree (on_stock) WHERE (deleted_at IS NULL);


--
-- Name: idx_linear_materials_partners_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_partners_id ON public.linear_materials USING btree (partners_id);


--
-- Name: idx_linear_materials_units_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_units_id ON public.linear_materials USING btree (units_id);


--
-- Name: idx_linear_materials_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_vat_id ON public.linear_materials USING btree (vat_id);


--
-- Name: idx_linear_price_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_price_history_changed_at ON public.linear_material_price_history USING btree (changed_at DESC);


--
-- Name: idx_linear_price_history_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_price_history_material_id ON public.linear_material_price_history USING btree (linear_material_id);


--
-- Name: idx_machine_edge_material_map_edge_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_edge_material_map_edge_material_id ON public.machine_edge_material_map USING btree (edge_material_id);


--
-- Name: idx_machine_edge_material_map_machine_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_edge_material_map_machine_code ON public.machine_edge_material_map USING btree (machine_code);


--
-- Name: idx_machine_edge_material_map_machine_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_edge_material_map_machine_type ON public.machine_edge_material_map USING btree (machine_type);


--
-- Name: idx_machine_linear_material_map_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_linear_material_map_code ON public.machine_linear_material_map USING btree (machine_code);


--
-- Name: idx_machine_linear_material_map_linear_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_linear_material_map_linear_id ON public.machine_linear_material_map USING btree (linear_material_id);


--
-- Name: idx_material_price_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_price_history_changed_at ON public.material_price_history USING btree (changed_at DESC);


--
-- Name: idx_material_price_history_changed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_price_history_changed_by ON public.material_price_history USING btree (changed_by);


--
-- Name: idx_material_price_history_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_price_history_material_id ON public.material_price_history USING btree (material_id);


--
-- Name: idx_materials_base_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_base_price ON public.materials USING btree (base_price);


--
-- Name: idx_materials_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_brand_id ON public.materials USING btree (brand_id);


--
-- Name: idx_materials_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_currency_id ON public.materials USING btree (currency_id);


--
-- Name: idx_materials_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_group_id ON public.materials USING btree (group_id);


--
-- Name: idx_materials_multiplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_multiplier ON public.materials USING btree (multiplier);


--
-- Name: idx_materials_partners_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_partners_id ON public.materials USING btree (partners_id);


--
-- Name: idx_materials_units_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_units_id ON public.materials USING btree (units_id);


--
-- Name: idx_materials_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_vat_id ON public.materials USING btree (vat_id);


--
-- Name: idx_media_files_original_filename; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_original_filename ON public.media_files USING btree (original_filename);


--
-- Name: idx_media_files_stored_filename; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_stored_filename ON public.media_files USING btree (stored_filename);


--
-- Name: idx_media_files_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_uploaded_by ON public.media_files USING btree (uploaded_by);


--
-- Name: idx_mit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mit_created_at ON public.material_inventory_transactions USING btree (created_at DESC);


--
-- Name: idx_mit_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mit_material_id ON public.material_inventory_transactions USING btree (material_id);


--
-- Name: idx_mit_material_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mit_material_type ON public.material_inventory_transactions USING btree (material_id, transaction_type);


--
-- Name: idx_mit_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mit_reference ON public.material_inventory_transactions USING btree (reference_type, reference_id);


--
-- Name: idx_mit_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mit_sku ON public.material_inventory_transactions USING btree (sku);


--
-- Name: idx_mit_transaction_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mit_transaction_type ON public.material_inventory_transactions USING btree (transaction_type);


--
-- Name: idx_order_payments_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_payments_deleted_at ON public.quote_payments USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_order_payments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_payments_order_id ON public.quote_payments USING btree (quote_id);


--
-- Name: idx_order_payments_payment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_payments_payment_date ON public.quote_payments USING btree (payment_date DESC);


--
-- Name: idx_pages_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pages_active ON public.pages USING btree (is_active);


--
-- Name: idx_pages_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pages_path ON public.pages USING btree (path);


--
-- Name: idx_pages_path_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pages_path_active ON public.pages USING btree (path, is_active);


--
-- Name: idx_partners_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_active_ordered ON public.partners USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_partners_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_currency_id ON public.partners USING btree (currency_id);


--
-- Name: idx_partners_email_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_email_active ON public.partners USING btree (email) WHERE (deleted_at IS NULL);


--
-- Name: idx_partners_status_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_status_active ON public.partners USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_partners_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_vat_id ON public.partners USING btree (vat_id);


--
-- Name: idx_payment_methods_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_active ON public.payment_methods USING btree (active) WHERE (deleted_at IS NULL);


--
-- Name: idx_payment_methods_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_deleted_at ON public.payment_methods USING btree (deleted_at);


--
-- Name: idx_payment_methods_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_name ON public.payment_methods USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_pos_order_items_accessory_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_accessory_id ON public.pos_order_items USING btree (accessory_id);


--
-- Name: idx_pos_order_items_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_deleted_at ON public.pos_order_items USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_pos_order_items_item_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_item_type ON public.pos_order_items USING btree (item_type);


--
-- Name: idx_pos_order_items_linear_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_linear_material_id ON public.pos_order_items USING btree (linear_material_id);


--
-- Name: idx_pos_order_items_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_material_id ON public.pos_order_items USING btree (material_id);


--
-- Name: idx_pos_order_items_pos_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_pos_order_id ON public.pos_order_items USING btree (pos_order_id);


--
-- Name: idx_pos_order_items_product_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_product_type ON public.pos_order_items USING btree (product_type);


--
-- Name: idx_pos_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_orders_created_at ON public.pos_orders USING btree (created_at);


--
-- Name: idx_pos_orders_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_orders_deleted_at ON public.pos_orders USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_pos_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_orders_status ON public.pos_orders USING btree (status);


--
-- Name: idx_pos_orders_worker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_orders_worker_id ON public.pos_orders USING btree (worker_id);


--
-- Name: idx_pos_payments_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_payments_deleted_at ON public.pos_payments USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_pos_payments_payment_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_payments_payment_type ON public.pos_payments USING btree (payment_type);


--
-- Name: idx_pos_payments_pos_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_payments_pos_order_id ON public.pos_payments USING btree (pos_order_id);


--
-- Name: idx_pos_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_payments_status ON public.pos_payments USING btree (status);


--
-- Name: idx_product_suggestions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_suggestions_created_at ON public.product_suggestions USING btree (created_at);


--
-- Name: idx_product_suggestions_shop_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_suggestions_shop_item ON public.product_suggestions USING btree (shop_order_item_id);


--
-- Name: idx_product_suggestions_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_suggestions_status_created ON public.product_suggestions USING btree (status, created_at DESC);


--
-- Name: idx_production_machines_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_machines_deleted_at ON public.production_machines USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_production_machines_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_machines_name_active ON public.production_machines USING btree (machine_name) WHERE (deleted_at IS NULL);


--
-- Name: idx_purchase_order_items_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_items_deleted_at ON public.purchase_order_items USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_purchase_order_items_po_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_items_po_id ON public.purchase_order_items USING btree (purchase_order_id);


--
-- Name: idx_purchase_order_items_product_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_items_product_type ON public.purchase_order_items USING btree (product_type);


--
-- Name: idx_purchase_order_items_shop_order_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_items_shop_order_item_id ON public.purchase_order_items USING btree (shop_order_item_id);


--
-- Name: idx_purchase_orders_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_deleted_at ON public.purchase_orders USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_purchase_orders_order_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_order_date ON public.purchase_orders USING btree (order_date);


--
-- Name: idx_purchase_orders_partner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_partner_id ON public.purchase_orders USING btree (partner_id);


--
-- Name: idx_purchase_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_status ON public.purchase_orders USING btree (status);


--
-- Name: idx_purchase_orders_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_warehouse_id ON public.purchase_orders USING btree (warehouse_id);


--
-- Name: idx_qemb_edge_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qemb_edge_material_id ON public.quote_edge_materials_breakdown USING btree (edge_material_id);


--
-- Name: idx_qemb_pricing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qemb_pricing_id ON public.quote_edge_materials_breakdown USING btree (quote_materials_pricing_id);


--
-- Name: idx_qmp_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qmp_material_id ON public.quote_materials_pricing USING btree (material_id);


--
-- Name: idx_qmp_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qmp_quote_id ON public.quote_materials_pricing USING btree (quote_id);


--
-- Name: idx_qsb_pricing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qsb_pricing_id ON public.quote_services_breakdown USING btree (quote_materials_pricing_id);


--
-- Name: idx_qsb_service_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qsb_service_type ON public.quote_services_breakdown USING btree (service_type);


--
-- Name: idx_quote_accessories_accessory_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_accessories_accessory_id ON public.quote_accessories USING btree (accessory_id);


--
-- Name: idx_quote_accessories_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_accessories_currency_id ON public.quote_accessories USING btree (currency_id);


--
-- Name: idx_quote_accessories_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_accessories_deleted_at ON public.quote_accessories USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_quote_accessories_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_accessories_quote_id ON public.quote_accessories USING btree (quote_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_quote_accessories_unit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_accessories_unit_id ON public.quote_accessories USING btree (unit_id);


--
-- Name: idx_quote_edge_materials_breakdown_pricing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_edge_materials_breakdown_pricing_id ON public.quote_edge_materials_breakdown USING btree (quote_materials_pricing_id);


--
-- Name: idx_quote_fees_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_fees_currency_id ON public.quote_fees USING btree (currency_id);


--
-- Name: idx_quote_fees_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_fees_deleted_at ON public.quote_fees USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_quote_fees_feetype_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_fees_feetype_id ON public.quote_fees USING btree (feetype_id);


--
-- Name: idx_quote_fees_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_fees_quote_id ON public.quote_fees USING btree (quote_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_quote_materials_pricing_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_materials_pricing_quote_id ON public.quote_materials_pricing USING btree (quote_id);


--
-- Name: idx_quote_panels_edge_material_a_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_panels_edge_material_a_id ON public.quote_panels USING btree (edge_material_a_id);


--
-- Name: idx_quote_panels_edge_material_b_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_panels_edge_material_b_id ON public.quote_panels USING btree (edge_material_b_id);


--
-- Name: idx_quote_panels_edge_material_c_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_panels_edge_material_c_id ON public.quote_panels USING btree (edge_material_c_id);


--
-- Name: idx_quote_panels_edge_material_d_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_panels_edge_material_d_id ON public.quote_panels USING btree (edge_material_d_id);


--
-- Name: idx_quote_panels_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_panels_material_id ON public.quote_panels USING btree (material_id);


--
-- Name: idx_quote_panels_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_panels_quote_id ON public.quote_panels USING btree (quote_id);


--
-- Name: idx_quote_payments_payment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_payments_payment_date ON public.quote_payments USING btree (payment_date DESC);


--
-- Name: idx_quote_payments_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_payments_quote_id ON public.quote_payments USING btree (quote_id);


--
-- Name: idx_quote_services_breakdown_pricing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_services_breakdown_pricing_id ON public.quote_services_breakdown USING btree (quote_materials_pricing_id);


--
-- Name: idx_quotes_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_barcode ON public.quotes USING btree (barcode) WHERE (barcode IS NOT NULL);


--
-- Name: idx_quotes_cancelled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_cancelled_at ON public.quotes USING btree (cancelled_at) WHERE (cancelled_at IS NOT NULL);


--
-- Name: idx_quotes_comment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_comment ON public.quotes USING btree (comment) WHERE ((comment IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_quotes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_created_at ON public.quotes USING btree (created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotes_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_created_by ON public.quotes USING btree (created_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotes_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_customer_id ON public.quotes USING btree (customer_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotes_finished_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_finished_at ON public.quotes USING btree (finished_at) WHERE (finished_at IS NOT NULL);


--
-- Name: idx_quotes_in_production_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_in_production_at ON public.quotes USING btree (in_production_at) WHERE (in_production_at IS NOT NULL);


--
-- Name: idx_quotes_last_storage_reminder_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_last_storage_reminder_sent_at ON public.quotes USING btree (last_storage_reminder_sent_at) WHERE (last_storage_reminder_sent_at IS NOT NULL);


--
-- Name: idx_quotes_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_order_number ON public.quotes USING btree (order_number) WHERE (order_number IS NOT NULL);


--
-- Name: idx_quotes_ordered_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_ordered_at ON public.quotes USING btree (ordered_at) WHERE (ordered_at IS NOT NULL);


--
-- Name: idx_quotes_payment_method_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_payment_method_id ON public.quotes USING btree (payment_method_id) WHERE (payment_method_id IS NOT NULL);


--
-- Name: idx_quotes_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_payment_status ON public.quotes USING btree (payment_status);


--
-- Name: idx_quotes_production_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_production_date ON public.quotes USING btree (production_date) WHERE (production_date IS NOT NULL);


--
-- Name: idx_quotes_production_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_production_machine ON public.quotes USING btree (production_machine_id) WHERE (production_machine_id IS NOT NULL);


--
-- Name: idx_quotes_quote_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_quote_number ON public.quotes USING btree (quote_number) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotes_ready_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_ready_at ON public.quotes USING btree (ready_at) WHERE (ready_at IS NOT NULL);


--
-- Name: idx_quotes_ready_notification_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_ready_notification_sent_at ON public.quotes USING btree (ready_notification_sent_at) WHERE (ready_notification_sent_at IS NOT NULL);


--
-- Name: idx_quotes_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_source ON public.quotes USING btree (source) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_status ON public.quotes USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotes_status_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_status_ordered ON public.quotes USING btree (status) WHERE (status = ANY (ARRAY['ordered'::public.quote_status, 'in_production'::public.quote_status, 'ready'::public.quote_status, 'finished'::public.quote_status]));


--
-- Name: idx_shipment_items_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_items_deleted_at ON public.shipment_items USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_shipment_items_po_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_items_po_item_id ON public.shipment_items USING btree (purchase_order_item_id);


--
-- Name: idx_shipment_items_shipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_items_shipment_id ON public.shipment_items USING btree (shipment_id);


--
-- Name: idx_shipments_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_deleted_at ON public.shipments USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_shipments_partner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_partner_id ON public.shipments USING btree (partner_id);


--
-- Name: idx_shipments_purchase_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_purchase_order_id ON public.shipments USING btree (purchase_order_id);


--
-- Name: idx_shipments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_status ON public.shipments USING btree (status);


--
-- Name: idx_shipments_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_warehouse_id ON public.shipments USING btree (warehouse_id);


--
-- Name: idx_shop_order_items_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_order_items_deleted_at ON public.shop_order_items USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_shop_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_order_items_order_id ON public.shop_order_items USING btree (order_id);


--
-- Name: idx_shop_order_items_partner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_order_items_partner_id ON public.shop_order_items USING btree (partner_id);


--
-- Name: idx_shop_order_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_order_items_status ON public.shop_order_items USING btree (status);


--
-- Name: idx_shop_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_orders_created_at ON public.shop_orders USING btree (created_at);


--
-- Name: idx_shop_orders_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_orders_deleted_at ON public.shop_orders USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_shop_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_orders_order_number ON public.shop_orders USING btree (order_number);


--
-- Name: idx_shop_orders_sms_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_orders_sms_sent_at ON public.shop_orders USING btree (sms_sent_at) WHERE (sms_sent_at IS NOT NULL);


--
-- Name: idx_shop_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_orders_status ON public.shop_orders USING btree (status);


--
-- Name: idx_shop_orders_worker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_orders_worker_id ON public.shop_orders USING btree (worker_id);


--
-- Name: idx_sms_settings_template_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_settings_template_name ON public.sms_settings USING btree (template_name);


--
-- Name: idx_stock_movements_accessory_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_accessory_id ON public.stock_movements USING btree (accessory_id);


--
-- Name: idx_stock_movements_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_created_at ON public.stock_movements USING btree (created_at);


--
-- Name: idx_stock_movements_linear_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_linear_material_id ON public.stock_movements USING btree (linear_material_id);


--
-- Name: idx_stock_movements_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_material_id ON public.stock_movements USING btree (material_id);


--
-- Name: idx_stock_movements_product_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_product_type ON public.stock_movements USING btree (product_type);


--
-- Name: idx_stock_movements_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_source ON public.stock_movements USING btree (source_type, source_id);


--
-- Name: idx_stock_movements_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_warehouse ON public.stock_movements USING btree (warehouse_id);


--
-- Name: idx_tenant_company_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_company_name_active ON public.tenant_company USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_units_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_active_ordered ON public.units USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_units_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_name_active ON public.units USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_units_shortform_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_shortform_active ON public.units USING btree (shortform) WHERE (deleted_at IS NULL);


--
-- Name: idx_user_permissions_page_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_page_id ON public.user_permissions USING btree (page_id);


--
-- Name: idx_user_permissions_user_access; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_user_access ON public.user_permissions USING btree (user_id, can_access);


--
-- Name: idx_user_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- Name: idx_user_pins_pin_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_pins_pin_active ON public.user_pins USING btree (pin) WHERE (is_active = true);


--
-- Name: idx_user_pins_worker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_pins_worker_id ON public.user_pins USING btree (worker_id);


--
-- Name: idx_users_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_deleted_at ON public.users USING btree (deleted_at);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_vat_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vat_active_ordered ON public.vat USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_vat_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vat_name_active ON public.vat USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_workers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workers_active ON public.workers USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_workers_color; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workers_color ON public.workers USING btree (color);


--
-- Name: idx_workers_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workers_deleted_at ON public.workers USING btree (deleted_at);


--
-- Name: idx_workers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workers_name ON public.workers USING btree (name);


--
-- Name: idx_workers_nickname; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workers_nickname ON public.workers USING btree (nickname);


--
-- Name: ix_brands_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_brands_deleted_at ON public.brands USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_currencies_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_currencies_deleted_at ON public.currencies USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_customers_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_customers_deleted_at ON public.customers USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_materials_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_materials_deleted_at ON public.materials USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_partners_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_partners_deleted_at ON public.partners USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_tenant_company_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_tenant_company_deleted_at ON public.tenant_company USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_units_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_units_deleted_at ON public.units USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_vat_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_vat_deleted_at ON public.vat USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: materials_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX materials_name_unique_active ON public.materials USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: partners_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX partners_name_unique_active ON public.partners USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: production_machines_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX production_machines_name_unique_active ON public.production_machines USING btree (machine_name) WHERE (deleted_at IS NULL);


--
-- Name: tenant_company_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_company_name_unique_active ON public.tenant_company USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: units_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX units_name_unique_active ON public.units USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: uq_product_suggestions_item_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_suggestions_item_hash ON public.product_suggestions USING btree (shop_order_item_id, suggestion_hash);


--
-- Name: uq_stock_movements_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_stock_movements_number ON public.stock_movements USING btree (stock_movement_number);


--
-- Name: uq_warehouses_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_warehouses_code ON public.warehouses USING btree (code);


--
-- Name: vat_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vat_name_unique_active ON public.vat USING btree (name) WHERE (deleted_at IS NULL);


--
--
--

--
--

--
--

--
-- Name: media_files media_files_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER media_files_updated_at BEFORE UPDATE ON public.media_files FOR EACH ROW EXECUTE FUNCTION public.update_media_files_updated_at();


--
-- Name: pages on_public_page_created_or_activated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_public_page_created_or_activated AFTER INSERT OR UPDATE OF is_active ON public.pages FOR EACH ROW EXECUTE FUNCTION public.handle_new_page_permissions();


--
-- Name: accessories trigger_calculate_accessory_net_price; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_accessory_net_price BEFORE INSERT OR UPDATE ON public.accessories FOR EACH ROW EXECUTE FUNCTION public.calculate_accessory_net_price();


--
-- Name: linear_materials trigger_calculate_linear_materials_price_per_m; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_linear_materials_price_per_m BEFORE INSERT OR UPDATE ON public.linear_materials FOR EACH ROW EXECUTE FUNCTION public.calculate_linear_materials_price_per_m();


--
-- Name: materials trigger_calculate_materials_price_per_sqm; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_materials_price_per_sqm BEFORE INSERT OR UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.calculate_materials_price_per_sqm();


--
-- Name: quote_payments trigger_update_payment_status_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_payment_status_delete AFTER DELETE ON public.quote_payments FOR EACH ROW EXECUTE FUNCTION public.update_quote_payment_status();


--
-- Name: quote_payments trigger_update_payment_status_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_payment_status_insert AFTER INSERT ON public.quote_payments FOR EACH ROW EXECUTE FUNCTION public.update_quote_payment_status();


--
-- Name: quote_payments trigger_update_payment_status_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_payment_status_update AFTER UPDATE ON public.quote_payments FOR EACH ROW EXECUTE FUNCTION public.update_quote_payment_status();


--
-- Name: pos_order_items trigger_update_pos_order_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_pos_order_items_updated_at BEFORE UPDATE ON public.pos_order_items FOR EACH ROW EXECUTE FUNCTION public.update_pos_order_items_updated_at();


--
-- Name: pos_orders trigger_update_pos_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_pos_orders_updated_at BEFORE UPDATE ON public.pos_orders FOR EACH ROW EXECUTE FUNCTION public.update_pos_orders_updated_at();


--
-- Name: pos_payments trigger_update_pos_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_pos_payments_updated_at BEFORE UPDATE ON public.pos_payments FOR EACH ROW EXECUTE FUNCTION public.update_pos_payments_updated_at();


--
-- Name: purchase_order_items trigger_update_purchase_order_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_purchase_order_items_updated_at BEFORE UPDATE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: purchase_orders trigger_update_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quotes trigger_update_quote_status_timestamps; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_quote_status_timestamps BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_quote_status_timestamps();


--
-- Name: TRIGGER trigger_update_quote_status_timestamps ON quotes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER trigger_update_quote_status_timestamps ON public.quotes IS 'Automatically records timestamp when quote status changes for analytics and reporting.';


--
-- Name: shipment_items trigger_update_shipment_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_shipment_items_updated_at BEFORE UPDATE ON public.shipment_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shipments trigger_update_shipments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shop_order_items trigger_update_shop_order_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_shop_order_status AFTER INSERT OR DELETE OR UPDATE ON public.shop_order_items FOR EACH ROW EXECUTE FUNCTION public.update_shop_order_status();


--
-- Name: TRIGGER trigger_update_shop_order_status ON shop_order_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER trigger_update_shop_order_status ON public.shop_order_items IS 'Updates parent shop_order status whenever items are inserted, updated, or deleted. Deleted items are ignored when determining if order is finished.';


--
-- Name: user_pins trigger_update_user_pins_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_user_pins_updated_at BEFORE UPDATE ON public.user_pins FOR EACH ROW EXECUTE FUNCTION public.update_user_pins_updated_at();


--
-- Name: accessories update_accessories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_accessories_updated_at BEFORE UPDATE ON public.accessories FOR EACH ROW EXECUTE FUNCTION public.update_accessories_updated_at();


--
-- Name: brands update_brands_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: currencies update_currencies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON public.currencies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cutting_fees update_cutting_fees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cutting_fees_updated_at BEFORE UPDATE ON public.cutting_fees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: feetypes update_feetypes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_feetypes_updated_at BEFORE UPDATE ON public.feetypes FOR EACH ROW EXECUTE FUNCTION public.update_feetypes_updated_at();


--
-- Name: linear_materials update_linear_materials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_linear_materials_updated_at BEFORE UPDATE ON public.linear_materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: machine_linear_material_map update_machine_linear_material_map_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_machine_linear_material_map_updated_at BEFORE UPDATE ON public.machine_linear_material_map FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: material_group_settings update_material_group_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_material_group_settings_updated_at BEFORE UPDATE ON public.material_group_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: material_settings update_material_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_material_settings_updated_at BEFORE UPDATE ON public.material_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: materials update_materials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: partners update_partners_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_methods update_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: production_machines update_production_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_production_machines_updated_at BEFORE UPDATE ON public.production_machines FOR EACH ROW EXECUTE FUNCTION public.update_production_machines_updated_at();


--
-- Name: quote_accessories update_quote_accessories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quote_accessories_updated_at BEFORE UPDATE ON public.quote_accessories FOR EACH ROW EXECUTE FUNCTION public.update_quote_accessories_updated_at();


--
-- Name: quote_fees update_quote_fees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quote_fees_updated_at BEFORE UPDATE ON public.quote_fees FOR EACH ROW EXECUTE FUNCTION public.update_quote_fees_updated_at();


--
-- Name: quotes update_quotes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sms_settings update_sms_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sms_settings_updated_at BEFORE UPDATE ON public.sms_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_company update_tenant_company_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenant_company_updated_at BEFORE UPDATE ON public.tenant_company FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: units update_units_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vat update_vat_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vat_updated_at BEFORE UPDATE ON public.vat FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: accessories accessories_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;


--
-- Name: accessories accessories_default_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_default_warehouse_id_fkey FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: accessories accessories_partners_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_partners_id_fkey FOREIGN KEY (partners_id) REFERENCES public.partners(id) ON DELETE RESTRICT;


--
-- Name: accessories accessories_units_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: accessories accessories_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT;


--
-- Name: cutting_fees cutting_fees_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cutting_fees
    ADD CONSTRAINT cutting_fees_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id);


--
-- Name: cutting_fees cutting_fees_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cutting_fees
    ADD CONSTRAINT cutting_fees_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id);


--
-- Name: edge_materials edge_materials_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edge_materials
    ADD CONSTRAINT edge_materials_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id);


--
-- Name: edge_materials edge_materials_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edge_materials
    ADD CONSTRAINT edge_materials_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id);


--
-- Name: feetypes feetypes_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feetypes
    ADD CONSTRAINT feetypes_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;


--
-- Name: feetypes feetypes_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feetypes
    ADD CONSTRAINT feetypes_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT;


--
-- Name: linear_material_price_history linear_material_price_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: linear_material_price_history linear_material_price_history_linear_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id) ON DELETE CASCADE;


--
-- Name: linear_material_price_history linear_material_price_history_new_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_new_currency_id_fkey FOREIGN KEY (new_currency_id) REFERENCES public.currencies(id);


--
-- Name: linear_material_price_history linear_material_price_history_new_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_new_vat_id_fkey FOREIGN KEY (new_vat_id) REFERENCES public.vat(id);


--
-- Name: linear_material_price_history linear_material_price_history_old_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_old_currency_id_fkey FOREIGN KEY (old_currency_id) REFERENCES public.currencies(id);


--
-- Name: linear_material_price_history linear_material_price_history_old_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_old_vat_id_fkey FOREIGN KEY (old_vat_id) REFERENCES public.vat(id);


--
-- Name: linear_materials linear_materials_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE RESTRICT;


--
-- Name: linear_materials linear_materials_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;


--
-- Name: linear_materials linear_materials_default_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_default_warehouse_id_fkey FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: linear_materials linear_materials_partners_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_partners_id_fkey FOREIGN KEY (partners_id) REFERENCES public.partners(id) ON DELETE RESTRICT;


--
-- Name: linear_materials linear_materials_units_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: linear_materials linear_materials_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT;


--
-- Name: machine_edge_material_map machine_edge_material_map_edge_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_edge_material_map
    ADD CONSTRAINT machine_edge_material_map_edge_material_id_fkey FOREIGN KEY (edge_material_id) REFERENCES public.edge_materials(id) ON DELETE CASCADE;


--
-- Name: machine_linear_material_map machine_linear_material_map_linear_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_linear_material_map
    ADD CONSTRAINT machine_linear_material_map_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id) ON DELETE CASCADE;


--
-- Name: machine_material_map machine_material_map_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_material_map
    ADD CONSTRAINT machine_material_map_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: material_group_settings material_group_settings_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_group_settings
    ADD CONSTRAINT material_group_settings_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.material_groups(id);


--
-- Name: material_inventory_transactions material_inventory_transactions_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_inventory_transactions
    ADD CONSTRAINT material_inventory_transactions_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: material_price_history material_price_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_price_history
    ADD CONSTRAINT material_price_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: material_price_history material_price_history_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_price_history
    ADD CONSTRAINT material_price_history_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- Name: material_settings material_settings_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_settings
    ADD CONSTRAINT material_settings_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: materials materials_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id);


--
-- Name: materials materials_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id);


--
-- Name: materials materials_default_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_default_warehouse_id_fkey FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: materials materials_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.material_groups(id);


--
-- Name: materials materials_partners_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_partners_id_fkey FOREIGN KEY (partners_id) REFERENCES public.partners(id) ON DELETE RESTRICT;


--
-- Name: materials materials_units_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: materials materials_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id);


--
-- Name: quote_payments order_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_payments
    ADD CONSTRAINT order_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: partners partners_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;


--
-- Name: partners partners_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT;


--
-- Name: pos_order_items pos_order_items_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE RESTRICT;


--
-- Name: pos_order_items pos_order_items_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;


--
-- Name: pos_order_items pos_order_items_feetype_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_feetype_id_fkey FOREIGN KEY (feetype_id) REFERENCES public.feetypes(id) ON DELETE SET NULL;


--
-- Name: pos_order_items pos_order_items_linear_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id) ON DELETE RESTRICT;


--
-- Name: pos_order_items pos_order_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: pos_order_items pos_order_items_pos_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_pos_order_id_fkey FOREIGN KEY (pos_order_id) REFERENCES public.pos_orders(id) ON DELETE CASCADE;


--
-- Name: pos_order_items pos_order_items_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT;


--
-- Name: pos_orders pos_orders_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_orders
    ADD CONSTRAINT pos_orders_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE RESTRICT;


--
-- Name: pos_payments pos_payments_pos_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_payments
    ADD CONSTRAINT pos_payments_pos_order_id_fkey FOREIGN KEY (pos_order_id) REFERENCES public.pos_orders(id) ON DELETE CASCADE;


--
-- Name: product_suggestions product_suggestions_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id);


--
-- Name: product_suggestions product_suggestions_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id);


--
-- Name: product_suggestions product_suggestions_raw_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_raw_currency_id_fkey FOREIGN KEY (raw_currency_id) REFERENCES public.currencies(id);


--
-- Name: product_suggestions product_suggestions_raw_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_raw_partner_id_fkey FOREIGN KEY (raw_partner_id) REFERENCES public.partners(id);


--
-- Name: product_suggestions product_suggestions_raw_units_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_raw_units_id_fkey FOREIGN KEY (raw_units_id) REFERENCES public.units(id);


--
-- Name: product_suggestions product_suggestions_raw_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_raw_vat_id_fkey FOREIGN KEY (raw_vat_id) REFERENCES public.vat(id);


--
-- Name: product_suggestions product_suggestions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.workers(id);


--
-- Name: product_suggestions product_suggestions_shop_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_shop_order_item_id_fkey FOREIGN KEY (shop_order_item_id) REFERENCES public.shop_order_items(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_linear_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id) ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_shop_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_shop_order_item_id_fkey FOREIGN KEY (shop_order_item_id) REFERENCES public.shop_order_items(id) ON DELETE SET NULL;


--
-- Name: purchase_order_items purchase_order_items_units_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT;


--
-- Name: purchase_orders purchase_orders_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE RESTRICT;


--
-- Name: purchase_orders purchase_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;


--
-- Name: quote_accessories quote_accessories_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_accessories
    ADD CONSTRAINT quote_accessories_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE RESTRICT;


--
-- Name: quote_accessories quote_accessories_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_accessories
    ADD CONSTRAINT quote_accessories_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id);


--
-- Name: quote_accessories quote_accessories_product_suggestion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_accessories
    ADD CONSTRAINT quote_accessories_product_suggestion_id_fkey FOREIGN KEY (product_suggestion_id) REFERENCES public.product_suggestions(id) ON DELETE SET NULL;


--
-- Name: quote_accessories quote_accessories_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_accessories
    ADD CONSTRAINT quote_accessories_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_accessories quote_accessories_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_accessories
    ADD CONSTRAINT quote_accessories_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: quote_edge_materials_breakdown quote_edge_materials_breakdown_edge_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_edge_materials_breakdown
    ADD CONSTRAINT quote_edge_materials_breakdown_edge_material_id_fkey FOREIGN KEY (edge_material_id) REFERENCES public.edge_materials(id) ON DELETE RESTRICT;


--
-- Name: quote_edge_materials_breakdown quote_edge_materials_breakdown_quote_materials_pricing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_edge_materials_breakdown
    ADD CONSTRAINT quote_edge_materials_breakdown_quote_materials_pricing_id_fkey FOREIGN KEY (quote_materials_pricing_id) REFERENCES public.quote_materials_pricing(id) ON DELETE CASCADE;


--
-- Name: quote_fees quote_fees_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_fees
    ADD CONSTRAINT quote_fees_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id);


--
-- Name: quote_fees quote_fees_feetype_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_fees
    ADD CONSTRAINT quote_fees_feetype_id_fkey FOREIGN KEY (feetype_id) REFERENCES public.feetypes(id) ON DELETE RESTRICT;


--
-- Name: quote_fees quote_fees_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_fees
    ADD CONSTRAINT quote_fees_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_materials_pricing quote_materials_pricing_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_materials_pricing
    ADD CONSTRAINT quote_materials_pricing_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: quote_materials_pricing quote_materials_pricing_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_materials_pricing
    ADD CONSTRAINT quote_materials_pricing_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_panels quote_panels_edge_material_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_edge_material_a_id_fkey FOREIGN KEY (edge_material_a_id) REFERENCES public.edge_materials(id) ON DELETE RESTRICT;


--
-- Name: quote_panels quote_panels_edge_material_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_edge_material_b_id_fkey FOREIGN KEY (edge_material_b_id) REFERENCES public.edge_materials(id) ON DELETE RESTRICT;


--
-- Name: quote_panels quote_panels_edge_material_c_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_edge_material_c_id_fkey FOREIGN KEY (edge_material_c_id) REFERENCES public.edge_materials(id) ON DELETE RESTRICT;


--
-- Name: quote_panels quote_panels_edge_material_d_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_edge_material_d_id_fkey FOREIGN KEY (edge_material_d_id) REFERENCES public.edge_materials(id) ON DELETE RESTRICT;


--
-- Name: quote_panels quote_panels_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: quote_panels quote_panels_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_payments quote_payments_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_payments
    ADD CONSTRAINT quote_payments_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_services_breakdown quote_services_breakdown_quote_materials_pricing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_services_breakdown
    ADD CONSTRAINT quote_services_breakdown_quote_materials_pricing_id_fkey FOREIGN KEY (quote_materials_pricing_id) REFERENCES public.quote_materials_pricing(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: quotes quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: quotes quotes_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL;


--
-- Name: quotes quotes_production_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_production_machine_id_fkey FOREIGN KEY (production_machine_id) REFERENCES public.production_machines(id) ON DELETE RESTRICT;


--
-- Name: shipment_items shipment_items_purchase_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_purchase_order_item_id_fkey FOREIGN KEY (purchase_order_item_id) REFERENCES public.purchase_order_items(id) ON DELETE RESTRICT;


--
-- Name: shipment_items shipment_items_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id) ON DELETE CASCADE;


--
-- Name: shipments shipments_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE RESTRICT;


--
-- Name: shipments shipments_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: shipments shipments_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;


--
-- Name: shop_order_items shop_order_items_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE SET NULL;


--
-- Name: shop_order_items shop_order_items_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id);


--
-- Name: shop_order_items shop_order_items_linear_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id) ON DELETE SET NULL;


--
-- Name: shop_order_items shop_order_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE SET NULL;


--
-- Name: shop_order_items shop_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE;


--
-- Name: shop_order_items shop_order_items_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id);


--
-- Name: shop_order_items shop_order_items_units_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id);


--
-- Name: shop_order_items shop_order_items_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id);


--
-- Name: shop_orders shop_orders_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id);


--
-- Name: stock_movements stock_movements_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_linear_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;


--
-- Name: user_permissions user_permissions_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_pins user_pins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pins
    ADD CONSTRAINT user_pins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_pins user_pins_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pins
    ADD CONSTRAINT user_pins_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE SET NULL;


--
-- Name: cutting_fees Allow anon users to read cutting fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anon users to read cutting fees" ON public.cutting_fees FOR SELECT TO anon USING (true);


--
-- Name: tenant_company Allow anon users to read tenant company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anon users to read tenant company" ON public.tenant_company FOR SELECT TO anon USING (true);


--
-- Name: cutting_fees Allow authenticated users to insert cutting fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert cutting fees" ON public.cutting_fees FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: cutting_fees Allow authenticated users to read cutting fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read cutting fees" ON public.cutting_fees FOR SELECT TO authenticated USING (true);


--
-- Name: cutting_fees Allow authenticated users to update cutting fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to update cutting fees" ON public.cutting_fees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: pages Authenticated users can view pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view pages" ON public.pages FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: edge_materials Enable all operations for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all operations for all users" ON public.edge_materials USING (true) WITH CHECK (true);


--
-- Name: quote_accessories Enable delete for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for authenticated users" ON public.quote_accessories FOR DELETE USING ((auth.role() = 'authenticated'::text));


--
-- Name: quote_fees Enable delete for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for authenticated users" ON public.quote_fees FOR DELETE USING ((auth.role() = 'authenticated'::text));


--
-- Name: quote_accessories Enable insert for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for authenticated users" ON public.quote_accessories FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: quote_fees Enable insert for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for authenticated users" ON public.quote_fees FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: quote_accessories Enable read access for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for authenticated users" ON public.quote_accessories FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: quote_fees Enable read access for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for authenticated users" ON public.quote_fees FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: quote_accessories Enable update for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for authenticated users" ON public.quote_accessories FOR UPDATE USING ((auth.role() = 'authenticated'::text));


--
-- Name: quote_fees Enable update for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for authenticated users" ON public.quote_fees FOR UPDATE USING ((auth.role() = 'authenticated'::text));


--
-- Name: pages Pages are readable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Pages are readable by authenticated users" ON public.pages FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: edge_materials Users can delete edge materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete edge materials" ON public.edge_materials FOR DELETE USING ((auth.role() = 'authenticated'::text));


--
-- Name: edge_materials Users can insert edge materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert edge materials" ON public.edge_materials FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: edge_materials Users can update edge materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update edge materials" ON public.edge_materials FOR UPDATE USING ((auth.role() = 'authenticated'::text));


--
-- Name: edge_materials Users can view edge materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view edge materials" ON public.edge_materials FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: cutting_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cutting_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: edge_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.edge_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_payments order_payments_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payments_delete_policy ON public.quote_payments FOR DELETE USING ((auth.uid() IS NOT NULL));


--
-- Name: quote_payments order_payments_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payments_insert_policy ON public.quote_payments FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: quote_payments order_payments_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payments_select_policy ON public.quote_payments FOR SELECT USING (((auth.uid() IS NOT NULL) AND (deleted_at IS NULL)));


--
-- Name: quote_payments order_payments_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payments_update_policy ON public.quote_payments FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (deleted_at IS NULL)));


--
-- Name: pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_accessories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_accessories ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_payments quote_payments_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_payments_delete_policy ON public.quote_payments FOR DELETE USING ((auth.uid() IS NOT NULL));


--
-- Name: quote_payments quote_payments_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_payments_insert_policy ON public.quote_payments FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: quote_payments quote_payments_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_payments_select_policy ON public.quote_payments FOR SELECT USING (((auth.uid() IS NOT NULL) AND (deleted_at IS NULL)));


--
-- Name: quote_payments quote_payments_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_payments_update_policy ON public.quote_payments FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (deleted_at IS NULL)));


--
