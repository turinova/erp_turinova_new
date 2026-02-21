-- Product Quality Scores Migration
-- Stores calculated quality scores for products to identify which need optimization

CREATE TABLE IF NOT EXISTS public.product_quality_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- Product type
  is_parent BOOLEAN NOT NULL DEFAULT false, -- true if parent product, false if child/variant
  
  -- Overall score (0-100)
  overall_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  
  -- Category scores (0-100 each)
  content_score INTEGER DEFAULT 0 CHECK (content_score >= 0 AND content_score <= 100),
  image_score INTEGER DEFAULT 0 CHECK (image_score >= 0 AND image_score <= 100),
  technical_score INTEGER DEFAULT 0 CHECK (technical_score >= 0 AND technical_score <= 100),
  performance_score INTEGER DEFAULT 0 CHECK (performance_score >= 0 AND performance_score <= 100),
  completeness_score INTEGER DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 100),
  competitive_score INTEGER DEFAULT 0 CHECK (competitive_score >= 0 AND competitive_score <= 100),
  
  -- Priority score (higher = more urgent to fix)
  priority_score DECIMAL(10,2) DEFAULT 0,
  
  -- Issues and blocking factors
  issues JSONB DEFAULT '[]'::jsonb, -- Array of issues: [{type: "missing_description", severity: "critical", message: "..."}]
  blocking_issues TEXT[], -- Array of blocking issue types that prevent high scores
  
  -- Metadata
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  calculation_version TEXT DEFAULT '1.0', -- Track scoring algorithm version
  
  -- Unique constraint: one score per product
  UNIQUE(product_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quality_scores_product_id 
ON public.product_quality_scores(product_id);

CREATE INDEX IF NOT EXISTS idx_quality_scores_connection_id 
ON public.product_quality_scores(connection_id);

CREATE INDEX IF NOT EXISTS idx_quality_scores_overall_score 
ON public.product_quality_scores(overall_score);

CREATE INDEX IF NOT EXISTS idx_quality_scores_priority_score 
ON public.product_quality_scores(priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_quality_scores_is_parent 
ON public.product_quality_scores(is_parent);

CREATE INDEX IF NOT EXISTS idx_quality_scores_last_calculated 
ON public.product_quality_scores(last_calculated_at);

-- RLS Policies
ALTER TABLE public.product_quality_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view scores for products they have access to
DROP POLICY IF EXISTS "Users can view quality scores for their products" ON public.product_quality_scores;
CREATE POLICY "Users can view quality scores for their products" ON public.product_quality_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_quality_scores.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Policy: Users can insert scores for products they have access to
DROP POLICY IF EXISTS "Users can insert quality scores for their products" ON public.product_quality_scores;
CREATE POLICY "Users can insert quality scores for their products" ON public.product_quality_scores
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_quality_scores.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Policy: Users can update scores for products they have access to
DROP POLICY IF EXISTS "Users can update quality scores for their products" ON public.product_quality_scores;
CREATE POLICY "Users can update quality scores for their products" ON public.product_quality_scores
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_quality_scores.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Comments
COMMENT ON TABLE public.product_quality_scores IS 'Stores calculated quality scores for products to identify optimization opportunities';
COMMENT ON COLUMN public.product_quality_scores.overall_score IS 'Overall quality score 0-100. Higher is better.';
COMMENT ON COLUMN public.product_quality_scores.is_parent IS 'true if this is a parent product (standalone), false if child/variant';
COMMENT ON COLUMN public.product_quality_scores.priority_score IS 'Priority score for fixing. Higher = more urgent. Calculated as (100 - overall_score) * impact_multiplier';
COMMENT ON COLUMN public.product_quality_scores.issues IS 'JSON array of issues found: [{type, severity, message, points_lost}]';
COMMENT ON COLUMN public.product_quality_scores.blocking_issues IS 'Array of blocking issue types that prevent high scores (e.g., "missing_description", "no_images")';
