-- =============================================================================
-- Allow same platform_shipping_code for different methods (e.g. WSESHIP for
-- "Személyes átvétel" vs "Kumifutar"). Uniqueness is (connection_id, code, name).
-- =============================================================================

-- Drop old unique so we can have multiple rows per (connection_id, platform_shipping_code)
ALTER TABLE public.connection_shipping_method_mappings
  DROP CONSTRAINT IF EXISTS connection_shipping_method_mappings_connection_id_platform_shipping_code_key;

-- One row per (connection_id, platform_shipping_code, name); one per (connection_id, code) when name is null/empty
CREATE UNIQUE INDEX idx_connection_shipping_mappings_connection_code_name
  ON public.connection_shipping_method_mappings (connection_id, platform_shipping_code, COALESCE(platform_shipping_name, ''));

COMMENT ON INDEX idx_connection_shipping_mappings_connection_code_name IS
  'Allows same platform code for different methods (e.g. WSESHIP + different names). Lookup by code+name when both present.';
