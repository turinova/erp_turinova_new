-- Add worker_id foreign key column to user_pins table
ALTER TABLE public.user_pins
ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL;

-- Create index for worker_id lookups
CREATE INDEX IF NOT EXISTS idx_user_pins_worker_id ON public.user_pins(worker_id);

-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS lookup_user_pin(VARCHAR);

-- Recreate lookup_user_pin function to include worker_id
CREATE FUNCTION lookup_user_pin(pin_code VARCHAR(6))
RETURNS TABLE (
  user_id UUID,
  worker_id UUID,
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
    up.worker_id,
    up.failed_attempts,
    up.locked_until,
    up.is_active
  FROM public.user_pins up
  WHERE up.pin = pin_code
    AND up.is_active = true;
END;
$$;

-- Grant execute permission (already granted, but ensuring it's there)
GRANT EXECUTE ON FUNCTION lookup_user_pin(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION lookup_user_pin(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION lookup_user_pin(VARCHAR) TO service_role;

