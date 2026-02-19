# AI Product Description Generation System

## Overview
This system generates SEO-optimized, AI-detection-resistant product descriptions using RAG (Retrieval Augmented Generation) with Claude 3.5 Sonnet.

## Architecture

### Database Schema
- **product_source_materials**: Stores PDFs, URLs, and text sources
- **product_content_chunks**: Stores chunked content with embeddings (pgvector)
- **product_description_generations**: Tracks generation history

### Key Components

1. **Content Extraction** (`src/lib/content-extraction.ts`)
   - PDF parsing using `pdf-parse`
   - URL scraping using `cheerio`
   - Text processing

2. **Chunking & Embeddings** (`src/lib/chunking-service.ts`)
   - Intelligent chunking (500 words, 100 word overlap)
   - OpenAI embeddings (text-embedding-3-small)
   - Semantic search using pgvector

3. **AI Generation** (`src/lib/ai-generation-service.ts`)
   - Claude 3.5 Sonnet for description generation
   - RAG with semantic search
   - AI detection avoidance prompts

### API Routes

- `POST /api/products/[id]/sources` - Upload source material (PDF, URL, text)
- `GET /api/products/[id]/sources` - List source materials
- `DELETE /api/products/[id]/sources/[sourceId]` - Delete source material
- `POST /api/products/[id]/sources/[sourceId]/process` - Process source (extract, chunk, embed)
- `POST /api/products/[id]/generate-description` - Generate description with AI

## Setup Instructions

### 1. Run Database Migrations

```sql
-- Run these in Supabase SQL Editor:
-- 1. shop-portal/supabase/migrations/20250221_create_ai_description_system.sql
-- 2. shop-portal/supabase/migrations/20250221_create_storage_bucket.sql
```

### 2. Install Dependencies

```bash
cd shop-portal
npm install
```

### 3. Environment Variables

Add to `.env.local`:

```env
# AI APIs
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Create Storage Bucket

The migration creates the bucket, but verify in Supabase Dashboard:
- Go to Storage → Buckets
- Ensure `product-sources` bucket exists
- Verify policies are set correctly

## Usage Workflow

### Step 1: Add Source Materials
1. Go to product edit page
2. Click "Source Materials" tab
3. Upload PDF, add URL, or paste text
4. System automatically processes (extracts, chunks, embeds)

### Step 2: Generate Description
1. Click "Generate Description" button
2. System uses RAG to find relevant chunks
3. Claude generates description using source materials
4. Description appears in editor for review

### Step 3: Review & Publish
1. Review generated description
2. Edit if needed
3. Save to product description
4. Sync to webshop

## Cost Estimates

- **Claude 3.5 Sonnet**: ~$0.01-0.02 per description (500-1000 words)
- **OpenAI Embeddings**: ~$0.0001 per source material (10 chunks)
- **Total**: ~$0.02 per description with source materials

## Future Enhancements (SaaS Ready)

When ready for multi-tenant SaaS:
1. Add `organization_id` to all tables
2. Add usage tracking tables
3. Add quota management
4. Add billing integration

## Notes

- PDF processing happens in background (can be moved to job queue later)
- Embeddings are cached in database (no re-generation needed)
- Vector search uses cosine similarity (pgvector)
- System is designed to be easily extended to multi-tenant
