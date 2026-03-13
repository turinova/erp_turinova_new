-- =============================================================================
-- Add Foreign Key Constraint to order_buffer.connection_id
-- =============================================================================
-- This migration adds the missing foreign key constraint to order_buffer
-- so that Supabase PostgREST can properly resolve the relationship
-- between order_buffer and webshop_connections.
-- =============================================================================

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
  -- Check if the foreign key constraint already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'order_buffer' 
    AND constraint_name = 'order_buffer_connection_id_fkey'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE public.order_buffer
    ADD CONSTRAINT order_buffer_connection_id_fkey
    FOREIGN KEY (connection_id)
    REFERENCES public.webshop_connections(id)
    ON DELETE SET NULL; -- Set to NULL if connection is deleted (soft delete)
  END IF;
END $$;

-- Create index on connection_id if it doesn't exist (for better join performance)
CREATE INDEX IF NOT EXISTS idx_order_buffer_connection_id 
ON public.order_buffer(connection_id) 
WHERE connection_id IS NOT NULL;
