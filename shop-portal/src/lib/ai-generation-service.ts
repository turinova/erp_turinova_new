// AI Generation Service
// Handles product description generation using Claude with RAG

import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateEmbedding } from './chunking-service'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Explicitly set API version
  defaultHeaders: {
    'anthropic-version': '2023-06-01'
  }
})

export interface GenerationOptions {
  useSourceMaterials?: boolean // Use RAG with source materials
  temperature?: number // 0.0-1.0, default 0.7
  maxTokens?: number // Default 2000
  language?: string // 'hu' or 'en', default 'hu'
}

export interface GeneratedDescription {
  description: string
  wordCount: number
  tokensUsed: number
  modelUsed: string
  sourceMaterialsUsed: string[]
}

/**
 * Find relevant content chunks using semantic search
 */
async function findRelevantChunks(
  supabase: any,
  productId: string,
  query: string,
  limit: number = 10
): Promise<any[]> {
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query)

    // Search using pgvector
    const { data, error } = await supabase.rpc('match_content_chunks', {
      query_embedding: queryEmbedding,
      match_product_id: productId,
      match_threshold: 0.7,
      match_count: limit
    })

    if (error) {
      console.error('Error in semantic search:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error finding relevant chunks:', error)
    return []
  }
}

/**
 * Build context from source materials and chunks
 */
function buildContext(
  product: any,
  sourceMaterials: any[],
  relevantChunks: any[]
): string {
  let context = `\n\nPRODUCT INFORMATION:\n`
  context += `- SKU: ${product.sku}\n`
  context += `- Name: ${product.name || 'N/A'}\n`
  context += `- Category: ${product.category || 'N/A'}\n`

  if (sourceMaterials.length > 0) {
    context += `\n\nSOURCE MATERIALS PROVIDED:\n`
    sourceMaterials.forEach((source, index) => {
      context += `\nSource ${index + 1}: ${source.title || source.source_type}\n`
      context += `Type: ${source.source_type}\n`
      if (source.extracted_text) {
        context += `Content preview: ${source.extracted_text.slice(0, 200)}...\n`
      }
    })
  }

  if (relevantChunks.length > 0) {
    context += `\n\nRELEVANT CONTENT FROM SOURCE MATERIALS:\n`
    relevantChunks.forEach((chunk, index) => {
      context += `\n[Chunk ${index + 1} - ${chunk.chunk_type}]\n`
      context += `${chunk.chunk_text}\n`
    })
  }

  return context
}

/**
 * Generate product description using Claude with RAG
 */
