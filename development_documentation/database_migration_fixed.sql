-- ====== PREP ======
-- Enable UUID generation if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====== CLEANUP EXISTING TABLES ======
-- Drop existing tables in correct order to avoid foreign key constraints
DROP TABLE IF EXISTS material_audit CASCADE;
DROP TABLE IF EXISTS material_settings CASCADE;
DROP TABLE IF EXISTS material_group_settings CASCADE;
DROP TABLE IF EXISTS machine_material_map CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS material_groups CASCADE;
DROP TABLE IF EXISTS brands CASCADE;

-- Drop existing views
DROP VIEW IF EXISTS material_effective_settings CASCADE;
DROP VIEW IF EXISTS materials_with_settings CASCADE;

-- ====== TABLES ======

-- 1) Brands (unique by name)
CREATE TABLE IF NOT EXISTS brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2) Material Groups (optional grouping for shared rules later)
CREATE TABLE IF NOT EXISTS material_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3) Materials (one row per board SKU/variant)
CREATE TABLE IF NOT EXISTS materials (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         uuid NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  group_id         uuid REFERENCES material_groups(id) ON DELETE SET NULL,
  name             text NOT NULL,
  length_mm        int  NOT NULL CHECK (length_mm > 0),
  width_mm         int  NOT NULL CHECK (width_mm > 0),
  thickness_mm     int  NOT NULL CHECK (thickness_mm > 0),
  grain_direction  boolean NOT NULL DEFAULT false, -- true = has grain
  image_url        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

-- helpful uniqueness: same brand + same exact board & size shouldn't duplicate
CREATE UNIQUE INDEX IF NOT EXISTS ux_material_identity
ON materials (brand_id, name, length_mm, width_mm, thickness_mm);

CREATE INDEX IF NOT EXISTS ix_materials_name ON materials(name);

-- 4) Machine mapping (material → machine-specific code)
CREATE TABLE IF NOT EXISTS machine_material_map (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id   uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  machine_type  text NOT NULL,      -- e.g. 'GABBIANI_SIGMA', 'HOMAG', 'SCM'
  machine_code  text NOT NULL,      -- code expected by that machine
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(material_id, machine_type)
);

-- 5) Group-level default optimizer settings
CREATE TABLE IF NOT EXISTS material_group_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      uuid UNIQUE NOT NULL REFERENCES material_groups(id) ON DELETE CASCADE,
  kerf_mm       int  NOT NULL DEFAULT 3 CHECK (kerf_mm >= 0),
  trim_top_mm   int  NOT NULL DEFAULT 0 CHECK (trim_top_mm >= 0),
  trim_right_mm int  NOT NULL DEFAULT 0 CHECK (trim_right_mm >= 0),
  trim_bottom_mm int NOT NULL DEFAULT 0 CHECK (trim_bottom_mm >= 0),
  trim_left_mm  int  NOT NULL DEFAULT 0 CHECK (trim_left_mm >= 0),
  rotatable     boolean NOT NULL DEFAULT true,
  waste_multi   double precision NOT NULL DEFAULT 1.0 CHECK (waste_multi > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 6) Material-level overrides (nullable → inherit from group)
CREATE TABLE IF NOT EXISTS material_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id   uuid UNIQUE NOT NULL REFERENCES materials(id) ON DELETE CASCADE,

  kerf_mm       int,                   -- NULL → inherit from group
  trim_top_mm   int,
  trim_right_mm int,
  trim_bottom_mm int,
  trim_left_mm  int,
  rotatable     boolean,
  waste_multi   double precision,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CHECK (kerf_mm       IS NULL OR kerf_mm >= 0),
  CHECK (trim_top_mm   IS NULL OR trim_top_mm >= 0),
  CHECK (trim_right_mm IS NULL OR trim_right_mm >= 0),
  CHECK (trim_bottom_mm IS NULL OR trim_bottom_mm >= 0),
  CHECK (trim_left_mm  IS NULL OR trim_left_mm >= 0),
  CHECK (waste_multi   IS NULL OR waste_multi > 0)
);

