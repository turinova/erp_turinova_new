-- =============================================================================
-- TURINOVA ERP DATABASE SETUP SCRIPT
-- =============================================================================
-- This script creates a complete Turinova ERP database schema
-- Run this in a new Supabase project's SQL Editor
-- Version: 2.0
-- Last Updated: 2025-01-27
-- Includes: Sequences, Functions, Triggers, Views, Indexes, Sample Data
-- =============================================================================

-- =============================================================================
-- SECTION 1: EXTENSIONS
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- SECTION 2: CUSTOM TYPES
-- =============================================================================

-- Quote status enum
DO $$ BEGIN
  CREATE TYPE quote_status AS ENUM (
    'draft', 
    'sent', 
    'accepted', 
    'rejected', 
    'ordered', 
    'in_production', 
    'ready', 
    'finished', 
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Machine type enum
DO $$ BEGIN
  CREATE TYPE machine_type_enum AS ENUM ('Korpus', 'Front', 'Other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- SECTION 2.5: SEQUENCES
-- =============================================================================

-- Sequence for shop order numbering
CREATE SEQUENCE IF NOT EXISTS public.shop_order_number_seq START WITH 1 INCREMENT BY 1;

-- =============================================================================
-- SECTION 3: BASE TABLES (No Foreign Keys)
-- =============================================================================

-- Brands
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT brands_pkey PRIMARY KEY (id)
);

-- Currencies
CREATE TABLE IF NOT EXISTS public.currencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  rate numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT currencies_pkey PRIMARY KEY (id)
);

-- VAT Rates
CREATE TABLE IF NOT EXISTS public.vat (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  kulcs numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT vat_pkey PRIMARY KEY (id)
);

-- Units
CREATE TABLE IF NOT EXISTS public.units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  shortform character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT units_pkey PRIMARY KEY (id)
);

-- Material Groups
CREATE TABLE IF NOT EXISTS public.material_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT material_groups_pkey PRIMARY KEY (id)
);

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  mobile character varying,
  discount_percent numeric DEFAULT 0,
  billing_name character varying,
  billing_country character varying DEFAULT 'Magyarország'::character varying,
  billing_city character varying,
  billing_postal_code character varying,
  billing_street character varying,
  billing_house_number character varying,
  billing_tax_number character varying,
  billing_company_reg_number character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  sms_notification boolean NOT NULL DEFAULT true,
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);

-- Tenant Company
CREATE TABLE IF NOT EXISTS public.tenant_company (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT tenant_company_pkey PRIMARY KEY (id)
);

-- Workers
CREATE TABLE IF NOT EXISTS public.workers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  mobile character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  nickname character varying,
  color character varying DEFAULT '#1976d2'::character varying,
  CONSTRAINT workers_pkey PRIMARY KEY (id)
);

-- Production Machines
CREATE TABLE IF NOT EXISTS public.production_machines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  machine_name character varying NOT NULL,
  comment text,
  usage_limit_per_day integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT production_machines_pkey PRIMARY KEY (id)
);

-- Payment Methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  comment text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT payment_methods_pkey PRIMARY KEY (id)
);

-- Pages (for permissions)
CREATE TABLE IF NOT EXISTS public.pages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  path character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  description text,
  category character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pages_pkey PRIMARY KEY (id)
);

-- Users (mirror of auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_sign_in_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Media Files
CREATE TABLE IF NOT EXISTS public.media_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  original_filename text NOT NULL,
  stored_filename text NOT NULL UNIQUE,
  storage_path text NOT NULL,
  full_url text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  mimetype text DEFAULT 'image/webp'::text,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT media_files_pkey PRIMARY KEY (id)
);

-- SMS Settings
CREATE TABLE IF NOT EXISTS public.sms_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_template text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  template_name character varying NOT NULL UNIQUE,
  CONSTRAINT sms_settings_pkey PRIMARY KEY (id)
);

-- Material Audit
CREATE TABLE IF NOT EXISTS public.material_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_name character varying NOT NULL,
  row_id uuid NOT NULL,
  action character varying NOT NULL,
  actor character varying,
  before_data jsonb,
  after_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT material_audit_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- SECTION 4: TABLES WITH FOREIGN KEYS (Level 1)
-- =============================================================================

-- Partners
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  status character varying NOT NULL DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying::text, 'inactive'::character varying::text])),
  contact_person character varying,
  vat_id uuid,
  currency_id uuid,
  payment_terms integer NOT NULL DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT partners_pkey PRIMARY KEY (id),
  CONSTRAINT partners_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id),
  CONSTRAINT partners_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id)
);

