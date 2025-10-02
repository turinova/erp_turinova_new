-- Create Linear Materials System
-- Date: October 2, 2025
-- Purpose: Manage linear materials with pricing, machine codes, and price history

-- =====================================================
-- 1. CREATE linear_materials TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.linear_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  width DECIMAL(10,2) NOT NULL,           -- Cross-section width (typically 600mm)
  length DECIMAL(10,2) NOT NULL,          -- Available length (typically 4100mm)
  thickness DECIMAL(10,2) NOT NULL,       -- Cross-section thickness (typically 36mm)
  type TEXT NOT NULL,                     -- Material type description
  image_url TEXT,
  price_per_m DECIMAL(10,2) NOT NULL DEFAULT 0,  -- Price per meter
  currency_id UUID REFERENCES currencies(id) ON DELETE RESTRICT,
  vat_id UUID REFERENCES vat(id) ON DELETE RESTRICT,
  on_stock BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- =====================================================
-- 2. CREATE machine_linear_material_map TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.machine_linear_material_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_material_id UUID NOT NULL REFERENCES linear_materials(id) ON DELETE CASCADE,
  machine_type TEXT NOT NULL DEFAULT 'Korpus',
  machine_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(linear_material_id, machine_type),
  UNIQUE(machine_code) -- Machine code must be globally unique
);

-- =====================================================
-- 3. CREATE linear_material_price_history TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.linear_material_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_material_id UUID NOT NULL REFERENCES linear_materials(id) ON DELETE CASCADE,
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2) NOT NULL,
  old_currency_id UUID REFERENCES currencies(id),
  new_currency_id UUID REFERENCES currencies(id),
  old_vat_id UUID REFERENCES vat(id),
  new_vat_id UUID REFERENCES vat(id),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 4. CREATE INDEXES
-- =====================================================

-- linear_materials indexes
CREATE INDEX IF NOT EXISTS idx_linear_materials_brand_id ON public.linear_materials(brand_id);
CREATE INDEX IF NOT EXISTS idx_linear_materials_currency_id ON public.linear_materials(currency_id);
CREATE INDEX IF NOT EXISTS idx_linear_materials_vat_id ON public.linear_materials(vat_id);
CREATE INDEX IF NOT EXISTS idx_linear_materials_active ON public.linear_materials(active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_linear_materials_on_stock ON public.linear_materials(on_stock) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_linear_materials_deleted_at ON public.linear_materials(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_linear_materials_name ON public.linear_materials(name) WHERE deleted_at IS NULL;

-- machine_linear_material_map indexes
CREATE INDEX IF NOT EXISTS idx_machine_linear_material_map_linear_id ON public.machine_linear_material_map(linear_material_id);
CREATE INDEX IF NOT EXISTS idx_machine_linear_material_map_code ON public.machine_linear_material_map(machine_code);

-- linear_material_price_history indexes
CREATE INDEX IF NOT EXISTS idx_linear_price_history_material_id ON public.linear_material_price_history(linear_material_id);
CREATE INDEX IF NOT EXISTS idx_linear_price_history_changed_at ON public.linear_material_price_history(changed_at DESC);

-- =====================================================
-- 5. CREATE TRIGGERS
-- =====================================================

-- Trigger to update updated_at on linear_materials
CREATE TRIGGER update_linear_materials_updated_at
  BEFORE UPDATE ON public.linear_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on machine_linear_material_map
CREATE TRIGGER update_machine_linear_material_map_updated_at
  BEFORE UPDATE ON public.machine_linear_material_map
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. SET PERMISSIONS
-- =====================================================

-- linear_materials permissions
ALTER TABLE public.linear_materials OWNER TO postgres;
GRANT ALL ON TABLE public.linear_materials TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.linear_materials TO authenticated;
GRANT SELECT ON TABLE public.linear_materials TO anon;

-- machine_linear_material_map permissions
ALTER TABLE public.machine_linear_material_map OWNER TO postgres;
GRANT ALL ON TABLE public.machine_linear_material_map TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.machine_linear_material_map TO authenticated;
GRANT SELECT ON TABLE public.machine_linear_material_map TO anon;

-- linear_material_price_history permissions
ALTER TABLE public.linear_material_price_history OWNER TO postgres;
GRANT ALL ON TABLE public.linear_material_price_history TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.linear_material_price_history TO authenticated;
GRANT SELECT ON TABLE public.linear_material_price_history TO anon;

-- =====================================================
-- 7. VERIFICATION QUERIES
-- =====================================================

-- Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%linear_material%'
ORDER BY table_name;

-- Check columns in linear_materials
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'linear_materials'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename LIKE '%linear_material%'
ORDER BY tablename, indexname;