-- 7) Audit log (append-only)
CREATE TABLE IF NOT EXISTS material_audit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   text NOT NULL,           -- 'materials' | 'material_settings' | 'material_group_settings'
  row_id       uuid NOT NULL,
  action       text NOT NULL,           -- INSERT | UPDATE | DELETE
  actor        text,                    -- optional: set via app/session
  before_data  jsonb,
  after_data   jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_material_audit_lookup
  ON material_audit(table_name, row_id, created_at);

-- ====== TRIGGERS: updated_at + audit ======

-- updated_at helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- Create triggers for updated_at
CREATE TRIGGER trg_materials_updated_at
BEFORE UPDATE ON materials
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_material_settings_updated_at
BEFORE UPDATE ON material_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_group_settings_updated_at
BEFORE UPDATE ON material_group_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- audit helper (reads TG_OP/TG_TABLE_NAME)
CREATE OR REPLACE FUNCTION audit_row()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  before_j jsonb;
  after_j  jsonb;
  row_uuid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    before_j := NULL;
    after_j  := to_jsonb(NEW);
    row_uuid := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    before_j := to_jsonb(OLD);
    after_j  := to_jsonb(NEW);
    row_uuid := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    before_j := to_jsonb(OLD);
    after_j  := NULL;
    row_uuid := OLD.id;
  END IF;

  INSERT INTO material_audit(table_name, row_id, action, actor, before_data, after_data)
  VALUES (TG_TABLE_NAME, row_uuid, TG_OP, NULL, before_j, after_j);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END $$;

-- Create audit triggers
CREATE TRIGGER trg_audit_materials
AFTER INSERT OR UPDATE OR DELETE ON materials
FOR EACH ROW EXECUTE FUNCTION audit_row();

CREATE TRIGGER trg_audit_material_settings
AFTER INSERT OR UPDATE OR DELETE ON material_settings
FOR EACH ROW EXECUTE FUNCTION audit_row();

CREATE TRIGGER trg_audit_group_settings
AFTER INSERT OR UPDATE OR DELETE ON material_group_settings
FOR EACH ROW EXECUTE FUNCTION audit_row();

-- ====== SAMPLE DATA (brands, groups, settings, materials, machine codes) ======

-- Brands
INSERT INTO brands(name) VALUES
  ('Egger'),
  ('Kronospan'),
  ('Fundermax'),
  ('Kaindl')
ON CONFLICT (name) DO NOTHING;

-- Material Groups
INSERT INTO material_groups(name, description) VALUES
  ('White Decors', 'Unicolors – whites'),
  ('Woodgrains',   'Wood imitation decors'),
  ('Uni Colors',   'Solid color decors'),
  ('MDF',          'Plain MDF boards')
ON CONFLICT (name) DO NOTHING;

-- Group default settings
INSERT INTO material_group_settings (group_id, kerf_mm, trim_top_mm, trim_right_mm, trim_bottom_mm, trim_left_mm, rotatable, waste_multi)
SELECT id, 3, 10, 10, 10, 10, true, 1.0 FROM material_groups WHERE name = 'White Decors'
ON CONFLICT (group_id) DO NOTHING;

INSERT INTO material_group_settings (group_id, kerf_mm, trim_top_mm, trim_right_mm, trim_bottom_mm, trim_left_mm, rotatable, waste_multi)
SELECT id, 3, 10, 10, 10, 10, false, 1.1 FROM material_groups WHERE name = 'Woodgrains'
ON CONFLICT (group_id) DO NOTHING;

INSERT INTO material_group_settings (group_id, kerf_mm, trim_top_mm, trim_right_mm, trim_bottom_mm, trim_left_mm, rotatable, waste_multi)
SELECT id, 3, 5,  5,  5,  5,  true, 1.0 FROM material_groups WHERE name = 'Uni Colors'
ON CONFLICT (group_id) DO NOTHING;

