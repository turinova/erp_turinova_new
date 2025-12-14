-- Create portal_suggestions table
CREATE TABLE IF NOT EXISTS public.portal_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  suggestion_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT portal_suggestions_text_min_length CHECK (char_length(suggestion_text) >= 50)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_portal_suggestions_customer_id ON public.portal_suggestions(portal_customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_suggestions_created_at ON public.portal_suggestions(created_at DESC);

-- Create updated_at trigger
CREATE TRIGGER update_portal_suggestions_updated_at
  BEFORE UPDATE ON public.portal_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.portal_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only insert their own suggestions
CREATE POLICY "Users can insert their own suggestions"
  ON public.portal_suggestions
  FOR INSERT
  WITH CHECK (auth.uid() = portal_customer_id);

-- Users can only view their own suggestions (if needed in the future)
CREATE POLICY "Users can view their own suggestions"
  ON public.portal_suggestions
  FOR SELECT
  USING (auth.uid() = portal_customer_id);

