-- Add rating column to portal_suggestions table
ALTER TABLE public.portal_suggestions
ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 0;

-- Add constraint to ensure rating is between 1 and 5
ALTER TABLE public.portal_suggestions
ADD CONSTRAINT portal_suggestions_rating_range CHECK (rating >= 1 AND rating <= 5);

-- Update existing records to have a default rating (if any exist)
UPDATE public.portal_suggestions
SET rating = 3
WHERE rating = 0 OR rating IS NULL;

-- Make rating required (remove default after setting values)
ALTER TABLE public.portal_suggestions
ALTER COLUMN rating DROP DEFAULT;

