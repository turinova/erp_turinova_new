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
  generationInstructions?: string // Custom instructions for generation
}

export interface GeneratedDescription {
  description: string
  wordCount: number
  tokensUsed: number
  modelUsed: string
  sourceMaterialsUsed: string[]
  productType?: string
  validationWarnings?: string[]
}

export interface ProductTypeInfo {
  type: string
  confidence: 'high' | 'medium' | 'low'
  features: string[]
  description: string
}

/**
 * Detect product type from product name and SKU
 */
function detectProductType(productName: string, sku: string): ProductTypeInfo {
  const nameLower = (productName || '').toLowerCase()
  const skuLower = sku.toLowerCase()
  const combined = `${nameLower} ${skuLower}`
  
  // Trash bins / Sorting bins
  if (combined.includes('sorter') || 
      combined.includes('kuka') || 
      combined.includes('szemetes') ||
      combined.includes('szortírozó') ||
      combined.includes('waste') ||
      combined.includes('trash') ||
      combined.includes('bin')) {
    return {
      type: 'trash_bin',
      confidence: 'high',
      features: ['capacity (liters)', 'dimensions (height/width)', 'material', 'lid type', 'mounting options', 'sorting compartments'],
      description: 'Kuka vagy szortírozó tartály'
    }
  }
  
  // Drawer systems / Organizers
  if (combined.includes('fiók') && !combined.includes('kuka fiók') ||
      combined.includes('drawer') ||
      (combined.includes('rendező') && !combined.includes('sorter')) ||
      combined.includes('organizer') ||
      combined.includes('sorter') && combined.includes('fiók')) {
    return {
      type: 'drawer_system',
      confidence: 'high',
      features: ['drawer capacity', 'rail type', 'installation width', 'number of drawers', 'material', 'finish'],
      description: 'Fiókrendszer vagy szekrényrendező'
    }
  }
  
  // Hinges
  if (combined.includes('csukló') || 
      combined.includes('hinge') ||
      combined.includes('pánt') ||
      combined.includes('pant')) {
    return {
      type: 'hinge',
      confidence: 'high',
      features: ['opening angle', 'mounting type', 'material', 'finish', 'adjustability', 'soft close'],
      description: 'Szekrénycsukló'
    }
  }
  
  // Slides / Drawer slides
  if (combined.includes('csúszka') || 
      combined.includes('slide') ||
      combined.includes('kihúzható') ||
      combined.includes('rail')) {
    return {
      type: 'slide',
      confidence: 'high',
      features: ['load capacity', 'extension type', 'mounting width', 'material', 'soft close', 'installation'],
      description: 'Fiókcsúszka vagy sínszer'
    }
  }
  
  // Handles / Pulls
  if (combined.includes('fogantyú') ||
      combined.includes('kilincs') ||
      combined.includes('handle') ||
      combined.includes('pull') ||
      combined.includes('knob')) {
    return {
      type: 'handle',
      confidence: 'high',
      features: ['length', 'material', 'finish', 'mounting type', 'screw spacing', 'style'],
      description: 'Fogantyú vagy kilincs'
    }
  }
  
  // Default to generic cabinet hardware
  return {
    type: 'cabinet_hardware',
    confidence: 'low',
    features: ['specifications', 'material', 'finish', 'installation', 'dimensions'],
    description: 'Szekrény kellék vagy kiegészítő'
  }
}

/**
 * Validate description for logical consistency
 */