INSERT INTO material_group_settings (group_id, kerf_mm, trim_top_mm, trim_right_mm, trim_bottom_mm, trim_left_mm, rotatable, waste_multi)
SELECT id, 3, 10, 10, 10, 10, true, 1.0 FROM material_groups WHERE name = 'MDF'
ON CONFLICT (group_id) DO NOTHING;

-- 10 Materials (mix of sizes/brands/groups)
WITH b AS (
  SELECT name, id FROM brands
), g AS (
  SELECT name, id FROM material_groups
)
INSERT INTO materials (brand_id, group_id, name, length_mm, width_mm, thickness_mm, grain_direction, image_url)
VALUES
  ((SELECT id FROM b WHERE name='Egger'),      (SELECT id FROM g WHERE name='White Decors'), 'Egger H1111 ST30 White 2800x2070x18', 2800, 2070, 18, false, 'https://example.com/img/egger_h1111_18.jpg'),
  ((SELECT id FROM b WHERE name='Egger'),      (SELECT id FROM g WHERE name='Woodgrains'),   'Egger H3303 Oak 2800x2070x18',        2800, 2070, 18, true,  'https://example.com/img/egger_h3303_18.jpg'),
  ((SELECT id FROM b WHERE name='Kronospan'),  (SELECT id FROM g WHERE name='White Decors'), 'Kronospan 0101 White 2800x2070x18',   2800, 2070, 18, false, 'https://example.com/img/krono_0101_18.jpg'),
  ((SELECT id FROM b WHERE name='Kronospan'),  (SELECT id FROM g WHERE name='Uni Colors'),   'Kronospan 0190 Black 2800x2070x18',   2800, 2070, 18, false, 'https://example.com/img/krono_0190_18.jpg'),
  ((SELECT id FROM b WHERE name='Fundermax'),  (SELECT id FROM g WHERE name='Woodgrains'),   'Fundermax Walnut 4100x2070x18',       4100, 2070, 18, true,  'https://example.com/img/fmax_walnut_18.jpg'),
  ((SELECT id FROM b WHERE name='Kaindl'),     (SELECT id FROM g WHERE name='Uni Colors'),   'Kaindl Snow White 2800x2070x16',      2800, 2070, 16, false, 'https://example.com/img/kaindl_snow_16.jpg'),
  ((SELECT id FROM b WHERE name='Egger'),      (SELECT id FROM g WHERE name='MDF'),          'Egger MDF Raw 2800x2070x18',          2800, 2070, 18, false, 'https://example.com/img/egger_mdf_18.jpg'),
  ((SELECT id FROM b WHERE name='Kronospan'),  (SELECT id FROM g WHERE name='MDF'),          'Kronospan MDF Raw 2800x2070x25',      2800, 2070, 25, false, 'https://example.com/img/krono_mdf_25.jpg'),
  ((SELECT id FROM b WHERE name='Fundermax'),  (SELECT id FROM g WHERE name='White Decors'), 'Fundermax Arctic White 4100x2070x18', 4100, 2070, 18, false, 'https://example.com/img/fmax_arctic_18.jpg'),
  ((SELECT id FROM b WHERE name='Kaindl'),     (SELECT id FROM g WHERE name='Woodgrains'),   'Kaindl Oak Natural 2800x2070x18',     2800, 2070, 18, true,  'https://example.com/img/kaindl_oak_18.jpg')
ON CONFLICT DO NOTHING;

-- Material-level overrides (some NULLs to inherit from group; some explicit)
-- Example: give specific kerf/trim override to certain SKUs
INSERT INTO material_settings (material_id, kerf_mm, trim_top_mm, trim_right_mm, trim_bottom_mm, trim_left_mm, rotatable, waste_multi)
SELECT m.id, 3, 10, 10, 10, 10, true, 1.0
FROM materials m WHERE m.name = 'Egger H1111 ST30 White 2800x2070x18'
ON CONFLICT (material_id) DO NOTHING;

INSERT INTO material_settings (material_id, kerf_mm, rotatable)  -- grain true, so lock rotation
SELECT m.id, 3, false
FROM materials m WHERE m.name = 'Egger H3303 Oak 2800x2070x18'
ON CONFLICT (material_id) DO NOTHING;

