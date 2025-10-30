-- Add status timestamp tracking columns to quotes table
-- Date: 2025-10-30
-- Purpose: Track when each status transition occurs for statistics and analytics

-- ============================================
-- 1. Add timestamp columns for each status
-- ============================================

ALTER TABLE public.quotes
ADD COLUMN ordered_at timestamp with time zone NULL,
ADD COLUMN in_production_at timestamp with time zone NULL,
ADD COLUMN ready_at timestamp with time zone NULL,
ADD COLUMN finished_at timestamp with time zone NULL,
ADD COLUMN cancelled_at timestamp with time zone NULL;

-- ============================================
-- 2. Add indexes for efficient querying
-- ============================================

-- Index for finding orders by status transition dates
CREATE INDEX IF NOT EXISTS idx_quotes_ordered_at 
ON public.quotes(ordered_at) 
WHERE ordered_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_in_production_at 
ON public.quotes(in_production_at) 
WHERE in_production_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_ready_at 
ON public.quotes(ready_at) 
WHERE ready_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_finished_at 
ON public.quotes(finished_at) 
WHERE finished_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_cancelled_at 
ON public.quotes(cancelled_at) 
WHERE cancelled_at IS NOT NULL;

-- ============================================
-- 3. Create trigger function to auto-update timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_quote_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Update the appropriate timestamp based on new status
    CASE NEW.status
      WHEN 'ordered' THEN 
        -- Only set if not already set (preserve first transition)
        IF NEW.ordered_at IS NULL THEN
          NEW.ordered_at := NOW();
        END IF;
        
      WHEN 'in_production' THEN 
        IF NEW.in_production_at IS NULL THEN
          NEW.in_production_at := NOW();
        END IF;
        
      WHEN 'ready' THEN 
        IF NEW.ready_at IS NULL THEN
          NEW.ready_at := NOW();
        END IF;
        
      WHEN 'finished' THEN 
        IF NEW.finished_at IS NULL THEN
          NEW.finished_at := NOW();
        END IF;
        
      WHEN 'cancelled' THEN 
        IF NEW.cancelled_at IS NULL THEN
          NEW.cancelled_at := NOW();
        END IF;
        
      ELSE
        -- No timestamp update for 'draft' or other statuses
        NULL;
    END CASE;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Create trigger on quotes table
-- ============================================

DROP TRIGGER IF EXISTS trigger_update_quote_status_timestamps ON quotes;

CREATE TRIGGER trigger_update_quote_status_timestamps
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_status_timestamps();

-- ============================================
-- 5. Add comments explaining the columns
-- ============================================

COMMENT ON COLUMN public.quotes.ordered_at IS 
  'Timestamp when quote status changed to ordered. Used for analytics and lead time calculations.';

COMMENT ON COLUMN public.quotes.in_production_at IS 
  'Timestamp when quote status changed to in_production. Used for production time tracking.';

COMMENT ON COLUMN public.quotes.ready_at IS 
  'Timestamp when quote status changed to ready. Used for completion time analytics.';

COMMENT ON COLUMN public.quotes.finished_at IS 
  'Timestamp when quote status changed to finished (handed over to customer). Used for delivery time tracking.';

COMMENT ON COLUMN public.quotes.cancelled_at IS 
  'Timestamp when quote status changed to cancelled. Used for cancellation analytics.';

COMMENT ON FUNCTION update_quote_status_timestamps() IS 
  'Automatically updates status timestamp columns when quote status changes. Only sets timestamp on first transition to preserve original date.';

COMMENT ON TRIGGER trigger_update_quote_status_timestamps ON quotes IS 
  'Automatically records timestamp when quote status changes for analytics and reporting.';

