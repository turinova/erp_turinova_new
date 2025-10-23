-- Add comment field to portal_quotes table
-- This allows customers to add notes/comments to their quotes
-- Character limit enforced in application layer (250 characters)

ALTER TABLE public.portal_quotes 
ADD COLUMN IF NOT EXISTS comment text NULL;

-- Add index for comment field (optional, for future search functionality)
CREATE INDEX IF NOT EXISTS idx_portal_quotes_comment 
ON public.portal_quotes USING btree (comment) 
TABLESPACE pg_default
WHERE (comment IS NOT NULL);

-- Add comment to portal_quotes table
COMMENT ON COLUMN public.portal_quotes.comment IS 'Customer comment/note for the quote (max 250 characters enforced in app)';

