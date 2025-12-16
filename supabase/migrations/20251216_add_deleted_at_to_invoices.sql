-- Add deleted_at column to invoices table for soft delete
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Create index for deleted_at queries
CREATE INDEX IF NOT EXISTS invoices_deleted_at_idx 
ON public.invoices (deleted_at);

-- Add comment
COMMENT ON COLUMN public.invoices.deleted_at IS 'Timestamp when invoice was soft deleted (used for díjbekérő deletion)';

