-- Fix the get_user_permissions RPC function to return can_access instead of can_view/can_edit/can_delete
-- This aligns with the actual user_permissions table schema

CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS TABLE (
  page_path VARCHAR(255),
  page_name VARCHAR(255),
  can_access BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.path,
    p.name,
    COALESCE(up.can_access, false) as can_access
  FROM pages p
  LEFT JOIN user_permissions up ON p.id = up.page_id AND up.user_id = user_uuid
  WHERE p.is_active = true
  ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This function now correctly returns can_access matching the user_permissions table schema
-- Previously returned can_view/can_edit/can_delete which don't exist in the table

