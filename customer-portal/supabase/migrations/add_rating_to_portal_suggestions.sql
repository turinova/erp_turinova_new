-- Add rating column to portal_suggestions table (nullable first)
ALTER TABLE public.portal_suggestions
ADD COLUMN IF NOT EXISTS rating INTEGER;

-- Update existing records to have a default rating (if any exist)
UPDATE public.portal_suggestions
SET rating = 3
WHERE rating IS NULL;

-- Add constraint to ensure rating is between 1 and 5
ALTER TABLE public.portal_suggestions
ADD CONSTRAINT portal_suggestions_rating_range CHECK (rating >= 1 AND rating <= 5);

-- Make rating required (NOT NULL)
ALTER TABLE public.portal_suggestions
ALTER COLUMN rating SET NOT NULL;