-- Fee Types
CREATE TABLE IF NOT EXISTS public.feetypes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  net_price numeric NOT NULL,
  vat_id uuid NOT NULL,
  currency_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT feetypes_pkey PRIMARY KEY (id),
  CONSTRAINT feetypes_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id),
  CONSTRAINT feetypes_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id)
);

-- Cutting Fees
CREATE TABLE IF NOT EXISTS public.cutting_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fee_per_meter numeric NOT NULL DEFAULT 300,
  currency_id uuid NOT NULL,
  vat_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  panthelyfuras_fee_per_hole numeric DEFAULT 50,
  duplungolas_fee_per_sqm numeric DEFAULT 200,
  szogvagas_fee_per_panel numeric DEFAULT 100,
  CONSTRAINT cutting_fees_pkey PRIMARY KEY (id),
  CONSTRAINT cutting_fees_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id),
  CONSTRAINT cutting_fees_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id)
);

-- Edge Materials
CREATE TABLE IF NOT EXISTS public.edge_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL,
  type character varying NOT NULL,
  thickness numeric NOT NULL,
  width integer NOT NULL,
  decor character varying NOT NULL,
  price numeric NOT NULL,
  vat_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  active boolean NOT NULL DEFAULT true,
  ráhagyás integer NOT NULL DEFAULT 0,
  favourite_priority integer,
  CONSTRAINT edge_materials_pkey PRIMARY KEY (id),
  CONSTRAINT edge_materials_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id),
  CONSTRAINT edge_materials_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id)
);

-- Materials
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand_id uuid,
  group_id uuid,
  name character varying NOT NULL,
  length_mm integer NOT NULL,
  width_mm integer NOT NULL,
  thickness_mm integer NOT NULL,
  grain_direction boolean DEFAULT false,
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  on_stock boolean NOT NULL DEFAULT true,
  price_per_sqm numeric NOT NULL DEFAULT 0,
  currency_id uuid,
  vat_id uuid,
  active boolean NOT NULL DEFAULT true,
  base_price integer NOT NULL CHECK (base_price > 0),
  multiplier numeric NOT NULL DEFAULT 1.38 CHECK (multiplier >= 1.00 AND multiplier <= 5.00),
  partners_id uuid,
  units_id uuid NOT NULL,
  CONSTRAINT materials_pkey PRIMARY KEY (id),
  CONSTRAINT materials_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id),
  CONSTRAINT materials_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id),
  CONSTRAINT materials_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.material_groups(id),
  CONSTRAINT materials_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id),
  CONSTRAINT materials_partners_id_fkey FOREIGN KEY (partners_id) REFERENCES public.partners(id),
  CONSTRAINT materials_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id)
);

-- Linear Materials
CREATE TABLE IF NOT EXISTS public.linear_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL,
  name character varying NOT NULL,
  width numeric NOT NULL,
  length numeric NOT NULL,
  thickness numeric NOT NULL,
  type text NOT NULL,
  image_url text,
  price_per_m numeric NOT NULL DEFAULT 0,
  currency_id uuid,
  vat_id uuid,
  on_stock boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  base_price integer NOT NULL CHECK (base_price > 0),
  multiplier numeric NOT NULL DEFAULT 1.38 CHECK (multiplier >= 1.00 AND multiplier <= 5.00),
  partners_id uuid,
  units_id uuid NOT NULL,
  CONSTRAINT linear_materials_pkey PRIMARY KEY (id),
  CONSTRAINT linear_materials_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id),
  CONSTRAINT linear_materials_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id),
  CONSTRAINT linear_materials_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id),
  CONSTRAINT linear_materials_partners_id_fkey FOREIGN KEY (partners_id) REFERENCES public.partners(id),
  CONSTRAINT linear_materials_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id)
);

-- Accessories
CREATE TABLE IF NOT EXISTS public.accessories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  sku character varying NOT NULL,
  net_price integer NOT NULL,
  vat_id uuid NOT NULL,
  currency_id uuid NOT NULL,
  units_id uuid NOT NULL,
  partners_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  base_price integer NOT NULL CHECK (base_price > 0),
  multiplier numeric DEFAULT 1.38 CHECK (multiplier >= 1.00 AND multiplier <= 5.00),
  CONSTRAINT accessories_pkey PRIMARY KEY (id),
  CONSTRAINT accessories_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id),
  CONSTRAINT accessories_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id),
  CONSTRAINT accessories_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id),
  CONSTRAINT accessories_partners_id_fkey FOREIGN KEY (partners_id) REFERENCES public.partners(id)
);

-- User Permissions
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_id uuid NOT NULL,
  can_access boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_permissions_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id)
);

