-- Allow negative values in feetypes table for adjustments/discounts
-- DECIMAL already supports negative values, this is just documentation

COMMENT ON COLUMN public.feetypes.net_price IS 'Net price (can be negative for discounts/adjustments)';

-- Example fee types with negative values:
-- INSERT INTO public.feetypes (name, net_price, vat_id, currency_id)
-- VALUES ('Kedvezmény', -5000, 'vat_id_for_27%', 'currency_id_for_HUF');
-- 
-- INSERT INTO public.feetypes (name, net_price, vat_id, currency_id)
-- VALUES ('Korrekció', 0, 'vat_id_for_27%', 'currency_id_for_HUF');
-- (User can set custom price when adding to quote)

