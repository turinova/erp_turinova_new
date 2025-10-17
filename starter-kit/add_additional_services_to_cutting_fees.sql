-- =====================================================
-- ADD ADDITIONAL SERVICES TO CUTTING FEES TABLE
-- =====================================================
-- This script adds Pánthelyfúrás, Duplungolás, and Szögvágás
-- pricing fields to the cutting_fees table.
--
-- Usage: Run this script in your Supabase SQL editor
-- =====================================================

-- Add new service fee columns
ALTER TABLE cutting_fees 
  ADD COLUMN IF NOT EXISTS panthelyfuras_fee_per_hole NUMERIC(10, 2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS duplungolas_fee_per_sqm NUMERIC(10, 2) DEFAULT 200,
  ADD COLUMN IF NOT EXISTS szogvagas_fee_per_panel NUMERIC(10, 2) DEFAULT 100;

-- Add comments to new columns
COMMENT ON COLUMN cutting_fees.panthelyfuras_fee_per_hole IS 'Fee charged per hinge hole (default: 50 Ft/hole)';
COMMENT ON COLUMN cutting_fees.duplungolas_fee_per_sqm IS 'Fee charged per square meter for groove cutting (default: 200 Ft/m²)';
COMMENT ON COLUMN cutting_fees.szogvagas_fee_per_panel IS 'Fee charged per panel for angle cutting (default: 100 Ft/panel)';

-- Update existing row with default values (if exists)
UPDATE cutting_fees
SET 
  panthelyfuras_fee_per_hole = COALESCE(panthelyfuras_fee_per_hole, 50),
  duplungolas_fee_per_sqm = COALESCE(duplungolas_fee_per_sqm, 200),
  szogvagas_fee_per_panel = COALESCE(szogvagas_fee_per_panel, 100),
  updated_at = NOW()
WHERE id IS NOT NULL;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify the setup:

-- Check if columns were added
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cutting_fees'
  AND column_name IN ('panthelyfuras_fee_per_hole', 'duplungolas_fee_per_sqm', 'szogvagas_fee_per_panel');

-- Check updated data
SELECT 
  cf.id,
  cf.fee_per_meter as cutting_fee_per_m,
  cf.panthelyfuras_fee_per_hole,
  cf.duplungolas_fee_per_sqm,
  cf.szogvagas_fee_per_panel,
  c.name as currency,
  v.kulcs as vat_rate,
  cf.updated_at
FROM cutting_fees cf
LEFT JOIN currencies c ON cf.currency_id = c.id
LEFT JOIN vat v ON cf.vat_id = v.id;

-- =====================================================
-- NOTES
-- =====================================================
-- 1. All services use the same currency and VAT as cutting fee
-- 2. Pánthelyfúrás: 50 Ft per hole
-- 3. Duplungolás: 200 Ft per m²
-- 4. Szögvágás: 100 Ft per panel
-- 5. All fees can be edited later via settings page (future development)
-- =====================================================