function validateDescription(
  description: string,
  productName: string,
  productType: ProductTypeInfo
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []
  const descLower = description.toLowerCase()
  const nameLower = (productName || '').toLowerCase()
  
  // Check for product type mismatches
  if (productType.type === 'trash_bin') {
    if (descLower.includes('fiók') && !descLower.includes('kuka fiók') && !descLower.includes('szemetes fiók')) {
      warnings.push('Trash bin description mentions "fiók" (drawer) incorrectly - should focus on bin/capacity features')
    }
    if (descLower.includes('sínek') || descLower.includes('rail') || descLower.includes('csúszka')) {
      warnings.push('Trash bin description mentions rails/slides incorrectly - trash bins don\'t have rails')
    }
    if (descLower.includes('szekrénybe beszerelhető') && !descLower.includes('szekrény alá') && !descLower.includes('szekrénybe szerelhető kuka')) {
      warnings.push('Trash bin installation description may be incorrect - check if it\'s under-sink or wall-mounted')
    }
    if (!descLower.includes('liter') && !descLower.includes('l') && nameLower.includes('l')) {
      warnings.push('Product name contains capacity (L) but description doesn\'t mention liters/capacity')
    }
  }
  
  if (productType.type === 'drawer_system') {
    if (descLower.includes('kuka') || descLower.includes('szemetes') || descLower.includes('trash')) {
      warnings.push('Drawer system description mentions trash bin incorrectly')
    }
    if (!descLower.includes('fiók') && !descLower.includes('drawer')) {
      warnings.push('Drawer system description should mention drawer features')
    }
  }
  
  // Check for dimension consistency
  if (nameLower.includes('h400') || nameLower.includes('h 400')) {
    if (!descLower.includes('400') && !descLower.includes('négy száz') && !descLower.includes('magasság')) {
      warnings.push('Product has H400 in name but description doesn\'t mention 400mm height')
    }
  }
  
  if (nameLower.includes('13l') || nameLower.includes('13 l') || nameLower.includes('13 liter')) {
    if (!descLower.includes('13') && !descLower.includes('tizenhárom') && !descLower.includes('liter')) {
      warnings.push('Product has 13L in name but description doesn\'t mention 13 liter capacity')
    }
  }
  
  if (nameLower.includes('400-tól') || nameLower.includes('400 tol')) {
    if (!descLower.includes('400') && !descLower.includes('négy száz')) {
      warnings.push('Product has "400-tól" in name but description doesn\'t mention 400mm width')
    }
  }
  
  // Check for logical feature mentions
  if (productType.type === 'trash_bin' && !descLower.includes('tárolás') && !descLower.includes('kapacitás') && !descLower.includes('liter')) {
    warnings.push('Trash bin description should mention storage capacity')
  }
  
  return {
    valid: warnings.length === 0,
    warnings
  }
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
    language = 'hu',
    generationInstructions
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

    // 4. Detect product type
    const productType = detectProductType(product.name || '', product.sku || '')
    console.log(`[AI GENERATION] Detected product type: ${productType.type} (confidence: ${productType.confidence})`)

    // 5. Build context
    const context = buildContext(product, sourceMaterials, relevantChunks)

    // 6. Build prompts with product type awareness
    const systemPrompt = `You are an expert product copywriter specializing in creating authentic, 
human-written product descriptions for cabinet hardware and related products that rank high in search engines and AI search systems.

CRITICAL: PRODUCT TYPE UNDERSTANDING
**YOU MUST FIRST IDENTIFY THE EXACT PRODUCT TYPE FROM THE PRODUCT NAME AND SKU.**
- Analyze the product name carefully: "Sorter" = trash/sorting bin, "fiók" = drawer, "csukló" = hinge, etc.
- DO NOT assume all products are drawer systems or cabinet organizers
- If the product name contains "Sorter", "kuka", "szemetes" → it's a TRASH BIN, not a drawer system
- If the product name contains "fiók", "drawer" → it's a DRAWER SYSTEM
- Match your description to the ACTUAL product type, not assumptions
- The detected product type will be provided to you - use it as the primary guide

CRITICAL INSTRUCTIONS - LANGUAGE REQUIREMENT:
**YOU MUST WRITE EXCLUSIVELY IN HUNGARIAN, REGARDLESS OF THE LANGUAGE OF THE SOURCE MATERIALS.**
- Even if source materials are in English, German, or any other language, you MUST translate and write the description in Hungarian
- Use proper Hungarian grammar, spelling, and terminology
- Use Hungarian industry terms (szekrény, csukló, fiókcsúszka, stb.)
- Write naturally in Hungarian - do not use literal translations
- The entire description must be in Hungarian, no English words unless they are brand names or technical terms commonly used in Hungarian

LOGICAL CONSISTENCY REQUIREMENTS:
1. **Product Type Validation**: Ensure your description matches the product type indicated by the name/SKU
2. **Feature Accuracy**: Only mention features that make sense for the product type:
   - Trash bins: capacity (liters), dimensions, material, lid type, mounting options, sorting compartments
   - Drawer systems: drawer capacity, rail type, installation width, number of drawers, material, finish
   - Hinges: opening angle, mounting type, material, finish, adjustability, soft close
   - Slides: load capacity, extension type, mounting width, material, soft close, installation
3. **Dimension Interpretation**: 
   - "H400" = Height 400mm (magasság 400mm)
   - "400-tól" = Width from 400mm (minimum szélesség 400mm-tól)
   - "13L" = 13 liters capacity (13 liter kapacitás)
   - Interpret dimensions correctly based on product type
4. **Logical Coherence**: 
   - If describing a trash bin, don't mention drawer rails or drawer installation
   - If describing a drawer, don't mention trash capacity or waste sorting
   - If describing a hinge, focus on door mounting, not drawer features
5. **Fact-Checking**: Before finalizing, verify:
   - Does the product type match the name?
   - Do the features make sense for this product type?
   - Are dimensions interpreted correctly?
   - Is the installation method appropriate?

OTHER CRITICAL INSTRUCTIONS:
1. Write in a natural, conversational Hungarian tone - avoid AI patterns
2. Use varied sentence structures and lengths (30% short 5-10 words, 50% medium 15-25 words, 20% long 30+ words)
3. Include specific details from the source materials provided (translate to Hungarian)
4. Write as if you personally know and use this product
5. Avoid repetitive phrases or structures
6. Use industry-specific terminology naturally in Hungarian
7. Include subtle imperfections (natural human writing has them)
8. Focus on user benefits, not just features
9. Answer questions a real customer would ask
10. Make it comprehensive but scannable (500-1000 words)
11. **MANDATORY: Write ONLY in Hungarian - no English, no mixed languages**
12. Use rhetorical questions naturally: "Mire figyeljünk?" "Miért válasszuk ezt?"
13. Include personal voice elements: "én", "mi", "tapasztalat" occasionally

FACT-CHECKING BEFORE RESPONSE:
Before you write the description, ask yourself:
1. What product type is this? (trash bin, drawer, hinge, etc.)
2. What features make sense for this product type?
3. Are the dimensions interpreted correctly?
4. Is the installation method appropriate?
5. Does every sentence logically fit this product type?

If you're unsure about the product type, focus on what you KNOW from the name/SKU and source materials, 
and avoid making assumptions about features that don't match the product type.

Write ONLY the product description in Hungarian. Do not include meta tags, titles, or other fields.`

    const userPrompt = `Generate a product description for:
${product.name || product.sku} (SKU: ${product.sku})

DETECTED PRODUCT TYPE: ${productType.type} (${productType.description})
- Based on the name "${product.name || product.sku}", this appears to be a: ${productType.description}
- Confidence level: ${productType.confidence}
- Expected features for this product type: ${productType.features.join(', ')}
- **CRITICAL**: Ensure your description matches this product type exactly
- **DO NOT** confuse it with other product types (e.g., don't describe a trash bin as a drawer system)

${context}

CRITICAL REQUIREMENTS:

1. **Product Type Accuracy**: 
   - This is a ${productType.description} (${productType.type})
   - Write ONLY about features relevant to ${productType.type}s
   - If this is a trash bin, focus on: capacity, dimensions, material, mounting, sorting features
   - If this is a drawer system, focus on: drawer capacity, rails, installation width, number of drawers
   - If this is a hinge, focus on: opening angle, mounting, adjustability
   - DO NOT mix features from different product types

2. **Dimension Accuracy**: 
   - Interpret "H400" as height 400mm (magasság 400mm)
   - Interpret "400-tól" as minimum width 400mm (minimum szélesség 400mm-tól)
   - Interpret "13L" as 13 liters capacity (13 liter kapacitás)
   - Include these dimensions in the description if present in the product name

3. **Feature Accuracy**: 
   - Only mention features that exist for ${productType.type}s
   - Trash bins: capacity, material, lid, mounting (under-sink, wall-mounted), sorting compartments
   - Drawer systems: drawer capacity, rail type, installation width, number of drawers
   - Hinges: opening angle, mounting type, adjustability, soft close
   - DO NOT mention features that don't apply (e.g., rails for trash bins, capacity for hinges)

4. **Logical Consistency**: 
   - Every sentence must make logical sense for a ${productType.type}
   - Installation method must match the product type
   - Use cases must match the product type
   - Benefits must match the product type

5. **Language Requirement**:
   - Write EXCLUSIVELY in Hungarian - this is mandatory
   - Translate all information from source materials to Hungarian
   - Use Hungarian terminology and expressions
   - Write naturally in Hungarian, not as a translation
   - No English words except brand names or universally used technical terms

6. **Content Quality**:
   - Make it sound like it was written by a knowledgeable Hungarian expert
   - Include specific details from the source materials above (translated to Hungarian)
   - Optimize for Hungarian search engines without keyword stuffing
   - Write naturally in Hungarian - avoid AI detection patterns
   - Include emotional triggers and benefits in Hungarian
   - Make it unique compared to competitors
   - Length: 500-1000 words
   - Structure: Use headings, bullet points, and paragraphs naturally (in Hungarian)
   - Use varied sentence lengths (short, medium, long)
   - Include rhetorical questions: "Mire figyeljünk?" "Miért válasszuk ezt?"
   - Add personal voice: "én", "mi", "tapasztalat" occasionally

7. **Focus Areas** (all in Hungarian):
   - Specifications (méretek, anyag, kapacitás, stb.)
   - Installation (beszerelés, szerelési útmutató)
   - Use cases (használati lehetőségek, alkalmazási területek)
   - Benefits (előnyök, miért válassza ezt)
   - Applications (konyha, iroda, garázs, stb.)

${generationInstructions ? `\n\nADDITIONAL GENERATION INSTRUCTIONS (CRITICAL - MUST FOLLOW):
${generationInstructions}

These instructions override or supplement the standard requirements above. Pay special attention to these custom instructions when generating the description.` : ''}

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

    // 7. Validate description for logical consistency
    const validation = validateDescription(description, product.name || product.sku, productType)
    if (validation.warnings.length > 0) {
      console.warn(`[AI GENERATION] Validation warnings for ${product.sku}:`, validation.warnings)
    }

    // 8. Calculate metrics
    const wordCount = description.split(/\s+/).length
    const tokensUsed = message.usage.input_tokens + message.usage.output_tokens
    const sourceMaterialsUsed = sourceMaterials.map(s => s.id)

    return {
      description,
      wordCount,
      tokensUsed,
      modelUsed: modelUsed,
      sourceMaterialsUsed,
      productType: productType.type,
      validationWarnings: validation.warnings.length > 0 ? validation.warnings : undefined
    }
  } catch (error) {
    console.error('Error generating description:', error)
    throw new Error(`Description generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