-- =============================================================================
-- SECTION 5: TABLES WITH FOREIGN KEYS (Level 2)
-- =============================================================================

-- Material Settings
CREATE TABLE IF NOT EXISTS public.material_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid UNIQUE,
  kerf_mm integer NOT NULL,
  trim_top_mm integer NOT NULL,
  trim_right_mm integer NOT NULL,
  trim_bottom_mm integer NOT NULL,
  trim_left_mm integer NOT NULL,
  rotatable boolean NOT NULL,
  waste_multi double precision NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  usage_limit numeric DEFAULT 0.65 CHECK (usage_limit >= 0::numeric AND usage_limit <= 1::numeric),
  CONSTRAINT material_settings_pkey PRIMARY KEY (id),
  CONSTRAINT material_settings_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id)
);

-- Material Group Settings
CREATE TABLE IF NOT EXISTS public.material_group_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid UNIQUE,
  kerf_mm integer DEFAULT 3,
  trim_top_mm integer DEFAULT 0,
  trim_right_mm integer DEFAULT 0,
  trim_bottom_mm integer DEFAULT 0,
  trim_left_mm integer DEFAULT 0,
  rotatable boolean DEFAULT true,
  waste_multi double precision DEFAULT 1.0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT material_group_settings_pkey PRIMARY KEY (id),
  CONSTRAINT material_group_settings_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.material_groups(id)
);

-- Machine Material Map
CREATE TABLE IF NOT EXISTS public.machine_material_map (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid,
  machine_code character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  machine_type machine_type_enum NOT NULL,
  CONSTRAINT machine_material_map_pkey PRIMARY KEY (id),
  CONSTRAINT machine_material_map_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id)
);

-- Machine Edge Material Map
CREATE TABLE IF NOT EXISTS public.machine_edge_material_map (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  edge_material_id uuid NOT NULL,
  machine_code character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  machine_type machine_type_enum NOT NULL DEFAULT 'Korpus'::machine_type_enum,
  CONSTRAINT machine_edge_material_map_pkey PRIMARY KEY (id),
  CONSTRAINT machine_edge_material_map_edge_material_id_fkey FOREIGN KEY (edge_material_id) REFERENCES public.edge_materials(id)
);

-- Machine Linear Material Map
CREATE TABLE IF NOT EXISTS public.machine_linear_material_map (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  linear_material_id uuid NOT NULL,
  machine_type text NOT NULL DEFAULT 'Korpus'::text,
  machine_code text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT machine_linear_material_map_pkey PRIMARY KEY (id),
  CONSTRAINT machine_linear_material_map_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id)
);

-- Material Price History
CREATE TABLE IF NOT EXISTS public.material_price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL,
  old_price_per_sqm numeric NOT NULL,
  new_price_per_sqm numeric NOT NULL,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT material_price_history_pkey PRIMARY KEY (id),
  CONSTRAINT material_price_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id),
  CONSTRAINT material_price_history_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id)
);

-- Linear Material Price History
CREATE TABLE IF NOT EXISTS public.linear_material_price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  linear_material_id uuid NOT NULL,
  old_price numeric,
  new_price numeric NOT NULL,
  old_currency_id uuid,
  new_currency_id uuid,
  old_vat_id uuid,
  new_vat_id uuid,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT linear_material_price_history_pkey PRIMARY KEY (id),
  CONSTRAINT linear_material_price_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id),
  CONSTRAINT linear_material_price_history_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id),
  CONSTRAINT linear_material_price_history_new_currency_id_fkey FOREIGN KEY (new_currency_id) REFERENCES public.currencies(id),
  CONSTRAINT linear_material_price_history_new_vat_id_fkey FOREIGN KEY (new_vat_id) REFERENCES public.vat(id),
  CONSTRAINT linear_material_price_history_old_currency_id_fkey FOREIGN KEY (old_currency_id) REFERENCES public.currencies(id),
  CONSTRAINT linear_material_price_history_old_vat_id_fkey FOREIGN KEY (old_vat_id) REFERENCES public.vat(id)
);

