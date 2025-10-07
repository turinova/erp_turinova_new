-- =====================================================================
-- QUOTE SYSTEM TABLES - Create missing tables for quote pricing
-- Run this directly in Supabase SQL Editor
-- =====================================================================

-- Create quote_materials_pricing table
CREATE TABLE IF NOT EXISTS public.quote_materials_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  
  -- Material snapshots (at time of quote)
  material_name VARCHAR(255) NOT NULL,
  board_width_mm INTEGER NOT NULL,
  board_length_mm INTEGER NOT NULL,
  thickness_mm INTEGER NOT NULL,
  grain_direction BOOLEAN NOT NULL,
  
  -- Stock & optimization results
  on_stock BOOLEAN NOT NULL,
  boards_used INTEGER NOT NULL,
  usage_percentage NUMERIC(5,2) NOT NULL,
  pricing_method VARCHAR(20) NOT NULL, -- 'panel_area' or 'full_board'
  charged_sqm NUMERIC(10,4) NULL, -- ONLY for on_stock=true with panel_area pricing
  
  -- Pricing snapshots (at time of quote)
  price_per_sqm NUMERIC(10,2) NOT NULL,
  vat_rate NUMERIC(5,4) NOT NULL, -- e.g., 0.27 for 27%
  currency VARCHAR(10) NOT NULL, -- e.g., 'HUF'
  usage_limit NUMERIC(5,4) NOT NULL, -- e.g., 0.65
  waste_multi NUMERIC(5,2) NOT NULL, -- e.g., 1.2
  
  -- Material cost breakdown
  material_net NUMERIC(12,2) NOT NULL,
  material_vat NUMERIC(12,2) NOT NULL,
  material_gross NUMERIC(12,2) NOT NULL,
  
  -- Edge materials cost breakdown
  edge_materials_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  edge_materials_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  edge_materials_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Cutting cost breakdown
  cutting_length_m NUMERIC(10,2) NOT NULL,
  cutting_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  cutting_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  cutting_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Services cost breakdown
  services_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  services_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  services_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Total for this material
  total_net NUMERIC(12,2) NOT NULL,
  total_vat NUMERIC(12,2) NOT NULL,
  total_gross NUMERIC(12,2) NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quote_materials_pricing_quote_id 
  ON public.quote_materials_pricing(quote_id);

CREATE INDEX IF NOT EXISTS idx_quote_materials_pricing_material_id 
  ON public.quote_materials_pricing(material_id);

-- Create quote_edge_materials_breakdown table
CREATE TABLE IF NOT EXISTS public.quote_edge_materials_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_materials_pricing_id UUID NOT NULL REFERENCES public.quote_materials_pricing(id) ON DELETE CASCADE,
  edge_material_id UUID NOT NULL REFERENCES public.edge_materials(id) ON DELETE RESTRICT,
  
  -- Edge material snapshot
  edge_material_name VARCHAR(255) NOT NULL,
  
  -- Calculation details
  total_length_m NUMERIC(10,2) NOT NULL,
  price_per_m NUMERIC(10,2) NOT NULL, -- snapshot
  
  -- Cost breakdown
  net_price NUMERIC(12,2) NOT NULL,
  vat_amount NUMERIC(12,2) NOT NULL,
  gross_price NUMERIC(12,2) NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quote_edge_materials_breakdown_pricing_id 
  ON public.quote_edge_materials_breakdown(quote_materials_pricing_id);

CREATE INDEX IF NOT EXISTS idx_quote_edge_materials_breakdown_edge_material_id 
  ON public.quote_edge_materials_breakdown(edge_material_id);

-- Create quote_services_breakdown table
CREATE TABLE IF NOT EXISTS public.quote_services_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_materials_pricing_id UUID NOT NULL REFERENCES public.quote_materials_pricing(id) ON DELETE CASCADE,
  
  -- Service details
  service_type VARCHAR(50) NOT NULL, -- 'panthelyfuras', 'duplungolas', 'szogvagas'
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  
  -- Cost breakdown
  net_price NUMERIC(12,2) NOT NULL,
  vat_amount NUMERIC(12,2) NOT NULL,
  gross_price NUMERIC(12,2) NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quote_services_breakdown_pricing_id 
  ON public.quote_services_breakdown(quote_materials_pricing_id);

CREATE INDEX IF NOT EXISTS idx_quote_services_breakdown_service_type 
  ON public.quote_services_breakdown(service_type);
