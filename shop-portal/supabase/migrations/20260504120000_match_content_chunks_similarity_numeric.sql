-- pgvector <=> returns double precision; RETURNS TABLE similarity DECIMAL caused 42804
-- "Returned type double precision does not match expected type numeric in column 6"
CREATE OR REPLACE FUNCTION public.match_content_chunks(
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
  similarity NUMERIC
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
    (1::double precision - (c.embedding <=> query_embedding))::NUMERIC AS similarity
  FROM public.product_content_chunks c
  WHERE c.product_id = match_product_id
    AND c.embedding IS NOT NULL
    AND (1::double precision - (c.embedding <=> query_embedding)) > match_threshold::double precision
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