-- Shop Orders
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number character varying NOT NULL UNIQUE,
  worker_id uuid NOT NULL,
  customer_name character varying NOT NULL,
  customer_email character varying,
  customer_mobile character varying,
  customer_discount numeric DEFAULT 0,
  billing_name character varying,
  billing_country character varying,
  billing_city character varying,
  billing_postal_code character varying,
  billing_street character varying,
  billing_house_number character varying,
  billing_tax_number character varying,
  billing_company_reg_number character varying,
  status character varying DEFAULT 'open'::character varying CHECK (status::text = ANY (ARRAY['open'::character varying::text, 'ordered'::character varying::text, 'finished'::character varying::text, 'deleted'::character varying::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT shop_orders_pkey PRIMARY KEY (id),
  CONSTRAINT shop_orders_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id)
);

-- Quotes
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  quote_number character varying NOT NULL UNIQUE,
  status quote_status NOT NULL DEFAULT 'draft'::quote_status,
  total_net numeric NOT NULL,
  total_vat numeric NOT NULL,
  total_gross numeric NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 0,
  final_total_after_discount numeric NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  fees_total_net numeric DEFAULT 0,
  fees_total_vat numeric DEFAULT 0,
  fees_total_gross numeric DEFAULT 0,
  accessories_total_net numeric DEFAULT 0,
  accessories_total_vat numeric DEFAULT 0,
  accessories_total_gross numeric DEFAULT 0,
  order_number text UNIQUE,
  barcode text UNIQUE,
  production_machine_id uuid,
  production_date date,
  payment_status text DEFAULT 'not_paid'::text,
  source character varying DEFAULT 'internal'::character varying,
  comment text,
  payment_method_id uuid,
  CONSTRAINT quotes_pkey PRIMARY KEY (id),
  CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT quotes_production_machine_id_fkey FOREIGN KEY (production_machine_id) REFERENCES public.production_machines(id),
  CONSTRAINT quotes_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id)
);

-- =============================================================================
-- SECTION 6: TABLES WITH FOREIGN KEYS (Level 3 - Depend on Quotes/Orders)
-- =============================================================================

-- Shop Order Items
CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_name character varying NOT NULL,
  sku character varying,
  type character varying,
  base_price integer NOT NULL,
  multiplier numeric DEFAULT 1.38,
  quantity integer NOT NULL,
  units_id uuid,
  partner_id uuid,
  vat_id uuid,
  currency_id uuid,
  megjegyzes text,
  status character varying DEFAULT 'open'::character varying CHECK (status::text = ANY (ARRAY['open'::character varying::text, 'ordered'::character varying::text, 'arrived'::character varying::text, 'deleted'::character varying::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT shop_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT shop_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shop_orders(id),
  CONSTRAINT shop_order_items_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id),
  CONSTRAINT shop_order_items_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id),
  CONSTRAINT shop_order_items_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id),
  CONSTRAINT shop_order_items_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id)
);

-- Quote Panels
CREATE TABLE IF NOT EXISTS public.quote_panels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  material_id uuid NOT NULL,
  width_mm integer NOT NULL,
  height_mm integer NOT NULL,
  quantity integer NOT NULL,
  label character varying,
  edge_material_a_id uuid,
  edge_material_b_id uuid,
  edge_material_c_id uuid,
  edge_material_d_id uuid,
  panthelyfuras_quantity integer NOT NULL DEFAULT 0,
  panthelyfuras_oldal character varying,
  duplungolas boolean NOT NULL DEFAULT false,
  szogvagas boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quote_panels_pkey PRIMARY KEY (id),
  CONSTRAINT quote_panels_edge_material_a_id_fkey FOREIGN KEY (edge_material_a_id) REFERENCES public.edge_materials(id),
  CONSTRAINT quote_panels_edge_material_b_id_fkey FOREIGN KEY (edge_material_b_id) REFERENCES public.edge_materials(id),
  CONSTRAINT quote_panels_edge_material_c_id_fkey FOREIGN KEY (edge_material_c_id) REFERENCES public.edge_materials(id),
  CONSTRAINT quote_panels_edge_material_d_id_fkey FOREIGN KEY (edge_material_d_id) REFERENCES public.edge_materials(id),
  CONSTRAINT quote_panels_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id),
  CONSTRAINT quote_panels_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id)
);

