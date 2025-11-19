-- Add deleted_at column to pos_payments table
ALTER TABLE public.pos_payments
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone NULL;

-- Add index for soft-deleted payments
CREATE INDEX IF NOT EXISTS idx_pos_payments_deleted_at 
ON public.pos_payments(deleted_at) 
WHERE deleted_at IS NULL;

