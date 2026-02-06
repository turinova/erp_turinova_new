-- Add gross price columns to worktop_config_fees table
-- This allows us to store the gross prices that users enter directly,
-- avoiding rounding errors when converting between gross and net

ALTER TABLE public.worktop_config_fees
  ADD COLUMN IF NOT EXISTS kereszt_vagas_fee_gross numeric(10, 2),
  ADD COLUMN IF NOT EXISTS hosszanti_vagas_fee_per_meter_gross numeric(10, 2),
  ADD COLUMN IF NOT EXISTS ives_vagas_fee_gross numeric(10, 2),
  ADD COLUMN IF NOT EXISTS szogvagas_fee_gross numeric(10, 2),
  ADD COLUMN IF NOT EXISTS kivagas_fee_gross numeric(10, 2),
  ADD COLUMN IF NOT EXISTS elzaro_fee_per_meter_gross numeric(10, 2),
  ADD COLUMN IF NOT EXISTS osszemaras_fee_gross numeric(10, 2);

-- Calculate initial gross values from existing net values (if any exist)
-- This is a one-time migration for existing data
UPDATE public.worktop_config_fees
SET
  kereszt_vagas_fee_gross = ROUND(kereszt_vagas_fee * (1 + (SELECT kulcs FROM vat WHERE id = worktop_config_fees.vat_id) / 100.0)),
  hosszanti_vagas_fee_per_meter_gross = ROUND(hosszanti_vagas_fee_per_meter * (1 + (SELECT kulcs FROM vat WHERE id = worktop_config_fees.vat_id) / 100.0)),
  ives_vagas_fee_gross = ROUND(ives_vagas_fee * (1 + (SELECT kulcs FROM vat WHERE id = worktop_config_fees.vat_id) / 100.0)),
  szogvagas_fee_gross = ROUND(szogvagas_fee * (1 + (SELECT kulcs FROM vat WHERE id = worktop_config_fees.vat_id) / 100.0)),
  kivagas_fee_gross = ROUND(kivagas_fee * (1 + (SELECT kulcs FROM vat WHERE id = worktop_config_fees.vat_id) / 100.0)),
  elzaro_fee_per_meter_gross = ROUND(elzaro_fee_per_meter * (1 + (SELECT kulcs FROM vat WHERE id = worktop_config_fees.vat_id) / 100.0)),
  osszemaras_fee_gross = ROUND(osszemaras_fee * (1 + (SELECT kulcs FROM vat WHERE id = worktop_config_fees.vat_id) / 100.0))
WHERE kereszt_vagas_fee_gross IS NULL;