-- Quote Materials Pricing
CREATE TABLE IF NOT EXISTS public.quote_materials_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  material_id uuid NOT NULL,
  material_name character varying NOT NULL,
  board_width_mm integer NOT NULL,
  board_length_mm integer NOT NULL,
  thickness_mm integer NOT NULL,
  grain_direction boolean NOT NULL,
  on_stock boolean NOT NULL,
  boards_used integer NOT NULL,
  usage_percentage numeric NOT NULL,
  pricing_method character varying NOT NULL,
  charged_sqm numeric,
  price_per_sqm numeric NOT NULL,
  vat_rate numeric NOT NULL,
  currency character varying NOT NULL,
  usage_limit numeric NOT NULL,
  waste_multi numeric NOT NULL,
  material_net numeric NOT NULL,
  material_vat numeric NOT NULL,
  material_gross numeric NOT NULL,
  edge_materials_net numeric NOT NULL DEFAULT 0,
  edge_materials_vat numeric NOT NULL DEFAULT 0,
  edge_materials_gross numeric NOT NULL DEFAULT 0,
  cutting_length_m numeric NOT NULL,
  cutting_net numeric NOT NULL DEFAULT 0,
  cutting_vat numeric NOT NULL DEFAULT 0,
  cutting_gross numeric NOT NULL DEFAULT 0,
  services_net numeric NOT NULL DEFAULT 0,
  services_vat numeric NOT NULL DEFAULT 0,
  services_gross numeric NOT NULL DEFAULT 0,
  total_net numeric NOT NULL,
  total_vat numeric NOT NULL,
  total_gross numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quote_materials_pricing_pkey PRIMARY KEY (id),
  CONSTRAINT quote_materials_pricing_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id),
  CONSTRAINT quote_materials_pricing_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id)
);

-- Quote Accessories
CREATE TABLE IF NOT EXISTS public.quote_accessories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  accessory_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  accessory_name character varying NOT NULL,
  sku character varying NOT NULL,
  unit_price_net numeric NOT NULL,
  vat_rate numeric NOT NULL,
  unit_id uuid NOT NULL,
  unit_name character varying NOT NULL,
  currency_id uuid NOT NULL,
  total_net numeric NOT NULL,
  total_vat numeric NOT NULL,
  total_gross numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  base_price integer NOT NULL CHECK (base_price >= 0),
  multiplier numeric NOT NULL DEFAULT 1.38 CHECK (multiplier >= 1.00 AND multiplier <= 5.00),
  CONSTRAINT quote_accessories_pkey PRIMARY KEY (id),
  CONSTRAINT quote_accessories_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id),
  CONSTRAINT quote_accessories_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id),
  CONSTRAINT quote_accessories_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT quote_accessories_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id)
);

-- Quote Fees
CREATE TABLE IF NOT EXISTS public.quote_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  feetype_id uuid NOT NULL,
  fee_name character varying NOT NULL,
  unit_price_net numeric NOT NULL,
  vat_rate numeric NOT NULL,
  vat_amount numeric NOT NULL,
  gross_price numeric NOT NULL,
  currency_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  comment text,
  CONSTRAINT quote_fees_pkey PRIMARY KEY (id),
  CONSTRAINT quote_fees_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id),
  CONSTRAINT quote_fees_feetype_id_fkey FOREIGN KEY (feetype_id) REFERENCES public.feetypes(id),
  CONSTRAINT quote_fees_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id)
);

-- Quote Payments
CREATE TABLE IF NOT EXISTS public.quote_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  comment text,
  payment_date timestamp without time zone NOT NULL DEFAULT now(),
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  created_by uuid,
  deleted_at timestamp without time zone,
  CONSTRAINT quote_payments_pkey PRIMARY KEY (id),
  CONSTRAINT order_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT quote_payments_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id)
);

-- Quote Edge Materials Breakdown
CREATE TABLE IF NOT EXISTS public.quote_edge_materials_breakdown (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_materials_pricing_id uuid NOT NULL,
  edge_material_id uuid NOT NULL,
  edge_material_name character varying NOT NULL,
  total_length_m numeric NOT NULL,
  price_per_m numeric NOT NULL,
  net_price numeric NOT NULL,
  vat_amount numeric NOT NULL,
  gross_price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quote_edge_materials_breakdown_pkey PRIMARY KEY (id),
  CONSTRAINT quote_edge_materials_breakdown_edge_material_id_fkey FOREIGN KEY (edge_material_id) REFERENCES public.edge_materials(id),
  CONSTRAINT quote_edge_materials_breakdown_quote_materials_pricing_id_fkey FOREIGN KEY (quote_materials_pricing_id) REFERENCES public.quote_materials_pricing(id)
);

-- Quote Services Breakdown
CREATE TABLE IF NOT EXISTS public.quote_services_breakdown (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_materials_pricing_id uuid NOT NULL,
  service_type character varying NOT NULL,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  net_price numeric NOT NULL,
  vat_amount numeric NOT NULL,
  gross_price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quote_services_breakdown_pkey PRIMARY KEY (id),
  CONSTRAINT quote_services_breakdown_quote_materials_pricing_id_fkey FOREIGN KEY (quote_materials_pricing_id) REFERENCES public.quote_materials_pricing(id)
);

-- =============================================================================
-- SECTION 6.5: CUSTOM FUNCTIONS
-- =============================================================================

-- ============================================
-- Price Calculation Functions
-- ============================================

