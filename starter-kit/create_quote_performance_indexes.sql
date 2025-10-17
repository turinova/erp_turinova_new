-- =====================================================================
-- QUOTE SYSTEM PERFORMANCE INDEXES
-- Date: January 27, 2025
-- Purpose: Optimize quote detail page loading performance
-- Based on Supabase Performance Advisor recommendations
-- Run this manually in Supabase SQL Editor
-- =====================================================================

-- =====================================================================
-- CRITICAL: Quote System Indexes (High Impact)
-- =====================================================================

-- Index for quote_panels lookup by quote_id (ALREADY EXISTS - marked unused)
-- CREATE INDEX IF NOT EXISTS idx_quote_panels_quote_id 
--   ON quote_panels(quote_id) 
--   WHERE deleted_at IS NULL;

-- Index for quote_materials_pricing lookup by quote_id
CREATE INDEX IF NOT EXISTS idx_quote_materials_pricing_quote_id 
  ON quote_materials_pricing(quote_id);

-- Index for quote_fees lookup by quote_id (ALREADY EXISTS - marked unused)
-- Will become used after query optimization
-- CREATE INDEX IF NOT EXISTS idx_quote_fees_quote_id 
--   ON quote_fees(quote_id) 
--   WHERE deleted_at IS NULL;

-- Index for quote_accessories lookup by quote_id (ALREADY EXISTS - marked unused)
-- Will become used after query optimization
-- CREATE INDEX IF NOT EXISTS idx_quote_accessories_quote_id 
--   ON quote_accessories(quote_id) 
--   WHERE deleted_at IS NULL;

-- Index for quote_edge_materials_breakdown (joined frequently)
CREATE INDEX IF NOT EXISTS idx_quote_edge_materials_breakdown_pricing_id 
  ON quote_edge_materials_breakdown(quote_materials_pricing_id);

-- Index for quote_services_breakdown (joined frequently)
CREATE INDEX IF NOT EXISTS idx_quote_services_breakdown_pricing_id 
  ON quote_services_breakdown(quote_materials_pricing_id);

-- =====================================================================
-- FOREIGN KEY INDEXES (Supabase Advisor Recommendations)
-- =====================================================================

-- Accessories table foreign keys
CREATE INDEX IF NOT EXISTS idx_accessories_currency_id ON accessories(currency_id);
CREATE INDEX IF NOT EXISTS idx_accessories_partners_id ON accessories(partners_id);
CREATE INDEX IF NOT EXISTS idx_accessories_units_id ON accessories(units_id);
CREATE INDEX IF NOT EXISTS idx_accessories_vat_id ON accessories(vat_id);

-- Cutting fees foreign keys
CREATE INDEX IF NOT EXISTS idx_cutting_fees_currency_id ON cutting_fees(currency_id);
CREATE INDEX IF NOT EXISTS idx_cutting_fees_vat_id ON cutting_fees(vat_id);

-- Fee types foreign keys
CREATE INDEX IF NOT EXISTS idx_feetypes_currency_id ON feetypes(currency_id);
CREATE INDEX IF NOT EXISTS idx_feetypes_vat_id ON feetypes(vat_id);

-- Materials table foreign keys
CREATE INDEX IF NOT EXISTS idx_materials_brand_id ON materials(brand_id);
CREATE INDEX IF NOT EXISTS idx_materials_group_id ON materials(group_id);

-- Quote accessories foreign keys
CREATE INDEX IF NOT EXISTS idx_quote_accessories_currency_id ON quote_accessories(currency_id);
CREATE INDEX IF NOT EXISTS idx_quote_accessories_unit_id ON quote_accessories(unit_id);

-- Quote fees foreign keys
CREATE INDEX IF NOT EXISTS idx_quote_fees_currency_id ON quote_fees(currency_id);

-- Quote panels edge material foreign keys (CRITICAL for Excel export)
CREATE INDEX IF NOT EXISTS idx_quote_panels_edge_material_a_id ON quote_panels(edge_material_a_id);
CREATE INDEX IF NOT EXISTS idx_quote_panels_edge_material_b_id ON quote_panels(edge_material_b_id);
CREATE INDEX IF NOT EXISTS idx_quote_panels_edge_material_c_id ON quote_panels(edge_material_c_id);
CREATE INDEX IF NOT EXISTS idx_quote_panels_edge_material_d_id ON quote_panels(edge_material_d_id);

-- Quote panels material foreign key
CREATE INDEX IF NOT EXISTS idx_quote_panels_material_id ON quote_panels(material_id);

-- Analyze tables to update statistics
ANALYZE quote_panels;
ANALYZE quote_materials_pricing;
ANALYZE quote_fees;
ANALYZE quote_accessories;
ANALYZE quote_edge_materials_breakdown;
ANALYZE quote_services_breakdown;
ANALYZE quotes;

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'quote_panels',
    'quote_materials_pricing',
    'quote_fees',
    'quote_accessories',
    'quote_edge_materials_breakdown',
    'quote_services_breakdown',
    'quotes'
  )
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

