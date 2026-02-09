-- =====================================================
-- Add status timestamp columns to worktop_quotes table
-- =====================================================
-- These columns track when each status transition occurs
-- Similar to quotes table for consistency
-- =====================================================

-- Add timestamp columns for each status
ALTER TABLE public.worktop_quotes
ADD COLUMN IF NOT EXISTS ordered_at timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS in_production_at timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS ready_at timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS finished_at timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone NULL;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_worktop_quotes_ordered_at 
ON public.worktop_quotes(ordered_at) 
WHERE ordered_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_worktop_quotes_in_production_at 
ON public.worktop_quotes(in_production_at) 
WHERE in_production_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_worktop_quotes_ready_at 
ON public.worktop_quotes(ready_at) 
WHERE ready_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_worktop_quotes_finished_at 
ON public.worktop_quotes(finished_at) 
WHERE finished_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_worktop_quotes_cancelled_at 
ON public.worktop_quotes(cancelled_at) 
WHERE cancelled_at IS NOT NULL AND deleted_at IS NULL;

-- Add comments explaining the columns
COMMENT ON COLUMN public.worktop_quotes.ordered_at IS 
  'Timestamp when worktop quote status changed to ordered. Used for analytics and lead time calculations.';

COMMENT ON COLUMN public.worktop_quotes.in_production_at IS 
  'Timestamp when worktop quote status changed to in_production. Used for production time tracking.';

COMMENT ON COLUMN public.worktop_quotes.ready_at IS 
  'Timestamp when worktop quote status changed to ready. Used for completion time analytics.';

COMMENT ON COLUMN public.worktop_quotes.finished_at IS 
  'Timestamp when worktop quote status changed to finished (handed over to customer). Used for delivery time tracking.';

COMMENT ON COLUMN public.worktop_quotes.cancelled_at IS 
  'Timestamp when worktop quote status changed to cancelled. Used for cancellation analytics.';
