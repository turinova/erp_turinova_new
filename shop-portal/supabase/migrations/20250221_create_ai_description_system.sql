-- AI Description Generation System Migration
-- Creates tables for source materials, content chunks, and AI generation history
-- Single-tenant version (can be extended to multi-tenant later)
-- Run this SQL manually in your Supabase SQL Editor

-- 1. Enable pgvector extension (for embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Product Source Materials Table
CREATE TABLE IF NOT EXISTS public.product_source_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  
  -- Source Type
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'url', 'text')),
  
  -- Source Data
  title TEXT, -- User-provided title/description of source
  file_url TEXT, -- For PDFs: Supabase Storage URL
  external_url TEXT, -- For URLs: External link
  text_content TEXT, -- For direct text input
  file_name TEXT, -- Original filename for PDFs
  
  -- Processing Status
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'processed', 'error')),
  extracted_text TEXT, -- Full extracted text content
  processing_error TEXT,
  
  -- Metadata
  file_size INTEGER, -- Bytes (for PDFs)
  mime_type TEXT,
  language_code TEXT DEFAULT 'hu',
  
  -- Priority & Weight
  priority INTEGER DEFAULT 5, -- 1-10, higher = more important
  weight DECIMAL(3,2) DEFAULT 1.0, -- How much to weight this source (0.0-2.0)
  
  -- User Info
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_source_data CHECK (
    (source_type = 'pdf' AND file_url IS NOT NULL) OR
    (source_type = 'url' AND external_url IS NOT NULL) OR
    (source_type = 'text' AND text_content IS NOT NULL)
  )
);

-- 3. Content Chunks (for RAG - Retrieval Augmented Generation)
CREATE TABLE IF NOT EXISTS public.product_content_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_material_id UUID NOT NULL REFERENCES public.product_source_materials(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  
  -- Chunk Data
  chunk_text TEXT NOT NULL,
  chunk_type TEXT CHECK (chunk_type IN ('specification', 'feature', 'benefit', 'use_case', 'technical', 'marketing', 'other')),
  
  -- Embedding for semantic search (using OpenAI ada-002: 1536 dimensions)
  embedding VECTOR(1536),
  
  -- Metadata
  page_number INTEGER, -- For PDFs
  section_title TEXT,
  order_index INTEGER, -- Order within source
  
  -- Quality Score
  relevance_score DECIMAL(3,2) DEFAULT 1.0, -- AI-calculated relevance to product
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. AI Generation History
CREATE TABLE IF NOT EXISTS public.product_description_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  description_id UUID REFERENCES public.shoprenter_product_descriptions(id),
  
  -- Generation Metadata
  model_used TEXT NOT NULL, -- 'claude-3-5-sonnet', 'gpt-4o', etc.
  prompt_version TEXT,
  source_materials_used UUID[], -- Array of source_material_ids used
  
  -- Generated Content
  generated_description TEXT NOT NULL,
  
  -- Quality Metrics
  ai_detection_score DECIMAL(3,2), -- Lower is better (0.0-1.0)
  uniqueness_score DECIMAL(3,2), -- How unique vs competitors
  word_count INTEGER,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'rejected', 'published')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_source_materials_product ON public.product_source_materials(product_id);
CREATE INDEX IF NOT EXISTS idx_source_materials_status ON public.product_source_materials(processing_status);
CREATE INDEX IF NOT EXISTS idx_content_chunks_source ON public.product_content_chunks(source_material_id);
CREATE INDEX IF NOT EXISTS idx_content_chunks_product ON public.product_content_chunks(product_id);
CREATE INDEX IF NOT EXISTS idx_description_generations_product ON public.product_description_generations(product_id);
CREATE INDEX IF NOT EXISTS idx_description_generations_status ON public.product_description_generations(status);

-- 6. Vector index for semantic search (HNSW for fast similarity search)
-- Note: ivfflat requires at least some data, so we'll create it but it may need tuning later
CREATE INDEX IF NOT EXISTS idx_content_chunks_embedding ON public.product_content_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.product_source_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_content_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_description_generations ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for product_source_materials
-- Users can view source materials for products they can access
DROP POLICY IF EXISTS "Source materials are viewable by authenticated users" ON public.product_source_materials;
CREATE POLICY "Source materials are viewable by authenticated users" ON public.product_source_materials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products p
      WHERE p.id = product_id AND p.deleted_at IS NULL
    )
  );

-- Users with /products permission can manage source materials
DROP POLICY IF EXISTS "Only authorized users can manage source materials" ON public.product_source_materials;
CREATE POLICY "Only authorized users can manage source materials" ON public.product_source_materials
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  );

-- 9. RLS Policies for product_content_chunks
DROP POLICY IF EXISTS "Content chunks are viewable by authenticated users" ON public.product_content_chunks;
CREATE POLICY "Content chunks are viewable by authenticated users" ON public.product_content_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products p
      WHERE p.id = product_id AND p.deleted_at IS NULL
    )
  );

-- Users with /products permission can manage content chunks
DROP POLICY IF EXISTS "Only authorized users can manage content chunks" ON public.product_content_chunks;
CREATE POLICY "Only authorized users can manage content chunks" ON public.product_content_chunks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  );

-- 10. RLS Policies for product_description_generations
DROP POLICY IF EXISTS "Generations are viewable by authenticated users" ON public.product_description_generations;
CREATE POLICY "Generations are viewable by authenticated users" ON public.product_description_generations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products p
      WHERE p.id = product_id AND p.deleted_at IS NULL
    )
  );

-- Users with /products permission can manage generations
DROP POLICY IF EXISTS "Only authorized users can manage generations" ON public.product_description_generations;
CREATE POLICY "Only authorized users can manage generations" ON public.product_description_generations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  );

-- 11. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_source_materials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_content_chunks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_description_generations TO authenticated;

-- 12. Function for semantic search (to find relevant chunks)
CREATE OR REPLACE FUNCTION match_content_chunks(
  query_embedding VECTOR(1536),
  match_product_id UUID,
  match_threshold DECIMAL DEFAULT 0.7,
  match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  chunk_text TEXT,
  chunk_type TEXT,
  relevance_score DECIMAL,
  source_material_id UUID,
  similarity DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.chunk_text,
    c.chunk_type,
    c.relevance_score,
    c.source_material_id,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.product_content_chunks c
  WHERE c.product_id = match_product_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 13. Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_source_materials_updated_at
  BEFORE UPDATE ON public.product_source_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_description_generations_updated_at
  BEFORE UPDATE ON public.product_description_generations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