INSERT INTO material_settings (material_id) -- inherit all from group defaults
SELECT m.id
FROM materials m WHERE m.name = 'Kronospan 0101 White 2800x2070x18'
ON CONFLICT (material_id) DO NOTHING;

INSERT INTO material_settings (material_id, kerf_mm, trim_top_mm, trim_right_mm, trim_bottom_mm, trim_left_mm, rotatable, waste_multi)
SELECT m.id, 3, 5, 5, 5, 5, true, 1.0
FROM materials m WHERE m.name = 'Kronospan 0190 Black 2800x2070x18'
ON CONFLICT (material_id) DO NOTHING;

INSERT INTO material_settings (material_id, kerf_mm, rotatable, waste_multi)
SELECT m.id, 3, false, 1.1
FROM materials m WHERE m.name = 'Fundermax Walnut 4100x2070x18'
ON CONFLICT (material_id) DO NOTHING;

-- Map a few materials to machine codes
WITH m AS (SELECT id, name FROM materials)
INSERT INTO machine_material_map(material_id, machine_type, machine_code)
VALUES
  ((SELECT id FROM m WHERE name='Egger H1111 ST30 White 2800x2070x18'), 'GABBIANI_SIGMA', 'EG-H1111-18-W'),
  ((SELECT id FROM m WHERE name='Egger H1111 ST30 White 2800x2070x18'), 'HOMAG',          'EG-H1111-18'),
  ((SELECT id FROM m WHERE name='Egger H3303 Oak 2800x2070x18'),        'GABBIANI_SIGMA', 'EG-H3303-18-OAK'),
  ((SELECT id FROM m WHERE name='Kronospan 0101 White 2800x2070x18'),   'SCM',            'KR-0101-18-W'),
  ((SELECT id FROM m WHERE name='Fundermax Walnut 4100x2070x18'),       'HOMAG',          'FM-WALNUT-18-41')
ON CONFLICT DO NOTHING;

-- ====== OPTIONAL VIEW: effective settings (material override → group default) ======
-- Use this to read the final values your optimizer should use.
CREATE OR REPLACE VIEW material_effective_settings AS
SELECT
  m.id               AS material_id,
  COALESCE(ms.kerf_mm,       gs.kerf_mm,       3)  AS kerf_mm,
  COALESCE(ms.trim_top_mm,   gs.trim_top_mm,   0)  AS trim_top_mm,
  COALESCE(ms.trim_right_mm, gs.trim_right_mm, 0)  AS trim_right_mm,
  COALESCE(ms.trim_bottom_mm,gs.trim_bottom_mm,0)  AS trim_bottom_mm,
  COALESCE(ms.trim_left_mm,  gs.trim_left_mm,  0)  AS trim_left_mm,
  COALESCE(ms.rotatable,     gs.rotatable,     true) AS rotatable,
  COALESCE(ms.waste_multi,   gs.waste_multi,   1.0) AS waste_multi,
  m.grain_direction
FROM materials m
LEFT JOIN material_settings ms ON ms.material_id = m.id
LEFT JOIN material_groups g    ON g.id = m.group_id
LEFT JOIN material_group_settings gs ON gs.group_id = g.id;

-- ====== VIEW: materials with settings for frontend ======
CREATE OR REPLACE VIEW materials_with_settings AS
SELECT 
  m.id,
  b.name as brand_name,
  m.name as material_name,
  m.length_mm,
  m.width_mm,
  m.thickness_mm,
  m.grain_direction,
  m.image_url,
  mes.kerf_mm,
  mes.trim_top_mm,
  mes.trim_right_mm,
  mes.trim_bottom_mm,
  mes.trim_left_mm,
  mes.rotatable,
  mes.waste_multi,
  m.created_at,
  m.updated_at
FROM materials m
JOIN brands b ON m.brand_id = b.id
JOIN material_effective_settings mes ON m.id = mes.material_id
WHERE m.deleted_at IS NULL;