CREATE OR REPLACE FUNCTION public.calculate_accessory_net_price()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.net_price = ROUND(NEW.base_price * NEW.multiplier);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_linear_materials_price_per_m()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.price_per_m = ROUND((NEW.base_price * NEW.multiplier)::numeric, 2);
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_materials_price_per_sqm()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.price_per_sqm = ROUND((NEW.base_price * NEW.multiplier)::numeric, 2);
    RETURN NEW;
END;
$function$;

-- ============================================
-- Number Generation Functions
-- ============================================

CREATE OR REPLACE FUNCTION public.generate_order_number(target_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  date_str TEXT;
  next_num INTEGER;
  new_order_number TEXT;
BEGIN
  date_str := TO_CHAR(target_date, 'YYYY-MM-DD');
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(order_number FROM 'ORD-\d{4}-\d{2}-\d{2}-(\d+)') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM orders
  WHERE order_number LIKE 'ORD-' || date_str || '-%'
    AND deleted_at IS NULL;
  
  new_order_number := 'ORD-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  
  RETURN new_order_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS character varying
LANGUAGE plpgsql
AS $function$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  new_quote_number VARCHAR(50);
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(quote_number FROM POSITION('-' IN quote_number) + 6)
      AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM public.quotes
  WHERE quote_number LIKE 'Q-' || current_year || '-%'
    AND deleted_at IS NULL;
  
  new_quote_number := 'Q-' || current_year || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_quote_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_quote_order_number()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  date_str TEXT;
  next_num INTEGER;
  new_order_number TEXT;
BEGIN
  date_str := TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');
  
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
  
  new_order_number := 'ORD-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  
  RETURN new_order_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_shop_order_number()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
    next_num INTEGER;
    order_num TEXT;
BEGIN
    SELECT nextval('shop_order_number_seq') INTO next_num;
    order_num := 'SO-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(next_num::TEXT, 3, '0');
    RETURN order_num;
END;
$function$;

-- ============================================
-- Permission Functions
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid uuid)
RETURNS TABLE(page_path character varying, can_access boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.path as page_path,
    COALESCE(up.can_access, true) as can_access
  FROM public.pages p
  LEFT JOIN public.user_permissions up ON p.id = up.page_id AND up.user_id = user_uuid
  WHERE p.is_active = true
  ORDER BY p.category, p.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_default_permissions_to_new_user()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.user_permissions (user_id, page_id, can_access)
    SELECT 
      NEW.id,
      p.id,
      true
    FROM public.pages p
    WHERE p.is_active = true
    ON CONFLICT (user_id, page_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to grant default permissions: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_page_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- ============================================
-- User Sync Function
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_user_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- ============================================
-- Status Update Functions
-- ============================================

CREATE OR REPLACE FUNCTION public.update_quote_payment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  total_paid NUMERIC(10,2);
  quote_total NUMERIC(10,2);
  new_status TEXT;
  target_quote_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_quote_id := OLD.quote_id;
  ELSE
    target_quote_id := NEW.quote_id;
  END IF;
  
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM quote_payments
  WHERE quote_id = target_quote_id 
    AND deleted_at IS NULL;
  
  SELECT COALESCE(final_total_after_discount, total_gross) INTO quote_total
  FROM quotes
  WHERE id = target_quote_id;
  
  IF total_paid = 0 THEN
    new_status := 'not_paid';
  ELSIF total_paid >= quote_total THEN
    new_status := 'paid';
  ELSE
    new_status := 'partial';
  END IF;
  
  UPDATE quotes
  SET payment_status = new_status,
      updated_at = NOW()
  WHERE id = target_quote_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_shop_order_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_order_id uuid;
  v_total_items integer;
  v_deleted_items integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  SELECT COUNT(*)
  INTO v_total_items
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL;

  SELECT COUNT(*)
  INTO v_deleted_items
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'deleted';

  IF v_total_items > 0 AND v_total_items = v_deleted_items THEN
    UPDATE shop_orders
    SET status = 'deleted',
        updated_at = NOW()
    WHERE id = v_order_id
      AND status != 'deleted';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- ============================================
-- Updated_at Trigger Functions
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_accessories_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_feetypes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_media_files_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_production_machines_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_quote_accessories_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_quote_fees_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- =============================================================================
-- SECTION 7: TRIGGERS
-- =============================================================================

-- Price calculation triggers
CREATE TRIGGER trigger_calculate_accessory_net_price
  BEFORE INSERT OR UPDATE ON public.accessories
  FOR EACH ROW EXECUTE FUNCTION calculate_accessory_net_price();

CREATE TRIGGER trigger_calculate_linear_materials_price_per_m
  BEFORE INSERT OR UPDATE ON public.linear_materials
  FOR EACH ROW EXECUTE FUNCTION calculate_linear_materials_price_per_m();

CREATE TRIGGER trigger_calculate_materials_price_per_sqm
  BEFORE INSERT OR UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION calculate_materials_price_per_sqm();

-- Payment status triggers
CREATE TRIGGER trigger_update_payment_status_insert
  AFTER INSERT ON public.quote_payments
  FOR EACH ROW EXECUTE FUNCTION update_quote_payment_status();

CREATE TRIGGER trigger_update_payment_status_update
  AFTER UPDATE ON public.quote_payments
  FOR EACH ROW EXECUTE FUNCTION update_quote_payment_status();

CREATE TRIGGER trigger_update_payment_status_delete
  AFTER DELETE ON public.quote_payments
  FOR EACH ROW EXECUTE FUNCTION update_quote_payment_status();

-- Shop order status triggers
CREATE TRIGGER trigger_update_shop_order_status
  AFTER INSERT OR UPDATE OR DELETE ON public.shop_order_items
  FOR EACH ROW EXECUTE FUNCTION update_shop_order_status();

-- Permission triggers
CREATE TRIGGER on_public_page_created_or_activated
  AFTER INSERT OR UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION handle_new_page_permissions();

-- Updated_at triggers
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON public.currencies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vat_updated_at BEFORE UPDATE ON public.vat FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_company_updated_at BEFORE UPDATE ON public.tenant_company FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sms_settings_updated_at BEFORE UPDATE ON public.sms_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_linear_materials_updated_at BEFORE UPDATE ON public.linear_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_material_settings_updated_at BEFORE UPDATE ON public.material_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_material_group_settings_updated_at BEFORE UPDATE ON public.material_group_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_machine_linear_material_map_updated_at BEFORE UPDATE ON public.machine_linear_material_map FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accessories_updated_at BEFORE UPDATE ON public.accessories FOR EACH ROW EXECUTE FUNCTION update_accessories_updated_at();
CREATE TRIGGER update_feetypes_updated_at BEFORE UPDATE ON public.feetypes FOR EACH ROW EXECUTE FUNCTION update_feetypes_updated_at();
CREATE TRIGGER update_production_machines_updated_at BEFORE UPDATE ON public.production_machines FOR EACH ROW EXECUTE FUNCTION update_production_machines_updated_at();
CREATE TRIGGER update_quote_accessories_updated_at BEFORE UPDATE ON public.quote_accessories FOR EACH ROW EXECUTE FUNCTION update_quote_accessories_updated_at();
CREATE TRIGGER update_quote_fees_updated_at BEFORE UPDATE ON public.quote_fees FOR EACH ROW EXECUTE FUNCTION update_quote_fees_updated_at();
CREATE TRIGGER media_files_updated_at BEFORE UPDATE ON public.media_files FOR EACH ROW EXECUTE FUNCTION update_media_files_updated_at();
CREATE TRIGGER update_cutting_fees_updated_at BEFORE UPDATE ON public.cutting_fees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 7.5: VIEWS
-- =============================================================================

-- Material Effective Settings View (base view)
CREATE OR REPLACE VIEW public.material_effective_settings AS
SELECT 
  m.id AS material_id,
  COALESCE(ms.kerf_mm, mgs.kerf_mm, 3) AS kerf_mm,
  COALESCE(ms.trim_top_mm, mgs.trim_top_mm, 0) AS trim_top_mm,
  COALESCE(ms.trim_right_mm, mgs.trim_right_mm, 0) AS trim_right_mm,
  COALESCE(ms.trim_bottom_mm, mgs.trim_bottom_mm, 0) AS trim_bottom_mm,
  COALESCE(ms.trim_left_mm, mgs.trim_left_mm, 0) AS trim_left_mm,
  COALESCE(ms.rotatable, mgs.rotatable, true) AS rotatable,
  COALESCE(ms.waste_multi, mgs.waste_multi, 1.0::double precision) AS waste_multi,
  COALESCE(ms.usage_limit, 0.65) AS usage_limit,
  m.grain_direction
FROM materials m
LEFT JOIN material_settings ms ON m.id = ms.material_id
LEFT JOIN material_groups mg ON m.group_id = mg.id
LEFT JOIN material_group_settings mgs ON mg.id = mgs.group_id
WHERE m.deleted_at IS NULL;

-- Materials With Settings View (depends on material_effective_settings)
CREATE OR REPLACE VIEW public.materials_with_settings AS
SELECT 
  m.id,
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
FROM materials m
JOIN brands b ON m.brand_id = b.id
JOIN material_effective_settings mes ON m.id = mes.material_id
WHERE m.deleted_at IS NULL;

-- =============================================================================
-- SECTION 8: INDEXES
-- =============================================================================

-- Soft delete indexes (for WHERE deleted_at IS NULL queries)
CREATE INDEX IF NOT EXISTS idx_brands_deleted_at ON public.brands(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_currencies_deleted_at ON public.currencies(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vat_deleted_at ON public.vat(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_units_deleted_at ON public.units(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_company_deleted_at ON public.tenant_company(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workers_deleted_at ON public.workers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_production_machines_deleted_at ON public.production_machines(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_methods_deleted_at ON public.payment_methods(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_partners_deleted_at ON public.partners(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_feetypes_deleted_at ON public.feetypes(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_edge_materials_deleted_at ON public.edge_materials(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_materials_deleted_at ON public.materials(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_linear_materials_deleted_at ON public.linear_materials(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_accessories_deleted_at ON public.accessories(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shop_orders_deleted_at ON public.shop_orders(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON public.quotes(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shop_order_items_deleted_at ON public.shop_order_items(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_accessories_deleted_at ON public.quote_accessories(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_fees_deleted_at ON public.quote_fees(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_payments_deleted_at ON public.quote_payments(deleted_at) WHERE deleted_at IS NULL;

-- Performance indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_materials_brand_id ON public.materials(brand_id);
CREATE INDEX IF NOT EXISTS idx_materials_group_id ON public.materials(group_id);
CREATE INDEX IF NOT EXISTS idx_materials_currency_id ON public.materials(currency_id);
CREATE INDEX IF NOT EXISTS idx_materials_vat_id ON public.materials(vat_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON public.quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON public.quotes(created_by);
CREATE INDEX IF NOT EXISTS idx_quote_panels_quote_id ON public.quote_panels(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_panels_material_id ON public.quote_panels(material_id);
CREATE INDEX IF NOT EXISTS idx_quote_materials_pricing_quote_id ON public.quote_materials_pricing(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_accessories_quote_id ON public.quote_accessories(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_fees_quote_id ON public.quote_fees(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_payments_quote_id ON public.quote_payments(quote_id);

-- Unique indexes for soft delete (active records only)
CREATE UNIQUE INDEX IF NOT EXISTS customers_name_unique_active ON public.customers (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS brands_name_unique_active ON public.brands (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS currencies_name_unique_active ON public.currencies (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vat_name_unique_active ON public.vat (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS units_name_unique_active ON public.units (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tenant_company_name_unique_active ON public.tenant_company (name) WHERE deleted_at IS NULL;

-- =============================================================================
-- SECTION 9: SAMPLE DATA
-- =============================================================================

-- Insert sample VAT rates
INSERT INTO public.vat (name, kulcs) VALUES 
    ('27% ÁFA', 27.0),
    ('18% ÁFA', 18.0),
    ('5% ÁFA', 5.0),
    ('0% ÁFA', 0.0)
ON CONFLICT DO NOTHING;

-- Insert sample currencies
INSERT INTO public.currencies (name, rate) VALUES 
    ('HUF', 1.0),
    ('EUR', 400.0),
    ('USD', 350.0)
ON CONFLICT DO NOTHING;

-- Insert sample units
INSERT INTO public.units (name, shortform) VALUES 
    ('darab', 'db'),
    ('méter', 'm'),
    ('négyzetméter', 'm²'),
    ('köbméter', 'm³'),
    ('kilogramm', 'kg'),
    ('liter', 'l')
ON CONFLICT DO NOTHING;

-- Insert sample brands
INSERT INTO public.brands (name, comment) VALUES 
    ('Egger', 'High quality Austrian brand'),
    ('Kronospan', 'Leading European manufacturer'),
    ('Kaindl', 'Austrian wood-based materials')
ON CONFLICT DO NOTHING;

-- Insert sample payment methods
INSERT INTO public.payment_methods (name, comment) VALUES 
    ('Készpénz', 'Készpénzes fizetés'),
    ('Átutalás', 'Banki átutalás'),
    ('Bankkártya', 'Bankkártyás fizetés')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SECTION 10: PERMISSIONS
-- =============================================================================

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =============================================================================
-- SETUP COMPLETE
-- =============================================================================

-- You can now start using your Turinova ERP database!
-- Next steps:
-- 1. Add your company information to tenant_company table
-- 2. Add customers to customers table
-- 3. Add materials to materials table
-- 4. Start creating quotes!
--
-- Note: This template includes all necessary sequences, functions, triggers,
-- views, and indexes from the production database.
