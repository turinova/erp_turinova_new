-- Shop Portal Database Setup
-- Run this SQL manually in your Supabase SQL Editor

-- Create pages table
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  can_access BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, page_id)
);

-- Create RPC function for getting user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS TABLE (
  page_path VARCHAR,
  can_access BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.path AS page_path,
    COALESCE(up.can_access, false) AS can_access
  FROM pages p
  LEFT JOIN user_permissions up ON p.id = up.page_id AND up.user_id = user_uuid
  ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert initial pages
INSERT INTO pages (path, name, category) VALUES
  ('/home', 'Kezdőlap', 'Dashboard')
ON CONFLICT (path) DO NOTHING;

-- Grant permissions
GRANT SELECT ON pages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_permissions TO authenticated;

-- Enable Row Level Security (RLS)
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pages
CREATE POLICY "Pages are viewable by authenticated users"
  ON pages FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_permissions
CREATE POLICY "Users can view their own permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own permissions"
  ON user_permissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- Email management (tenant DB)
-- =============================================================================
-- For new/sample tenants, run in order (after update_updated_at_column exists):
--   supabase/migrations/20250418_create_email_management_tables.sql
--   supabase/migrations/20250418_add_email_settings_page_permissions.sql
--   supabase/migrations/20250419_email_outbound_channel_settings.sql
--   supabase/migrations/20250420_suppliers_email_po_intro_html.sql
--   supabase/migrations/20250421_order_status_email_notifications.sql
--   supabase/migrations/20250421_add_order_status_notifications_page_permissions.sql
--   supabase/migrations/20260320_payment_methods_import_payment_policy.sql
--   supabase/migrations/20260322_stock_movements_reversed_movement_id.sql
--   supabase/migrations/20260326_buffer_auto_proforma.sql
-- Admin DB: supabase/migrations/20260326_tenant_migration_list_buffer_auto_proforma.sql
-- Admin DB: supabase/migrations/20260321_tenant_migration_list_payment_methods_import_policy.sql
-- Admin DB: supabase/migrations/20260323_tenant_migration_list_stock_reversed_movement_id.sql
--   (replaces get_tenant_pending_migrations; includes 20260322)
--   (after prior tenant_migration_list_* files; replaces get_tenant_pending_migrations)
-- Admin DB: supabase/migrations/20250418_tenant_migration_list_email_settings.sql
--   then: supabase/migrations/20250419_tenant_migration_list_email_channel_settings.sql
--   then: supabase/migrations/20250420_tenant_migration_list_suppliers_po_intro_html.sql
--   then: supabase/migrations/20250421_tenant_migration_list_order_status_notifications.sql
-- See also: supabase/tenant_sample_email_management.sql (checklist only)