export async function generateProductDescription(
  supabase: any,
  productId: string,
  options: GenerationOptions = {}
): Promise<GeneratedDescription> {
  const {
    useSourceMaterials = true,
    temperature = 0.7,
    maxTokens = 2000,
    language = 'hu'
  } = options

  try {
    // 1. Get product data
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('*')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      throw new Error('Product not found')
    }

    // 2. Get source materials
    let sourceMaterials: any[] = []
    let relevantChunks: any[] = []

    if (useSourceMaterials) {
      const { data: sources } = await supabase
        .from('product_source_materials')
        .select('*')
        .eq('product_id', productId)
        .eq('processing_status', 'processed')
        .order('priority', { ascending: false })

      sourceMaterials = sources || []

      // 3. Find relevant chunks using semantic search
      if (sourceMaterials.length > 0) {
        const query = `Product description for ${product.sku} ${product.name || ''} cabinet hardware`
        relevantChunks = await findRelevantChunks(supabase, productId, query, 10)
      }
    }

    // 4. Build context
    const context = buildContext(product, sourceMaterials, relevantChunks)

    // 5. Build prompts
    const systemPrompt = `You are an expert product copywriter specializing in creating authentic, 
human-written product descriptions for cabinet hardware that rank high in search engines and AI search systems.

CRITICAL INSTRUCTIONS - LANGUAGE REQUIREMENT:
**YOU MUST WRITE EXCLUSIVELY IN HUNGARIAN, REGARDLESS OF THE LANGUAGE OF THE SOURCE MATERIALS.**
- Even if source materials are in English, German, or any other language, you MUST translate and write the description in Hungarian
- Use proper Hungarian grammar, spelling, and terminology
- Use Hungarian industry terms (szekrény, csukló, fiókcsúszka, stb.)
- Write naturally in Hungarian - do not use literal translations
- The entire description must be in Hungarian, no English words unless they are brand names or technical terms commonly used in Hungarian

OTHER CRITICAL INSTRUCTIONS:
1. Write in a natural, conversational Hungarian tone - avoid AI patterns
2. Use varied sentence structures and lengths
3. Include specific details from the source materials provided (translate to Hungarian)
4. Write as if you personally know and use this product
5. Avoid repetitive phrases or structures
6. Use industry-specific terminology naturally in Hungarian
7. Include subtle imperfections (natural human writing has them)
8. Focus on user benefits, not just features
9. Answer questions a real customer would ask
10. Make it comprehensive but scannable (500-1000 words)
11. **MANDATORY: Write ONLY in Hungarian - no English, no mixed languages**

Write ONLY the product description in Hungarian. Do not include meta tags, titles, or other fields.`

    const userPrompt = `Generate a product description for:
${product.name || product.sku} (SKU: ${product.sku})

${context}

CRITICAL LANGUAGE REQUIREMENT:
**YOU MUST WRITE THE ENTIRE DESCRIPTION IN HUNGARIAN ONLY.**
- Translate all information from source materials to Hungarian
- Use Hungarian terminology and expressions
- Write naturally in Hungarian, not as a translation
- No English words except brand names or universally used technical terms

Requirements:
1. Write EXCLUSIVELY in Hungarian - this is mandatory
2. Make it sound like it was written by a knowledgeable Hungarian cabinet hardware expert
3. Include specific details from the source materials above (translated to Hungarian)
4. Optimize for Hungarian search engines without keyword stuffing
5. Write naturally in Hungarian - avoid AI detection patterns
6. Include emotional triggers and benefits in Hungarian
7. Make it unique compared to competitors
8. Length: 500-1000 words
9. Structure: Use headings, bullet points, and paragraphs naturally (in Hungarian)
10. Focus on: specifications, installation, use cases, benefits, and applications (all in Hungarian)

Generate ONLY the description text in HTML format (use <h2>, <h3>, <p>, <ul>, <li> tags), written entirely in Hungarian, nothing else.`

    // 6. Generate description using Claude
    // Try Sonnet first (best quality), fallback to Haiku if not available
    const modelsToTry = [
      'claude-3-5-sonnet-latest',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-sonnet',
      'claude-3-haiku-20240307' // Fallback - most accessible
    ]

    let message: any = null
    let modelUsed = ''
    let lastError: any = null

    for (const model of modelsToTry) {
      try {
        console.log(`[AI GENERATION] Trying model: ${model}`)
        message = await anthropic.messages.create({
          model: model,
          max_tokens: maxTokens,
          temperature: temperature,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt
            }
          ]
        })
        modelUsed = model
        console.log(`[AI GENERATION] Success with model: ${model}`)
        break
      } catch (err: any) {
        lastError = err
        console.log(`[AI GENERATION] Model ${model} failed:`, err?.message)
        // Continue to next model
        continue
      }
    }

    if (!message) {
      throw new Error(`All Claude models failed. Last error: ${lastError?.message || 'Unknown error'}`)
    }

    const description = message.content[0].type === 'text' 
      ? message.content[0].text 
      : ''

    // 7. Calculate metrics
    const wordCount = description.split(/\s+/).length
    const tokensUsed = message.usage.input_tokens + message.usage.output_tokens
    const sourceMaterialsUsed = sourceMaterials.map(s => s.id)

    return {
      description,
      wordCount,
      tokensUsed,
      modelUsed: modelUsed,
      sourceMaterialsUsed
    }
  } catch (error) {
    console.error('Error generating description:', error)
    throw new Error(`Description generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
