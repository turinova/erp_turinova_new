-- Nettfront front SKU katalógus (Inomat + későbbi típusok)
-- Manuálisan futtatható a tenant DB-n.
-- Árak: nettó Ft/m². ÁFA az appban fix 27%.

CREATE TABLE IF NOT EXISTS public.nettfront_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  front_type text NOT NULL
    CHECK (front_type IN ('inomat', 'festett', 'folias', 'alu', 'akril')),
  sku_code text NOT NULL,
  display_name text NOT NULL,
  finish text
    CHECK (finish IS NULL OR finish IN ('matt', 'hg')),
  swatch_hex text,
  cost_net_per_sqm numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (cost_net_per_sqm >= 0),
  sell_net_per_sqm numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (sell_net_per_sqm >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nettfront_skus_front_type_sku_code_key UNIQUE (front_type, sku_code)
);

CREATE INDEX IF NOT EXISTS idx_nettfront_skus_front_type
  ON public.nettfront_skus (front_type);

CREATE INDEX IF NOT EXISTS idx_nettfront_skus_active
  ON public.nettfront_skus (is_active)
  WHERE is_active = true;

-- updated_at trigger (ha létezik a közös függvény)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_nettfront_skus_updated_at ON public.nettfront_skus;
    CREATE TRIGGER update_nettfront_skus_updated_at
      BEFORE UPDATE ON public.nettfront_skus
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Seed: Inomat színek — ideiglenes árak (bekerülés 25 000 / eladás 35 000 nettó Ft/m²)
INSERT INTO public.nettfront_skus (
  front_type, sku_code, display_name, finish, swatch_hex,
  cost_net_per_sqm, sell_net_per_sqm, is_active, sort_order
) VALUES
  -- Matt
  ('inomat', 'bronze',              'Bronze',            'matt', '#8B6914', 25000, 35000, true, 10),
  ('inomat', 'cedar-green',         'Cedar Green',       'matt', '#5C6B4F', 25000, 35000, true, 20),
  ('inomat', 'dune-beige',          'Dune Beige',        'matt', '#C4B59A', 25000, 35000, true, 30),
  ('inomat', 'ivory-white',         'Ivory White',       'matt', '#F5F0E6', 25000, 35000, true, 40),
  ('inomat', 'lava-black',          'Lava Black',        'matt', '#2A2A2A', 25000, 35000, true, 50),
  ('inomat', 'midnight-blue',       'Midnight Blue',     'matt', '#1E3A5F', 25000, 35000, true, 60),
  ('inomat', 'mist-grey',           'Mist Grey',         'matt', '#B8B8B8', 25000, 35000, true, 70),
  ('inomat', 'palo-santo-beige',    'Palo Santo Beige',  'matt', '#D4C4A8', 25000, 35000, true, 80),
  -- High Gloss (Fényes)
  ('inomat', 'pearl',               'Pearl',             'hg',   '#E8E4DC', 25000, 35000, true, 110),
  ('inomat', 'pure-white',          'Pure White',        'hg',   '#FAFAFA', 25000, 35000, true, 120),
  ('inomat', 'storm-grey',          'Storm Grey',        'hg',   '#7A7A7A', 25000, 35000, true, 130),
  ('inomat', 'gold',                'Gold',              'hg',   '#C9A227', 25000, 35000, true, 140),
  ('inomat', 'hg-dune-beige',       'Hg Dune Beige',     'hg',   '#D8C9AE', 25000, 35000, true, 150),
  ('inomat', 'hg-ivory-white',      'Hg Ivory White',    'hg',   '#F8F4EA', 25000, 35000, true, 160),
  ('inomat', 'hg-palo-santo-beige', 'Hg Palo Santo Beige','hg',  '#E0D0B4', 25000, 35000, true, 170),
  ('inomat', 'hg-pure-white',       'Hg Pure White',     'hg',   '#FFFFFF', 25000, 35000, true, 180)
ON CONFLICT (front_type, sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  finish = EXCLUDED.finish,
  swatch_hex = EXCLUDED.swatch_hex,
  cost_net_per_sqm = EXCLUDED.cost_net_per_sqm,
  sell_net_per_sqm = EXCLUDED.sell_net_per_sqm,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
