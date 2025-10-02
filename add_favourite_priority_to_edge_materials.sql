-- Add 'favourite_priority' column to edge_materials table
-- NULL = not favourite, 1 = first favourite, 2 = second favourite, etc.

ALTER TABLE public.edge_materials
ADD COLUMN favourite_priority INTEGER DEFAULT NULL;

-- Create index for faster sorting by favourite priority
CREATE INDEX IF NOT EXISTS idx_edge_materials_favourite_priority 
ON public.edge_materials (favourite_priority)
WHERE deleted_at IS NULL AND favourite_priority IS NOT NULL;

-- Example: Set some edge materials as favourites
-- UPDATE public.edge_materials SET favourite_priority = 1 WHERE type = 'ABS' AND thickness = 2;
-- UPDATE public.edge_materials SET favourite_priority = 2 WHERE type = 'ABS' AND thickness = 0.4;

