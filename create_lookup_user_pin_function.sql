-- Create a function to lookup PIN (bypasses PostgREST schema cache)
CREATE OR REPLACE FUNCTION lookup_user_pin(pin_code VARCHAR(6))
RETURNS TABLE (
  user_id UUID,
  failed_attempts INT,
  locked_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.user_id,
    up.failed_attempts,
    up.locked_until,
    up.is_active
  FROM public.user_pins up
  WHERE up.pin = pin_code
    AND up.is_active = true;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION lookup_user_pin(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION lookup_user_pin(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION lookup_user_pin(VARCHAR) TO service_role;

