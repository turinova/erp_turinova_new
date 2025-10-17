-- =====================================================
-- CUTTING FEES TABLE CREATION
-- =====================================================
-- This script creates the cutting_fees table for storing
-- global cutting cost configuration.
--
-- Usage: Run this script in your Supabase SQL editor
-- =====================================================

-- Create cutting_fees table
CREATE TABLE IF NOT EXISTS cutting_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_per_meter NUMERIC(10, 2) NOT NULL DEFAULT 300,
  currency_id UUID NOT NULL REFERENCES currencies(id),
  vat_id UUID NOT NULL REFERENCES vat(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE cutting_fees IS 'Global cutting fee configuration';

-- Add comments to columns
COMMENT ON COLUMN cutting_fees.fee_per_meter IS 'Fee charged per meter of cutting (default: 300 Ft/m)';
COMMENT ON COLUMN cutting_fees.currency_id IS 'Currency for cutting fee';
COMMENT ON COLUMN cutting_fees.vat_id IS 'VAT rate for cutting fee';

-- Enable RLS
ALTER TABLE cutting_fees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow all authenticated users to read cutting fees
CREATE POLICY "Allow authenticated users to read cutting fees"
  ON cutting_fees
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to update cutting fees
CREATE POLICY "Allow authenticated users to update cutting fees"
  ON cutting_fees
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to insert cutting fees
CREATE POLICY "Allow authenticated users to insert cutting fees"
  ON cutting_fees
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_cutting_fees_updated_at
  BEFORE UPDATE ON cutting_fees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default cutting fee (300 Ft/m, HUF, 27% VAT)
-- First, get the HUF currency ID and 27% VAT ID
DO $$
DECLARE
  huf_currency_id UUID;
  vat_27_id UUID;
BEGIN
  -- Get HUF currency ID (using 'name' column, not 'code')
  SELECT id INTO huf_currency_id
  FROM currencies
  WHERE name = 'HUF'
  LIMIT 1;

  -- Get 27% VAT ID
  SELECT id INTO vat_27_id
  FROM vat
  WHERE kulcs = 27
  LIMIT 1;

  -- Insert default cutting fee if IDs found
  IF huf_currency_id IS NOT NULL AND vat_27_id IS NOT NULL THEN
    INSERT INTO cutting_fees (fee_per_meter, currency_id, vat_id)
    VALUES (300, huf_currency_id, vat_27_id)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Default cutting fee created successfully';
  ELSE
    RAISE WARNING 'Could not find HUF currency or 27%% VAT - please insert cutting fee manually';
  END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify the setup:

-- Check if table was created
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'cutting_fees';

-- Check inserted default data
SELECT 
  cf.id,
  cf.fee_per_meter,
  c.name as currency,
  v.kulcs as vat_rate,
  cf.created_at,
  cf.updated_at
FROM cutting_fees cf
LEFT JOIN currencies c ON cf.currency_id = c.id
LEFT JOIN vat v ON cf.vat_id = v.id;

-- =====================================================
-- NOTES
-- =====================================================
-- 1. Only one row should exist in this table (enforced by application logic)
-- 2. Default fee: 300 Ft/m with HUF currency and 27% VAT
-- 3. All authenticated users can read and update the cutting fee
-- 4. Settings page for editing will be implemented later
-- =====================================================

