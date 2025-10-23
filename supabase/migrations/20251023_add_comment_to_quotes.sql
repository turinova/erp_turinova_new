-- Add comment field to quotes table
-- This allows storing a single comment per quote/order
-- Character limit enforced in application layer (250 characters)

ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS comment text NULL;

-- Add index for comment field (optional, for future search functionality)
CREATE INDEX IF NOT EXISTS idx_quotes_comment 
ON public.quotes USING btree (comment) 
TABLESPACE pg_default
WHERE (comment IS NOT NULL AND deleted_at IS NULL);

-- Add comment to quotes table
COMMENT ON COLUMN public.quotes.comment IS 'Internal comment/note for the quote or order (max 250 characters enforced in app)';

