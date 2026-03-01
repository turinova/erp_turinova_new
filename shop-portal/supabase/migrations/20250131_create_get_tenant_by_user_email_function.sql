-- Create get_tenant_by_user_email RPC Function
-- Run this in your ADMIN DATABASE
-- This function is needed for authentication lookup

CREATE OR REPLACE FUNCTION public.get_tenant_by_user_email(user_email_param TEXT)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name VARCHAR,
  tenant_slug VARCHAR,
  supabase_url TEXT,
  supabase_anon_key TEXT,
  user_id_in_tenant_db UUID,
  user_role VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.slug,
    t.supabase_url,
    t.supabase_anon_key,
    tu.user_id_in_tenant_db,
    tu.role
  FROM public.tenants t
  INNER JOIN public.tenant_users tu ON tu.tenant_id = t.id
  WHERE tu.user_email = user_email_param
    AND t.is_active = true
    AND t.deleted_at IS NULL
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_tenant_by_user_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_by_user_email(TEXT) TO anon;
