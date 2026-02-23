// AI Generation Service
// Handles product description generation using Claude with RAG

import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateEmbedding } from './chunking-service'
import { scrapeMultipleCompetitorContents, aggregateCompetitorContent } from './competitor-content-scraper'

/**
 * Get Anthropic client - must be created at runtime, not module level
 * This ensures environment variables are properly loaded in Next.js
 */
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables')
  }
  
  // Explicitly set baseURL to ensure we're hitting the correct Anthropic endpoint
  // NOT Bedrock, NOT Vertex, NOT a proxy - the direct Anthropic API
  const client = new Anthropic({
    apiKey: apiKey,
    baseURL: 'https://api.anthropic.com', // Explicit endpoint - ChatGPT's suggestion #1
    defaultHeaders: {
      'anthropic-version': '2023-06-01', // Required header - ChatGPT's suggestion #2
      'content-type': 'application/json' // Explicit content type
    }
  })
  
  console.log(`[ANTHROPIC CLIENT] Created with baseURL: https://api.anthropic.com`)
  console.log(`[ANTHROPIC CLIENT] API Key format: ${apiKey.startsWith('sk-ant-') ? 'Valid' : 'INVALID'}`)
  console.log(`[ANTHROPIC CLIENT] API Key length: ${apiKey.length}`)
  
  return client
}

export interface GenerationOptions {
  useSourceMaterials?: boolean // Use RAG with source materials
  temperature?: number // 0.0-1.0, default 0.7
  maxTokens?: number // Default 8000 (increased for comprehensive descriptions)
  language?: string // 'hu' or 'en', default 'hu'
  generationInstructions?: string // Custom instructions for generation
  useSearchConsoleQueries?: boolean // Use Search Console queries for optimization
  useCompetitorContent?: boolean // Use competitor content scraping (default: false for speed)
  searchQueries?: Array<{ query: string; impressions: number; clicks: number; ctr: number; position: number }> // Top search queries
}

export interface GeneratedDescription {
  description: string
  wordCount: number
  tokensUsed: number
  modelUsed: string
  sourceMaterialsUsed: string[]
  productType?: string
  validationWarnings?: string[]
  searchQueriesUsed?: Array<{ query: string; impressions: number; clicks: number }> // Queries used for optimization
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
 * Build context from source materials, chunks, search queries, competitor insights, and categories
 * Returns context string and metadata about categories/products for linking
 */
async function buildContext(
  supabase: any,
  product: any,
  sourceMaterials: any[],
  relevantChunks: any[],
  searchQueries?: Array<{ query: string; impressions: number; clicks: number; ctr: number; position: number }>,
  competitorContentInsights?: {
    allKeywords: string[]
    allKeyPhrases: string[]
    commonFeatures: string[]
    commonBenefits: string[]
    contentStructureInsights: string[]
  } | null,
  parentProduct?: any | null
): Promise<{ context: string; categories: any[]; relatedProducts: any[] }> {
  let context = `\n\nPRODUCT INFORMATION:\n`
  context += `- SKU: ${product.sku}\n`
  context += `- Name: ${product.name || 'N/A'}\n`
  
  // Helper function to format attribute value
  const formatAttributeValue = (attr: any): string => {
    if (!attr || attr.value === null || attr.value === undefined) {
      return 'N/A'
    }
    
    if (attr.type === 'LIST' && Array.isArray(attr.value)) {
      // LIST attributes have array of values with language objects
      const values = attr.value
        .map((val: any) => {
          if (typeof val === 'object' && val.value !== null && val.value !== undefined) {
            return String(val.value)
          } else if (typeof val === 'string') {
            return val
          }
          return null
        })
        .filter((v: any) => v !== null && v !== '')
      
      if (values.length > 0) {
        return values.join(', ')
      }
      return 'N/A'
    } else if (attr.type === 'TEXT' && Array.isArray(attr.value)) {
      // TEXT attributes also have array structure
      const values = attr.value
        .map((val: any) => {
          if (typeof val === 'object' && val.value !== null && val.value !== undefined) {
            return String(val.value)
          } else if (typeof val === 'string') {
            return val
          }
          return null
        })
        .filter((v: any) => v !== null && v !== '')
      
      if (values.length > 0) {
        return values.join(', ')
      }
      return 'N/A'
    } else if (attr.value !== null && attr.value !== undefined) {
      // INTEGER, FLOAT attributes have single value
      return String(attr.value)
    }
    return 'N/A'
  }
  
  // Include product attributes (for BOTH parent and child products)
  console.log(`[AI GENERATION] Checking product attributes for ${product.sku}:`, {
    hasAttributes: !!product.product_attributes,
    isArray: Array.isArray(product.product_attributes),
    isNull: product.product_attributes === null,
    isUndefined: product.product_attributes === undefined,
    type: typeof product.product_attributes,
    length: product.product_attributes?.length,
    firstAttribute: product.product_attributes?.[0]
  })
  
  if (product.product_attributes && Array.isArray(product.product_attributes) && product.product_attributes.length > 0) {
    context += `\n\n=== PRODUCT ATTRIBUTES (THIS PRODUCT) ===\n`
    let attributeCount = 0
    product.product_attributes.forEach((attr: any, index: number) => {
      // Check if attribute has a valid value
      const hasValue = attr && (
        (attr.value !== null && attr.value !== undefined) ||
        (Array.isArray(attr.value) && attr.value.length > 0)
      )
      
      if (hasValue) {
        const displayName = attr.display_name || attr.name || 'N/A'
        const value = formatAttributeValue(attr)
        const prefix = attr.prefix ? `${attr.prefix} ` : ''
        const postfix = attr.postfix ? ` ${attr.postfix}` : ''
        context += `- ${displayName}: ${prefix}${value}${postfix}\n`
        attributeCount++
        console.log(`[AI GENERATION] Added attribute ${index + 1}: ${displayName} = ${value}`)
      } else {
        console.log(`[AI GENERATION] Skipping attribute ${index + 1} (${attr?.name || 'unknown'}) - no valid value:`, attr)
      }
    })
    if (attributeCount > 0) {
      console.log(`[AI GENERATION] Successfully added ${attributeCount} product attributes to context for ${product.sku}`)
    } else {
      console.warn(`[AI GENERATION] No valid attributes found (all had null/undefined/empty values) for ${product.sku}`)
    }
  } else {
    console.warn(`[AI GENERATION] No product attributes found for ${product.sku}. Reason:`, {
      isNull: product.product_attributes === null,
      isUndefined: product.product_attributes === undefined,
      isArray: Array.isArray(product.product_attributes),
      isEmptyArray: Array.isArray(product.product_attributes) && product.product_attributes.length === 0,
      type: typeof product.product_attributes,
      value: typeof product.product_attributes === 'string' ? product.product_attributes.substring(0, 200) : product.product_attributes
    })
  }
  
  // Include parent product attributes if this is a child product
  if (parentProduct && parentProduct.product_attributes && Array.isArray(parentProduct.product_attributes) && parentProduct.product_attributes.length > 0) {
    context += `\n\n=== PARENT PRODUCT ATTRIBUTES (INHERITED FROM PARENT: ${parentProduct.sku}) ===\n`
    context += `These attributes are shared by all variants of the parent product. Include these in your description as they apply to this variant as well.\n\n`
    parentProduct.product_attributes.forEach((attr: any) => {
      if (attr.value !== null && attr.value !== undefined) {
        const displayName = attr.display_name || attr.name || 'N/A'
        const value = formatAttributeValue(attr)
        const prefix = attr.prefix ? `${attr.prefix} ` : ''
        const postfix = attr.postfix ? ` ${attr.postfix}` : ''
        context += `- ${displayName}: ${prefix}${value}${postfix}\n`
      }
    })
    context += `\nIMPORTANT: When writing the description, include both:\n`
    context += `1. Attributes from the parent product (shared by all variants)\n`
    context += `2. Attributes specific to this variant (from THIS PRODUCT above)\n`
    context += `This ensures the description is comprehensive and includes all relevant product information.\n`
  }
  
  // Get product categories for internal linking
  const { data: categoryRelations, error: categoryError } = await supabase
    .from('shoprenter_product_category_relations')
    .select(`
      shoprenter_categories(
        id,
        name,
        url_slug,
        category_url,
        shoprenter_category_descriptions(name, description)
      )
    `)
    .eq('product_id', product.id)
    .is('deleted_at', null)
  
  if (categoryError) {
    console.warn(`[AI GENERATION] Error fetching categories for product ${product.sku}:`, categoryError)
  }
  
  const categories = (categoryRelations || [])
    .map(rel => rel.shoprenter_categories)
    .filter(Boolean)
  
  console.log(`[AI GENERATION] Found ${categories.length} categories for product ${product.sku}`)
  
  let relatedProducts: any[] = []
  
  if (categories.length > 0) {
    context += `- Categories: ${categories.map((c: any) => c.name || 'N/A').join(', ')}\n`
    
    context += `\n\n=== PRODUCT CATEGORIES (MANDATORY FOR INTERNAL LINKING) ===\n`
    context += `**YOU MUST INCLUDE INTERNAL LINKS TO THESE CATEGORIES IN YOUR DESCRIPTION**\n\n`
    categories.forEach((cat: any, index: number) => {
      const catName = cat.shoprenter_category_descriptions?.[0]?.name || cat.name || 'Kategória'
      const catUrl = cat.category_url || (cat.url_slug ? `https://shopname.shoprenter.hu/${cat.url_slug}` : null)
      const catDescription = cat.shoprenter_category_descriptions?.[0]?.description || ''
      
      context += `Category ${index + 1}: ${catName}\n`
      if (catUrl) {
        context += `  → URL: ${catUrl}\n`
        context += `  → Slug: ${cat.url_slug || 'N/A'}\n`
      } else {
        context += `  → WARNING: No URL available for this category\n`
      }
      if (catDescription) {
        context += `  → Description: ${catDescription.substring(0, 300)}...\n`
      }
      context += `\n`
    })
    context += `**MANDATORY INSTRUCTIONS FOR CATEGORY LINKS:**\n`
    context += `- You MUST include 2-4 internal links to these categories in your description\n`
    context += `- Links MUST use the exact URLs provided above (format: <a href="EXACT_URL">Category Name</a>)\n`
    context += `- Links should appear naturally in the text, not as a list\n`
    context += `- Examples: "További információ a [Category Name] kategóriában", "Részletek: [Category Name]", "Nézd meg a [Category Name] kategóriát"\n`
    context += `- DO NOT skip adding these links - they are required for SEO\n\n`
    
    // Get related products from the same categories (for context and potential linking)
    const categoryIds = categories.map((c: any) => c.id).filter(Boolean)
    if (categoryIds.length > 0) {
      const { data: relatedProductRelations } = await supabase
        .from('shoprenter_product_category_relations')
        .select(`
          shoprenter_products!inner(
            id,
            sku,
            name,
            product_url,
            status,
            shoprenter_product_descriptions(name, description)
          )
        `)
        .in('category_id', categoryIds)
        .neq('product_id', product.id) // Exclude current product
        .is('deleted_at', null)
        .is('shoprenter_products.deleted_at', null)
        .eq('shoprenter_products.status', 1) // Only active products
        .limit(10) // Limit to 10 related products for context
      
      relatedProducts = (relatedProductRelations || [])
        .map(rel => rel.shoprenter_products)
        .filter(Boolean)
        .filter((p: any) => p.id !== product.id) // Double-check exclude current product
      
      if (relatedProducts.length > 0) {
        console.log(`[AI GENERATION] Found ${relatedProducts.length} related products for product ${product.sku}`)
        
        context += `\n\n=== RELATED PRODUCTS IN SAME CATEGORIES (FOR CONTEXT AND LINKING) ===\n`
        context += `These are other products in the same categories. Use this knowledge to:\n`
        context += `- Understand the product category better\n`
        context += `- Mention related/complementary products naturally\n`
        context += `- **ADD INTERNAL LINKS to related products when contextually relevant**\n\n`
        
        relatedProducts.slice(0, 10).forEach((relatedProduct: any, index: number) => {
          const prodName = relatedProduct.shoprenter_product_descriptions?.[0]?.name || relatedProduct.name || relatedProduct.sku
          const prodUrl = relatedProduct.product_url
          const prodSku = relatedProduct.sku
          
          context += `Related Product ${index + 1}: ${prodName} (SKU: ${prodSku})\n`
          if (prodUrl) {
            context += `  → URL: ${prodUrl}\n`
          } else {
            context += `  → WARNING: No URL available for this product\n`
          }
          if (relatedProduct.shoprenter_product_descriptions?.[0]?.description) {
            context += `  → Description preview: ${relatedProduct.shoprenter_product_descriptions[0].description.substring(0, 150)}...\n`
          }
          context += `\n`
        })
        
        context += `**INSTRUCTIONS FOR RELATED PRODUCT LINKS:**\n`
        context += `- When mentioning complementary products or alternatives, ADD INTERNAL LINKS (1-3 links recommended)\n`
        context += `- Links MUST use exact product URLs provided above (format: <a href="EXACT_URL">Product Name</a>)\n`
        context += `- Examples: "Hasonló termékek: [link]", "Kiegészítő termékek: [link]", "Alternatív megoldások: [link]"\n`
        context += `- Links should be contextually relevant and add value to the reader\n`
        context += `- DO NOT skip adding product links when they make sense contextually\n\n`
      } else {
        console.log(`[AI GENERATION] No related products found for product ${product.sku}`)
      }
    }
  } else {
    context += `- Category: N/A\n`
    console.warn(`[AI GENERATION] No categories found for product ${product.sku} - internal links will not be available`)
    context += `\nNOTE: No product categories found. Internal category links cannot be added.\n`
    context += `To enable internal linking, ensure product-category relations are synced from ShopRenter.\n\n`
  }

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

  if (searchQueries && searchQueries.length > 0) {
    context += `\n\nTOP SEARCH QUERIES FROM GOOGLE SEARCH CONSOLE:\n`
    context += `These are the actual search queries people use to find this product. ` 
    context += `You MUST naturally incorporate these keywords and phrases into the description to improve search rankings.\n\n`
    
    // Sort by impressions (most important) and clicks
    const sortedQueries = [...searchQueries].sort((a, b) => {
      // Prioritize queries with high impressions and clicks
      const scoreA = a.impressions * 0.6 + a.clicks * 0.4
      const scoreB = b.impressions * 0.6 + b.clicks * 0.4
      return scoreB - scoreA
    })
    
    sortedQueries.slice(0, 10).forEach((query, index) => {
      context += `${index + 1}. "${query.query}" - ${query.impressions} megjelenés, ${query.clicks} kattintás, pozíció: ${query.position.toFixed(1)}\n`
    })
    
    context += `\nOPTIMIZATION PRIORITIES:\n`
    const highImpressionsLowCtr = searchQueries.filter(q => q.impressions > 50 && q.ctr < 0.05)
    const goodPosition = searchQueries.filter(q => q.position > 0 && q.position < 10 && q.clicks < 10)
    
    if (highImpressionsLowCtr.length > 0) {
      context += `- Queries with HIGH impressions but LOW CTR (need optimization):\n`
      highImpressionsLowCtr.slice(0, 5).forEach(q => {
        context += `  * "${q.query}" (${q.impressions} megjelenés, ${(q.ctr * 100).toFixed(2)}% CTR)\n`
      })
    }
    
    if (goodPosition.length > 0) {
      context += `- Queries with GOOD position but LOW clicks (optimize title/description):\n`
      goodPosition.slice(0, 5).forEach(q => {
        context += `  * "${q.query}" (pozíció: ${q.position.toFixed(1)}, ${q.clicks} kattintás)\n`
      })
    }
  }

  if (competitorContentInsights) {
    context += `\n\nCOMPETITOR CONTENT ANALYSIS:\n`
    context += `We analyzed competitor product pages to identify keywords and phrases they use. ` 
    context += `Incorporate these naturally into the description to improve SEO ranking and match competitor language.\n\n`
    
    if (competitorContentInsights.allKeywords.length > 0) {
      context += `KEYWORDS USED BY COMPETITORS (incorporate naturally):\n`
      context += competitorContentInsights.allKeywords.slice(0, 15).join(', ') + '\n\n'
    }
    
    if (competitorContentInsights.allKeyPhrases.length > 0) {
      context += `KEY PHRASES FROM COMPETITORS (use these phrases naturally):\n`
      competitorContentInsights.allKeyPhrases.slice(0, 10).forEach((phrase, i) => {
        context += `${i + 1}. "${phrase}"\n`
      })
      context += '\n'
    }
    
    if (competitorContentInsights.commonFeatures.length > 0) {
      context += `FEATURES COMPETITORS EMPHASIZE (mention if relevant):\n`
      competitorContentInsights.commonFeatures.slice(0, 8).forEach((feature, i) => {
        context += `${i + 1}. ${feature}\n`
      })
      context += '\n'
    }
    
    if (competitorContentInsights.commonBenefits.length > 0) {
      context += `BENEFITS COMPETITORS HIGHLIGHT (include if applicable):\n`
      competitorContentInsights.commonBenefits.slice(0, 6).forEach((benefit, i) => {
        context += `${i + 1}. ${benefit}\n`
      })
      context += '\n'
    }
    
    context += `IMPORTANT: Use these competitor insights to:\n`
    context += `- Match their keyword usage (but write better, more comprehensive content)\n`
    context += `- Ensure we rank for the same search terms they target\n`
    context += `- Differentiate by providing more detailed, valuable information\n`
    context += `- Incorporate phrases naturally - don't keyword stuff\n\n`
  }

  return { context, categories: categories || [], relatedProducts: relatedProducts || [] }
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
      maxTokens = 8000, // Increased to 8000 to allow comprehensive descriptions without cutoff (500-1000 words)
      language = 'hu',
      generationInstructions,
      useSearchConsoleQueries = false, // Set to true to enable Search Console query optimization
      useCompetitorContent = false, // Default to false for speed (can be enabled for better SEO)
      searchQueries
    } = options

  try {
    // 1. Get product data and related data in parallel for speed
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    
    const [
      productResult,
      sourcesResult,
      childrenResult,
      searchQueriesResult
    ] = await Promise.all([
      // Main product
      supabase
        .from('shoprenter_products')
        .select('*')
        .eq('id', productId)
        .single(),
      // Source materials (if enabled)
      useSourceMaterials
        ? supabase
            .from('product_source_materials')
            .select('*')
            .eq('product_id', productId)
            .eq('processing_status', 'processed')
            .order('priority', { ascending: false })
        : Promise.resolve({ data: [] }),
      // Children (to check if parent)
      supabase
        .from('shoprenter_products')
        .select('id, sku, name, model_number, price, product_attributes')
        .eq('parent_product_id', productId)
        .eq('status', 1),
      // Search Console queries (if enabled)
      useSearchConsoleQueries && !searchQueries
        ? supabase
            .from('product_search_queries')
            .select('query, impressions, clicks, ctr, position')
            .eq('product_id', productId)
            .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
            .order('impressions', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] })
    ])

    const { data: product, error: productError } = productResult
    if (productError || !product) {
      throw new Error('Product not found')
    }

    // Parse product_attributes if it's a JSON string (JSONB should be parsed, but sometimes it's a string)
    if (product.product_attributes) {
      if (typeof product.product_attributes === 'string') {
        try {
          product.product_attributes = JSON.parse(product.product_attributes)
          console.log(`[AI GENERATION] Parsed product_attributes JSON string for ${product.sku}`)
        } catch (e) {
          console.warn(`[AI GENERATION] Failed to parse product_attributes JSON for ${product.sku}:`, e)
          product.product_attributes = null
        }
      }
      // Ensure it's an array (sometimes JSONB might return an object)
      if (!Array.isArray(product.product_attributes)) {
        console.warn(`[AI GENERATION] product_attributes is not an array for ${product.sku}, type:`, typeof product.product_attributes)
        product.product_attributes = null
      }
    }

    // 2. Get source materials
    let sourceMaterials: any[] = sourcesResult.data || []
    let relevantChunks: any[] = []

    if (useSourceMaterials && sourceMaterials.length > 0) {
      // 3. Find relevant chunks using semantic search
      const query = `Product description for ${product.sku} ${product.name || ''} cabinet hardware`
      relevantChunks = await findRelevantChunks(supabase, productId, query, 10)
    }

    // 4. Detect product type
    const productType = detectProductType(product.name || '', product.sku || '')
    console.log(`[AI GENERATION] Detected product type: ${productType.type} (confidence: ${productType.confidence})`)

    // 4.5. Check parent-child relationships
    let parentProduct: any = null
    let childProducts: any[] = childrenResult.data || []
    let isParent = false
    let isChild = false
    
    // Check if this is a child product (has parent) - fetch parent in parallel if needed
    if (product.parent_product_id) {
      isChild = true
      const { data: parent } = await supabase
        .from('shoprenter_products')
        .select('id, sku, name, model_number, product_attributes')
        .eq('id', product.parent_product_id)
        .single()
      
      if (parent) {
        // Parse parent product_attributes if it's a JSON string
        if (parent.product_attributes && typeof parent.product_attributes === 'string') {
          try {
            parent.product_attributes = JSON.parse(parent.product_attributes)
            console.log(`[AI GENERATION] Parsed parent product_attributes JSON string for ${parent.sku}`)
          } catch (e) {
            console.warn(`[AI GENERATION] Failed to parse parent product_attributes JSON for ${parent.sku}:`, e)
            parent.product_attributes = null
          }
        }
        // Ensure it's an array
        if (parent.product_attributes && !Array.isArray(parent.product_attributes)) {
          console.warn(`[AI GENERATION] Parent product_attributes is not an array for ${parent.sku}`)
          parent.product_attributes = null
        }
        
        parentProduct = parent
        console.log(`[AI GENERATION] Product is a child/variant of parent: ${parent.sku} (${parent.name})`)
        if (parent.product_attributes && Array.isArray(parent.product_attributes) && parent.product_attributes.length > 0) {
          console.log(`[AI GENERATION] Parent product has ${parent.product_attributes.length} attributes`)
        }
      }
    }
    
    // Check if this is a parent product (has children)
    if (childProducts && childProducts.length > 0) {
      isParent = true
      console.log(`[AI GENERATION] Product is a parent with ${childProducts.length} child variants`)
      
      // Extract variant attributes for better AI context
      const variantAttributes: Record<string, Set<string | number>> = {}
      const variantPrices: number[] = []
      
      childProducts.forEach((child: any) => {
        // Parse child product_attributes if it's a JSON string
        if (child.product_attributes && typeof child.product_attributes === 'string') {
          try {
            child.product_attributes = JSON.parse(child.product_attributes)
          } catch (e) {
            console.warn(`[AI GENERATION] Failed to parse child product_attributes JSON for ${child.sku}:`, e)
            child.product_attributes = null
          }
        }
        
        // Collect prices
        if (child.price) {
          variantPrices.push(parseFloat(child.price))
        }
        
        // Collect attributes
        if (child.product_attributes && Array.isArray(child.product_attributes)) {
          child.product_attributes.forEach((attr: any) => {
            if (!variantAttributes[attr.name]) {
              variantAttributes[attr.name] = new Set()
            }
            
            // Handle different attribute types
            if (attr.type === 'LIST' && Array.isArray(attr.value)) {
              // LIST attributes have array of values with language objects
              attr.value.forEach((val: any) => {
                if (typeof val === 'object' && val.value !== null && val.value !== undefined) {
                  variantAttributes[attr.name].add(String(val.value))
                } else if (typeof val === 'string') {
                  variantAttributes[attr.name].add(val)
                }
              })
            } else if (attr.type === 'TEXT' && Array.isArray(attr.value)) {
              // TEXT attributes also have array structure
              attr.value.forEach((val: any) => {
                if (typeof val === 'object' && val.value !== null && val.value !== undefined) {
                  variantAttributes[attr.name].add(String(val.value))
                } else if (typeof val === 'string') {
                  variantAttributes[attr.name].add(val)
                }
              })
            } else if (attr.value !== null && attr.value !== undefined) {
              // INTEGER, FLOAT attributes have single value
              variantAttributes[attr.name].add(attr.value)
            }
          })
        }
      })
      
      // Convert Sets to sorted arrays for display
      const variantInfo: Record<string, string> = {}
      Object.keys(variantAttributes).forEach(attrName => {
        const values = Array.from(variantAttributes[attrName])
          .sort((a, b) => {
            // Sort numbers numerically, strings alphabetically
            if (typeof a === 'number' && typeof b === 'number') return a - b
            if (typeof a === 'number') return -1
            if (typeof b === 'number') return 1
            return String(a).localeCompare(String(b))
          })
        variantInfo[attrName] = values.join(', ')
      })
      
      // Store variant info for use in prompt
      ;(product as any).variantAttributes = variantInfo
      ;(product as any).variantPriceRange = variantPrices.length > 0
        ? { min: Math.min(...variantPrices), max: Math.max(...variantPrices) }
        : null
      
      // Log variant attributes extracted
      console.log(`[AI GENERATION] Extracted variant attributes from ${childProducts.length} children:`, {
        attributeCount: Object.keys(variantInfo).length,
        attributes: Object.keys(variantInfo),
        variantInfo: variantInfo
      })
      
      if ((product as any).variantPriceRange) {
        console.log(`[AI GENERATION] Variant price range: ${(product as any).variantPriceRange.min} - ${(product as any).variantPriceRange.max} HUF`)
      }
    }
    
    // CRITICAL: For parent products, ensure parent product attributes are ALWAYS included
    // The parent product's own attributes should be in the context (from buildContext)
    // But we also want to make sure they're emphasized in the prompt
    if (isParent && product.product_attributes && Array.isArray(product.product_attributes) && product.product_attributes.length > 0) {
      console.log(`[AI GENERATION] Parent product has ${product.product_attributes.length} attributes - these will be included in description`)
    }

    // 5. Get Search Console queries (already fetched in parallel above)
    let queriesToUse = searchQueries
    if (useSearchConsoleQueries && !queriesToUse && searchQueriesResult.data) {
      if (searchQueriesResult.data.length > 0) {
        queriesToUse = searchQueriesResult.data
        console.log(`[AI GENERATION] Found ${queriesToUse.length} Search Console queries for optimization`)
      } else {
        console.log(`[AI GENERATION] No Search Console queries found - continuing without them`)
      }
    }

    // 5.5. Get competitor links and scrape their content for keyword insights (OPTIONAL - can be disabled for speed)
    let competitorContentInsights: {
      allKeywords: string[]
      allKeyPhrases: string[]
      commonFeatures: string[]
      commonBenefits: string[]
      contentStructureInsights: string[]
    } | null = null
    
    if (useCompetitorContent) {
      try {
        // Fetch competitor links for this product
        let competitorUrls: string[] = []
        
        if (isParent) {
          // For parent products, get competitor links for ALL child products
          console.log(`[AI GENERATION] Fetching competitor links for parent product and ${childProducts.length} children...`)
          
          const childIds = childProducts.map((c: any) => c.id)
          
          // Fetch parent and child links in parallel
          const [parentLinksResult, childLinksResult] = await Promise.all([
            supabase
              .from('competitor_product_links')
              .select('competitor_url, is_active')
              .eq('product_id', productId)
              .eq('is_active', true),
            childIds.length > 0
              ? supabase
                  .from('competitor_product_links')
                  .select('competitor_url, is_active')
                  .in('product_id', childIds)
                  .eq('is_active', true)
              : Promise.resolve({ data: [] })
          ])
          
          if (parentLinksResult.data && parentLinksResult.data.length > 0) {
            competitorUrls.push(...parentLinksResult.data.map((l: any) => l.competitor_url))
          }
          
          if (childLinksResult.data && childLinksResult.data.length > 0) {
            competitorUrls.push(...childLinksResult.data.map((l: any) => l.competitor_url))
          }
        } else {
          // For child/single products, get competitor links for this product
          const { data: links } = await supabase
            .from('competitor_product_links')
            .select('competitor_url, is_active')
            .eq('product_id', productId)
            .eq('is_active', true)
          
          if (links && links.length > 0) {
            competitorUrls = links.map((l: any) => l.competitor_url)
          }
        }
        
        // Remove duplicates
        competitorUrls = Array.from(new Set(competitorUrls))
        
        if (competitorUrls.length > 0) {
          console.log(`[AI GENERATION] Found ${competitorUrls.length} competitor URLs, scraping content (with caching)...`)
          
          // Scrape competitor content (limit to 5 URLs to avoid rate limits, with caching)
          const urlsToScrape = competitorUrls.slice(0, 5)
          const { scrapeMultipleCompetitorContents } = await import('./competitor-content-scraper')
          const competitorContents = await scrapeMultipleCompetitorContents(urlsToScrape, supabase)
          
          // Aggregate content
          const validContents = competitorContents.filter(c => !c.error && c.keywords.length > 0)
          if (validContents.length > 0) {
            const { aggregateCompetitorContent } = await import('./competitor-content-scraper')
            competitorContentInsights = aggregateCompetitorContent(validContents)
            console.log(`[AI GENERATION] Extracted ${competitorContentInsights.allKeywords.length} keywords and ${competitorContentInsights.allKeyPhrases.length} phrases from competitors`)
          }
        } else {
          console.log(`[AI GENERATION] No competitor links found for this product`)
        }
      } catch (competitorError: any) {
        // Fail gracefully - don't break generation if competitor scraping fails
        console.warn(`[AI GENERATION] Competitor content scraping failed (non-fatal):`, competitorError?.message || competitorError)
        // Continue without competitor insights
      }
    } else {
      console.log(`[AI GENERATION] Competitor content scraping disabled (useCompetitorContent=false) - skipping for speed`)
    }

    // 6. Build context (now async to fetch categories)
    const { context, categories, relatedProducts } = await buildContext(supabase, product, sourceMaterials, relevantChunks, queriesToUse, competitorContentInsights, parentProduct)

    // 7. Build prompts with product type awareness
    const systemPrompt = `You are an expert product copywriter specializing in creating authentic, 
human-written product descriptions for cabinet hardware and related products that rank high in search engines and AI search systems.

CRITICAL: PRODUCT DESCRIPTION STRUCTURE (MUST FOLLOW THIS EXACT STRUCTURE):
You MUST follow this exact structure for optimal SEO and AI search ranking. This structure is proven to work best for e-commerce:

**SEO-OPTIMIZED HEADING REQUIREMENTS:**
- Use descriptive, keyword-rich headings that match search intent
- Headings should be 40-60 characters for optimal SEO
- Include primary keywords naturally in headings
- Use proper heading hierarchy: <h2> for main sections, <h3> for subsections
- Headings should be specific and descriptive (not generic)
- Example good heading: <h2>SLIM Duplafalú Fiókoldal DF-A+ - Prémium Minőség</h2>
- Example bad heading: <h2>Termékleírás</h2> (too generic, no keywords)

1. **Introduction/Overview Section** (<h2>Bevezetés</h2> or <h2>Áttekintés</h2>)
   - **CRITICAL**: Heading MUST include the product name and primary keyword
   - Example: <h2>${product.name || product.sku} - Prémium Minőségű Fiókrendszer</h2>
   - 2-3 paragraphs introducing the product
   - Include the main product name and primary keyword in the first paragraph
   - Mention key variant options (if parent product) or specific variant details (if child product)
   - Hook the reader with benefits or unique selling points
   - Use natural Hungarian language, not keyword stuffing

2. **Key Features Section** (<h2>Főbb jellemzők</h2> or <h2>Kiemelt tulajdonságok</h2>)
   - **CRITICAL**: Heading should be keyword-rich, e.g., <h2>Főbb jellemzők és előnyök</h2>
   - 3-5 key features in bullet points or short paragraphs
   - Focus on features that differentiate this product
   - Include technical specifications naturally (dimensions, capacity, material, etc.)
   - Use competitor keywords/phrases naturally if provided
   - **MANDATORY**: Include ALL product attributes from the context (dimensions, materials, capacities, etc.)

3. **Benefits Section** (<h2>Előnyök</h2> or <h2>Miért válassza ezt a terméket?</h2>)
   - **CRITICAL**: Use benefit-focused heading, e.g., <h2>Előnyök és használati lehetőségek</h2>
   - 3-4 main benefits for the customer
   - Focus on user experience and practical advantages
   - Use emotional triggers and practical benefits
   - Connect features to real-world use cases

4. **Specifications/Technical Details Section** (<h2>Specifikációk</h2> or <h2>Technikai adatok</h2>)
   - **CRITICAL**: Heading should be specific, e.g., <h2>Technikai specifikációk és méretek</h2>
   - Detailed technical information
   - **MANDATORY**: Include ALL product attributes from context (dimensions, materials, capacities, load ratings, etc.)
   - Dimensions, materials, capacities, load ratings, etc.
   - Use a table or organized list format
   - Note: ShopRenter automatically creates a parameter table below the description, so focus on explaining specifications, not just listing them

5. **Use Cases/Applications Section** (<h2>Alkalmazási területek</h2> or <h2>Használati lehetőségek</h2>)
   - **CRITICAL**: Use application-focused heading, e.g., <h2>Alkalmazási területek és használat</h2>
   - Where and how this product is used
   - Different application scenarios
   - Compatibility information
   - Installation contexts

6. **Installation/Usage Section** (<h2>Beszerelés</h2> or <h2>Használat</h2>)
   - **CRITICAL**: Use installation-focused heading, e.g., <h2>Beszerelés és használat</h2>
   - Installation requirements and steps (if applicable)
   - Usage tips and best practices
   - Maintenance information
   - Compatibility notes

7. **Conclusion/Summary Section** (<h2>Összefoglalás</h2> or <h2>Összegzés</h2>)
   - **CRITICAL**: Use summary-focused heading, e.g., <h2>Összefoglalás és ajánlás</h2>
   - 1-2 paragraphs summarizing key points
   - Reinforce main benefits and value proposition
   - Call to action or final recommendation
   - Natural closing

8. **Q&A Section** (<h2>Gyakran ismételt kérdések</h2> or <h2>Gyakori kérdések</h2>)
   - **CRITICAL**: Use FAQ-focused heading, e.g., <h2>Gyakran ismételt kérdések (GYIK)</h2>
   - 3-5 relevant questions customers ask
   - Practical questions: installation, compatibility, maintenance, usage
   - Format: <h3>Question</h3> <p>Answer</p>
   - Answers should be helpful and specific

STRUCTURE REQUIREMENTS:
- Use HTML headings (<h2> for main sections, <h3> for subsections/questions)
- **CRITICAL**: All headings MUST be keyword-rich and descriptive (40-60 characters)
- **CRITICAL**: Include primary keywords naturally in headings
- Each section should be 2-4 paragraphs or equivalent content
- Total length: 500-1000 words
- Maintain natural flow between sections
- Use paragraphs, bullet points, and lists appropriately
- Ensure ShopRenter's automatic parameter table complements (not duplicates) your specifications section
- **MANDATORY**: Include ALL product attributes from context in the appropriate sections

**CRITICAL SIZE/DIMENSION LISTING RULE (GLOBAL - APPLIES TO ALL SECTIONS):**
- When listing available sizes from a range attribute (e.g., "Névleges hossz: 300 - 550 mm"), you MUST include the STARTING size in the list
- If a range is "X - Y mm", list ALL sizes: X, X+50, X+100, ... Y (include X, do NOT skip it)
- Example: Range "300 - 550 mm" → List: "300, 350, 400, 450, 500, 550mm" (NOT "350, 400, 450, 500, 550mm")
- This applies to ALL mentions of sizes throughout the description (introduction, features, specifications, FAQ)
- Double-check: If you mention a range, verify the starting size is in your size list
- When you write "300mm-től 550mm-ig", you MUST list "300, 350, 400, 450, 500, 550mm" - never skip 300mm!

**CRITICAL: NO ASSUMPTIONS RULE (GLOBAL - APPLIES TO ALL FEATURES):**
- **DO NOT mention features unless they are 100% confirmed in the product data**
- Only mention features that are EXPLICITLY stated in:
  - Product attributes (from "PRODUCT ATTRIBUTES (THIS PRODUCT)" section)
  - Source materials (if provided)
  - Product context (name, SKU, model number)
- **DO NOT make assumptions** based on:
  - Product type (e.g., "all drawer systems have soft close" - WRONG)
  - Competitor content (competitors may have features this product doesn't)
  - General knowledge (what's typical for this product category)
- **DO NOT describe features as "additional" or "optional"** unless explicitly stated - if a feature is mentioned, it's included/standard
- Example WRONG: "Soft close is an additional feature" when soft close is already standard - if it's mentioned, it's included
- Example WRONG: Assuming a drawer has soft close just because it's a premium drawer system
- Example CORRECT: Only mention "soft close" if it appears in product attributes or source materials
- **If you're not 100% sure about a feature, DO NOT mention it** - it's better to omit than to be incorrect

SEARCH CONSOLE OPTIMIZATION:
- If Search Console queries are provided, you MUST naturally incorporate the top search queries into the description
- Focus on queries with high impressions but low CTR (these need optimization)
- Also prioritize queries with good position but low clicks
- Use exact query phrases naturally - integrate them organically into sentences
- Balance keyword optimization with natural, readable Hungarian text
- The goal is to improve CTR and ranking for actual search queries people use

COMPETITOR KEYWORD INTEGRATION:
- If competitor content analysis is provided, incorporate their keywords and phrases naturally
- Match competitor language patterns but write better, more comprehensive content
- Use competitor phrases organically - don't keyword stuff
- Differentiate by providing more detailed, valuable information than competitors
- Ensure we rank for the same search terms competitors target

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

**CRITICAL HUNGARIAN GRAMMAR RULES - COMMON MISTAKES TO AVOID:**
- **"hol" vs "hova"**: Use "hova" for direction/destination, "hol" for location
  - CORRECT: "Hova illik legjobban?" (Where does it fit best?) or "Hol használható legjobban?" (Where can it be used best?)
  - WRONG: "Hol illik legjobban?" - This is grammatically incorrect
  - CORRECT: "Hol alkalmazható?" (Where can it be applied?) - "hol" is correct here because it's asking about location
  - When asking "where does it fit/go", use "hova". When asking "where is it used/applied", use "hol"
- **Proper question forms**: 
  - "Hova illik?" (Where does it fit?) - direction
  - "Hol használható?" (Where can it be used?) - location
  - "Hol alkalmazható?" (Where can it be applied?) - location
- **Avoid literal translations from English**: Don't translate word-by-word, use natural Hungarian phrasing
- **Use proper Hungarian sentence structure**: Subject-verb-object order, proper case endings
- **Double-check prepositions**: "hova" (where to), "hol" (where), "honnan" (where from)

LOGICAL CONSISTENCY REQUIREMENTS:
1. **Product Type Validation**: Ensure your description matches the product type indicated by the name/SKU
2. **Feature Accuracy - NO ASSUMPTIONS**: 
   - **CRITICAL**: Only mention features that are EXPLICITLY confirmed in the product data (attributes, source materials, context)
   - **DO NOT make assumptions** about features based on product type, competitor content, or general knowledge
   - **DO NOT mention features** unless they are 100% confirmed - if you're not sure, omit it
   - Only mention features that make sense for the product type AND are confirmed in the data:
   - Trash bins: capacity (liters), dimensions, material, lid type, mounting options, sorting compartments - ONLY if explicitly stated
   - Drawer systems: drawer capacity, rail type, installation width, number of drawers, material, finish - ONLY if explicitly stated
   - Hinges: opening angle, mounting type, material, finish, adjustability, soft close - ONLY if explicitly stated
   - Slides: load capacity, extension type, mounting width, material, soft close, installation - ONLY if explicitly stated
   - **DO NOT describe features as "additional" or "optional"** unless explicitly stated - if mentioned, it's included/standard
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

CRITICAL: INTERNAL LINKING REQUIREMENTS (MANDATORY):
**YOU MUST INCLUDE INTERNAL LINKS IN YOUR DESCRIPTION WHEN CATEGORIES OR RELATED PRODUCTS ARE PROVIDED**

1. **Category Links (MANDATORY when categories are provided):**
   - You MUST include 2-4 internal links to related categories
   - Use format: <a href="EXACT_CATEGORY_URL">Category Name</a>
   - Links should be contextually relevant (e.g., "Részletek a [Category Name] kategóriában", "További információ: [Category Name]")
   - Links MUST use the exact URLs provided in the context above
   - DO NOT skip category links - they are required for SEO
   - Links should appear naturally in paragraphs, not as a list

2. **Product Links (RECOMMENDED when related products are provided):**
   - Include 1-3 internal links to related/complementary products when contextually relevant
   - Product link format: <a href="EXACT_PRODUCT_URL">Product Name</a>
   - Product links should be natural (e.g., "Hasonló termékek: [link]", "Kiegészítő termékek: [link]", "Alternatív megoldások: [link]")
   - Links MUST use the exact product URLs provided in the context above
   - Only add product links when they make contextual sense

3. **Link Placement:**
   - Links should appear naturally in the text, not as a separate list
   - Integrate links into sentences and paragraphs
   - Balance category links and product links - don't use all of one type
   - Place links where they add value to the reader

4. **URL Format:**
   - Use EXACT URLs as provided in the context (do not modify or construct URLs)
   - If a URL is provided, use it exactly as shown
   - If no URL is provided for a category/product, skip linking to that item

**REMINDER: Internal linking is critical for SEO. When categories or related products are provided in the context, you MUST include links to them in your description.**

CRITICAL: COMPLETION REQUIREMENTS:
1. **ALWAYS complete the description fully** - never cut off mid-sentence or mid-section
2. **ALWAYS end with TWO sections in this order:**
   a. **Conclusion/Summary section** - use "Összefoglalás" or "Összegzés" heading
   b. **Q&A section** - use "Gyakran ismételt kérdések" or "Gyakori kérdések" heading with 3-5 relevant questions and answers
3. **NEVER leave empty paragraphs** - if you start a section, complete it
4. **ABSOLUTELY NEVER hardcode specific prices** - DO NOT mention exact prices like "6 800 Ft", "71 840 Ft", etc.
5. **NEVER mention price ranges** - DO NOT say "6 800 és 7 700 Ft közötti áron"
6. **If price must be mentioned, use ONLY relative terms** - "versenyképes áron", "kedvező árazás", "prémium minőség, ésszerű áron", "jó ár-érték arány"
7. **Q&A section requirements:**
   - Include 3-5 relevant questions customers would ask about this product
   - Questions should be practical: installation, compatibility, maintenance, usage, etc.
   - Answers should be helpful and specific
   - Format: Use <h3> for questions, <p> for answers
   - Example format:
     <h3>Milyen szekrénymélységhez alkalmas?</h3>
     <p>Válasz szövege...</p>

SPELLING AND TERMINOLOGY:
1. **Common correct spellings**:
   - "gránitkompozit" (NOT "gránitkompoziit")
   - "szekrény" (NOT "szekreny")
   - "csukló" (NOT "csuklo")
   - "fiók" (NOT "fiok")
   - "csúszka" (NOT "csukszka")
2. **Double-check technical terms** before finalizing
3. **Use proper Hungarian compound words** - check spelling of technical terms

FACT-CHECKING BEFORE RESPONSE:
Before you write the description, ask yourself:
1. What product type is this? (trash bin, drawer, hinge, etc.)
2. What features make sense for this product type?
3. Are the dimensions interpreted correctly?
4. Is the installation method appropriate?
5. Does every sentence logically fit this product type?

If you're unsure about the product type, focus on what you KNOW from the name/SKU and source materials, 
and avoid making assumptions about features that don't match the product type.

FINAL QUALITY CHECK - BEFORE SUBMITTING:
1. ✅ Is the description complete? (No cut-off sections, no empty paragraphs, no mid-sentence stops)
2. ✅ Does it end with TWO sections: (1) Conclusion/Summary ("Összefoglalás" or "Összegzés") AND (2) Q&A section ("Gyakran ismételt kérdések" or "Gyakori kérdések")?
3. ✅ Does the Q&A section have 3-5 relevant questions with helpful answers?
4. ✅ Are all technical terms spelled correctly? (gránitkompozit, not gránitkompoziit)
5. ✅ Are there NO hardcoded prices? (No "6 800 Ft", "71 840 Ft", "6 800 és 7 700 Ft közötti áron" - ONLY relative terms like "versenyképes áron")
6. ✅ Is the entire description in Hungarian with proper grammar?
7. ✅ Does every section make logical sense for the product type?
8. ✅ If this is a PARENT product: Did you mention ALL variants together, not highlight a single specific variant?

**CRITICAL: Your response MUST be complete. Do not stop mid-sentence or mid-section. Always include:**
- A FULL conclusion/summary section ("Összefoglalás" or "Összegzés")
- A FULL Q&A section ("Gyakran ismételt kérdések" or "Gyakori kérdések") with 3-5 questions
- Check that your last sentence is complete before submitting
- ABSOLUTELY NO hardcoded prices - use only relative terms

Write ONLY the product description in Hungarian. Do not include meta tags, titles, or other fields.`

    const userPrompt = `Generate a product description for:
${product.name || product.sku} (SKU: ${product.sku})

DETECTED PRODUCT TYPE: ${productType.type} (${productType.description})
- Based on the name "${product.name || product.sku}", this appears to be a: ${productType.description}
- Confidence level: ${productType.confidence}
- Expected features for this product type: ${productType.features.join(', ')}
- **CRITICAL**: Ensure your description matches this product type exactly
- **DO NOT** confuse it with other product types (e.g., don't describe a trash bin as a drawer system)

${isParent ? `
**PARENT PRODUCT WITH VARIANTS:**
- This is a PARENT product with ${childProducts.length} child variants available
- Child variants: ${childProducts.map(c => `${c.sku} (${c.name || c.model_number || 'N/A'})`).join(', ')}

**CRITICAL: PARENT PRODUCT ATTRIBUTES MUST BE INCLUDED**
- The parent product's own attributes are provided in the context above under "PRODUCT ATTRIBUTES (THIS PRODUCT)"
- **YOU MUST include ALL parent product attributes in the description** (dimensions, materials, capacities, load ratings, etc.)
- These attributes apply to ALL variants and are essential product information
- **CRITICAL FOR SIZE/DIMENSION ATTRIBUTES**: If the parent product has size/dimension attributes (e.g., "meret", "fiok_hossz", "Névleges hossz"), these are the SOURCE OF TRUTH for available sizes
- Example: If parent has "Névleges hossz: 300 - 550 mm", then ALL sizes from 300mm to 550mm are available, even if not all child variants exist
- Example: If parent has "Méret: 300", mention "300mm" as an available size option
- Include them in the "Specifications/Technical Details" section and mention them naturally throughout
- Example: If parent has "Méret: 300mm", mention "300mm szélességű" or "300mm méretben elérhető" in the description
- Example: If parent has "Teherbírás: 35 kg", mention "35 kg teherbírás" in features/benefits sections

${(product as any).variantAttributes && Object.keys((product as any).variantAttributes).length > 0 ? `
**VARIANT ATTRIBUTES (What makes variants different - SUPPLEMENTARY INFO ONLY):**
${Object.entries((product as any).variantAttributes).map(([attrName, values]) => {
  // Translate common attribute names to Hungarian
  const attrNames: Record<string, string> = {
    'size': 'Méret',
    'color': 'Szín',
    'weight': 'Súly',
    'teherbírás': 'Teherbírás',
    'width': 'Szélesség',
    'height': 'Magasság',
    'depth': 'Mélység',
    'capacity': 'Kapacitás',
    'szin': 'Szín',
    'meret': 'Méret'
  }
  const huName = attrNames[attrName.toLowerCase()] || attrName
  return `- ${huName}: ${values}`
}).join('\n')}
- **IMPORTANT**: These variant attributes are extracted from existing child products, but they may not represent ALL available options
- **CRITICAL**: For size/dimension information, ALWAYS use the parent product's own attributes (from "PRODUCT ATTRIBUTES (THIS PRODUCT)" above) as the SOURCE OF TRUTH
- If parent has "Névleges hossz: 300 - 550 mm", then mention ALL sizes from 300mm to 550mm, not just the sizes found in child variants
- **CRITICAL SIZE LISTING RULE**: When listing available sizes from a range (e.g., "300 - 550 mm"), you MUST include the STARTING size (300mm) in the list
- Example CORRECT: "300mm-től 550mm-ig terjedő hosszban érhető el (300, 350, 400, 450, 500 és 550 mm-es változatokban)"
- Example WRONG: "300mm-től 550mm-ig terjedő hosszban érhető el (350, 400, 450, 500 és 550 mm-es változatokban)" - MISSING 300mm!
- If parent has "Méret: 300", then 300mm IS available and must be mentioned
- **CRITICAL**: Mention ALL variant options together, NOT just one specific variant
- **DO NOT highlight a single color/variant** - talk about all colors/variants as a group
- Example for colors: "A termék több színben elérhető: fekete, fehér, szürke és barna kivitelben" (NOT "fekete gránit mosogató")
- Example for sizes: "A termék több méretben elérhető: 300mm, 350mm, 400mm, 450mm, 500mm, 550mm" (use parent's "Névleges hossz" or "Méret" attribute, not just child variants)
- Write as if describing the product family, not a specific variant
` : `
**NOTE: No variant attributes extracted from children. This may indicate children don't have attributes or they need to be synced.**
`}

${(product as any).variantPriceRange ? `
**PRICE RANGE:**
- Variants range from ${(product as any).variantPriceRange.min} HUF to ${(product as any).variantPriceRange.max} HUF
- Mention the price range naturally in the description
` : ''}

- **CRITICAL FOR PARENT PRODUCTS**: 
  - Write the description as if this is the MAIN product page for the ENTIRE product family
  - **NEVER highlight a single specific variant** (e.g., don't say "fekete gránit mosogató" if there are multiple colors)
  - **ALWAYS mention all variants together** (e.g., "fekete, fehér, szürke és barna színben elérhető")
  - Use phrases like: "több színben/méretben elérhető", "különböző változatok", "több opció közül választhat"
  - Focus on the general product features and benefits that apply to ALL variants
  - Mention that customers can choose from different sizes/colors/variants
  - DO NOT write as if this is a specific variant - write as the main product family
  - If you mention colors, mention ALL available colors, not just one
  - If you mention sizes, mention ALL available sizes, not just one
  - **MANDATORY**: Include ALL parent product attributes from context in the description
` : ''}

${isChild && parentProduct ? `
**CHILD/VARIANT PRODUCT:**
- This is a VARIANT/CHILD product of the parent: ${parentProduct.sku} (${parentProduct.name || parentProduct.model_number || 'N/A'})
- **IMPORTANT**: Write the description focusing on THIS SPECIFIC VARIANT
- Highlight what makes THIS variant unique (size, color, specific dimensions, etc.)
- Reference the parent product naturally: "Ez a ${parentProduct.name || parentProduct.sku} termék egyik változata"
- Focus on the specific variant's features and benefits
- Mention the variant-specific details (e.g., "40kg teherbírású változat", "fekete színű", "400mm szélességű")
- Make it clear this is a specific option within a product family
- **CRITICAL**: Include BOTH parent product attributes (shared by all variants) AND this variant's specific attributes in the description
- The parent product attributes are provided in the context above - use them to provide comprehensive product information
- Combine parent attributes (general product features) with variant-specific attributes (what makes this variant unique)
` : ''}

${context}

CRITICAL REQUIREMENTS:

1. **Product Type Accuracy**: 
   - This is a ${productType.description} (${productType.type})
   - Write ONLY about features relevant to ${productType.type}s
   - If this is a trash bin, focus on: capacity, dimensions, material, mounting, sorting features
   - If this is a drawer system, focus on: drawer capacity, rails, installation width, number of drawers
   - If this is a hinge, focus on: opening angle, mounting, adjustability
   - DO NOT mix features from different product types

2. **Product Attributes Inclusion (MANDATORY)**: 
   - **CRITICAL**: ALL product attributes from the context MUST be included in the description
   - For PARENT products: Include ALL parent product attributes (dimensions, materials, capacities, load ratings, etc.)
   - **CRITICAL FOR SIZE ATTRIBUTES**: For size/dimension attributes (e.g., "meret", "fiok_hossz", "Névleges hossz"), use the parent product's OWN attributes as the SOURCE OF TRUTH
   - **CRITICAL SIZE LISTING RULE**: When a range is given (e.g., "Névleges hossz: 300 - 550 mm"), you MUST include the STARTING size (300mm) when listing available sizes
   - If parent has "Névleges hossz: 300 - 550 mm", mention ALL sizes from 300mm to 550mm (300, 350, 400, 450, 500, 550mm) - DO NOT skip 300mm!
   - **ALWAYS include the starting size**: If range is "300 - 550 mm", list "300, 350, 400, 450, 500, 550mm" - NOT "350, 400, 450, 500, 550mm"
   - If parent has "Méret: 300", then 300mm IS available and must be mentioned
   - Do NOT rely only on variant attributes extracted from children - they may not represent all available options
   - Attributes are provided in the "PRODUCT ATTRIBUTES (THIS PRODUCT)" section above
   - Include attributes naturally in the "Specifications/Technical Details" section
   - Also mention key attributes in the "Key Features" and "Benefits" sections
   - Example: If "Méret: 300" is in attributes, mention "300mm szélességű" or "300mm méretben elérhető"
   - Example CORRECT: If "Névleges hossz: 300 - 550 mm" is in attributes, mention "300mm-től 550mm-ig terjedő hosszban érhető el (300, 350, 400, 450, 500 és 550 mm-es változatokban)"
   - Example WRONG: "300mm-től 550mm-ig terjedő hosszban érhető el (350, 400, 450, 500 és 550 mm-es változatokban)" - This is INCORRECT because 300mm is missing!
   - Example: If "Teherbírás: 35 kg" is in attributes, mention "35 kg teherbírás" in features
   - DO NOT skip any attributes - they are essential product information

3. **Dimension Accuracy**: 
   - Interpret "H400" as height 400mm (magasság 400mm)
   - Interpret "400-tól" as minimum width 400mm (minimum szélesség 400mm-tól)
   - Interpret "13L" as 13 liters capacity (13 liter kapacitás)
   - Include these dimensions in the description if present in the product name or attributes

4. **Feature Accuracy - NO ASSUMPTIONS RULE**: 
   - **CRITICAL**: Only mention features that are EXPLICITLY stated in the product attributes or context provided
   - **DO NOT make assumptions** about features based on product type, competitor content, or general knowledge
   - **DO NOT mention features** unless they are 100% confirmed in the product data (attributes, source materials, or context)
   - Example WRONG: Saying "soft close is an additional feature" when soft close is already included/standard - if it's not explicitly mentioned, don't assume it's optional
   - Example WRONG: Assuming a drawer system has soft close just because it's a drawer system - only mention if explicitly stated
   - Example CORRECT: Only mention "soft close" if it appears in product attributes, source materials, or context
   - If you're not 100% sure about a feature, DO NOT mention it - it's better to omit than to be wrong
   - Only mention features that exist for ${productType.type}s AND are confirmed in the product data
   - Trash bins: capacity, material, lid, mounting (under-sink, wall-mounted), sorting compartments - ONLY if explicitly stated
   - Drawer systems: drawer capacity, rail type, installation width, number of drawers - ONLY if explicitly stated
   - Hinges: opening angle, mounting type, adjustability, soft close - ONLY if explicitly stated
   - DO NOT mention features that don't apply (e.g., rails for trash bins, capacity for hinges)
   - **MANDATORY**: Use the product attributes from context to ensure accuracy - if it's not in attributes, don't assume it exists

5. **Logical Consistency**: 
   - Every sentence must make logical sense for a ${productType.type}
   - Installation method must match the product type
   - Use cases must match the product type
   - Benefits must match the product type
   - **MANDATORY**: All attributes mentioned must match the product type

6. **Language Requirement - Proper Hungarian Grammar**:
   - Write EXCLUSIVELY in Hungarian - this is mandatory
   - Translate all information from source materials to Hungarian
   - Use Hungarian terminology and expressions
   - Write naturally in Hungarian, not as a translation
   - No English words except brand names or universally used technical terms
   - **CRITICAL GRAMMAR RULES**:
     - Use "hova" for direction/destination questions (e.g., "Hova illik legjobban?" NOT "Hol illik legjobban?")
     - Use "hol" for location questions (e.g., "Hol használható?" "Hol alkalmazható?")
     - Avoid literal translations - use natural Hungarian phrasing
     - Check prepositions: "hova" (where to), "hol" (where), "honnan" (where from)
     - Use proper Hungarian sentence structure and case endings

7. **Search Console Query Optimization** (CRITICAL):
${queriesToUse && queriesToUse.length > 0 ? `
   - The following search queries are what people ACTUALLY use to find this product:
   - You MUST naturally incorporate these keywords and phrases into the description
   - Focus especially on queries with HIGH impressions but LOW CTR (these need optimization)
   - Also prioritize queries with GOOD position but LOW clicks (title/description optimization needed)
   - Use the exact query phrases naturally - don't force them, but make sure they appear organically
   - If a query is "strongmax fiókrendszer", naturally use "StrongMax fiókrendszer" in the description
   - If a query is "40kg teherbírás", mention "40 kg teherbírás" naturally
   - Balance: Include query keywords but maintain natural, readable Hungarian text
   - DO NOT keyword stuff - integrate queries naturally into sentences and paragraphs
   - The goal is to improve CTR and ranking for these actual search queries
` : `
   - No Search Console queries available - optimize for general Hungarian search terms
   - Use relevant industry keywords naturally (fiókrendszer, csukló, csúszka, stb.)
`}

8. **Competitor Content Integration** (CRITICAL):
${competitorContentInsights ? `
   - Competitor content analysis has been provided showing keywords, phrases, features, and benefits competitors use
   - You MUST incorporate competitor keywords and phrases naturally throughout the description
   - Match competitor language patterns but write BETTER, more comprehensive content
   - Use competitor phrases organically - integrate them into natural sentences
   - Differentiate by providing more detailed, valuable information than competitors
   - Ensure we rank for the same search terms competitors target
   - Focus on competitor key phrases in the Introduction, Features, and Benefits sections
   - DO NOT copy competitor content - use their keywords to write superior content
   - If competitors have separate URLs for each variant (child products), aggregate their keywords for parent product descriptions
` : `
   - No competitor content analysis available - write based on product information and source materials
`}

9. **Content Quality**:
   - Make it sound like it was written by a knowledgeable Hungarian expert
   - Include specific details from the source materials above (translated to Hungarian)
   - Optimize for Hungarian search engines without keyword stuffing
   - Write naturally in Hungarian - avoid AI detection patterns
   - Include emotional triggers and benefits in Hungarian
   - Make it unique compared to competitors (better, more detailed)
   - Length: 500-1000 words (distributed across all 8 sections)
   - Structure: Follow the exact 8-section structure defined above
   - Use varied sentence lengths (short, medium, long)
   - Include rhetorical questions: "Mire figyeljünk?" "Miért válasszuk ezt?"
   - Add personal voice: "én", "mi", "tapasztalat" occasionally

10. **ShopRenter Integration Note**:
   - ShopRenter automatically creates a parameter table below the description based on product attributes
   - Your "Specifications" section should EXPLAIN and CONTEXTUALIZE the technical data, not just list it
   - Focus on benefits, use cases, and explanations rather than raw data
   - The parameter table will handle the raw specification listing

${generationInstructions ? `\n\nADDITIONAL GENERATION INSTRUCTIONS (CRITICAL - MUST FOLLOW):
${generationInstructions}

These instructions override or supplement the standard requirements above. Pay special attention to these custom instructions when generating the description.` : ''}

**FINAL REMINDER - INTERNAL LINKING:**
${categories.length > 0 ? `
- You MUST include 2-4 internal links to the categories provided above
- Use the exact category URLs from the context
- Links should appear naturally in your description
- DO NOT skip adding category links - they are required
` : ''}
${relatedProducts && relatedProducts.length > 0 ? `
- You SHOULD include 1-3 internal links to related products when contextually relevant
- Use the exact product URLs from the context
- Links should appear naturally when mentioning complementary products
` : ''}
${categories.length === 0 && (!relatedProducts || relatedProducts.length === 0) ? `
- No categories or related products available for internal linking
` : ''}

Generate ONLY the description text in HTML format (use <h2>, <h3>, <p>, <ul>, <li>, <a> tags), written entirely in Hungarian, nothing else.`

    // 8. Generate description using Claude
    // Verify API key is set
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables. Please add it to .env.local')
    }

    // Try models in priority order
    // Updated to use new generation model identifiers (claude-sonnet-4-6, etc.)
    // These are the correct model names for accounts with new generation access
    const modelsToTry = [
      'claude-sonnet-4-6',              // Default: good quality/price balance
      'claude-opus-4-6',                // Max quality option
      'claude-haiku-4-5-20251001',      // Cheap/fast fallback
      'claude-sonnet-4-5-20250929',     // Older fallback option
      'claude-sonnet-4-20250514'        // Older fallback option
    ]

    // Skip pre-flight test - models are "Active" in console, so they should work
    // Go straight to trying models with exact version identifiers

    let message: any = null
    let modelUsed = ''
    let lastError: any = null

    // Create Anthropic client at runtime (not module level)
    // DO THIS BEFORE ANY OTHER OPERATIONS to ensure API key is loaded
    console.log(`[AI GENERATION] Creating Anthropic client...`)
    console.log(`[AI GENERATION] API Key exists: ${!!process.env.ANTHROPIC_API_KEY}`)
    console.log(`[AI GENERATION] API Key length: ${process.env.ANTHROPIC_API_KEY?.length || 0}`)
    
    let anthropic: Anthropic
    try {
      anthropic = getAnthropicClient()
      console.log(`[AI GENERATION] Anthropic client created successfully`)
    } catch (clientError: any) {
      console.error(`[AI GENERATION] Failed to create Anthropic client:`, clientError)
      throw new Error(`Failed to initialize Anthropic client: ${clientError.message}`)
    }
    
    for (const model of modelsToTry) {
      try {
        console.log(`[AI GENERATION] Trying model: ${model}`)
        console.log(`[AI GENERATION] Request details:`, {
          endpoint: 'https://api.anthropic.com/v1/messages',
          model: model,
          max_tokens: maxTokens,
          has_system_prompt: !!systemPrompt,
          system_prompt_length: systemPrompt?.length || 0,
          user_prompt_length: userPrompt?.length || 0
        })
        
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
        const errorMessage = err?.message || err?.error?.message || 'Unknown error'
        const errorType = err?.error?.type || err?.type || 'unknown'
        const statusCode = err?.status || err?.statusCode || err?.response?.status
        
        console.error(`[AI GENERATION] Model ${model} failed:`, {
          model,
          error: errorMessage,
          type: errorType,
          status: statusCode,
          fullError: err
        })
        
        // If it's a 401/403, it's an auth issue - stop trying
        if (statusCode === 401 || statusCode === 403) {
          console.error(`[AI GENERATION] Authentication error - stopping model attempts`)
          throw new Error(`Anthropic API authentication failed (${statusCode}). Please check your ANTHROPIC_API_KEY environment variable. Error: ${errorMessage}`)
        }
        
        // If it's a 404, the model doesn't exist - try next
        // If it's a 429, rate limit - stop trying
        if (statusCode === 429) {
          console.error(`[AI GENERATION] Rate limit error - stopping model attempts`)
          throw new Error(`Anthropic API rate limit exceeded. Please try again later. Error: ${errorMessage}`)
        }
        
        // Continue to next model
        continue
      }
    }

    if (!message) {
      const lastErrorMsg = lastError?.message || lastError?.error?.message || 'Unknown error'
      const lastErrorType = lastError?.error?.type || lastError?.type || 'unknown'
      const lastStatus = lastError?.status || lastError?.statusCode
      
      // Provide helpful error message based on error type
      if (lastErrorType === 'not_found_error' || lastStatus === 404) {
        const diagnosticInfo = `
🔍 DIAGNOSTIC INFORMATION:
- API Key Format: ${process.env.ANTHROPIC_API_KEY ? 'Valid format' : 'NOT SET'}
- API Key Length: ${process.env.ANTHROPIC_API_KEY?.length || 0} characters
- API Key Preview: ${process.env.ANTHROPIC_API_KEY ? `${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...${process.env.ANTHROPIC_API_KEY.substring(process.env.ANTHROPIC_API_KEY.length - 10)}` : 'N/A'}
- Last Error: ${lastErrorMsg}
- Status Code: ${lastStatus}

⚠️  All Claude models returned 404. This usually means:
1. Your API key doesn't have access to Claude models (check Anthropic console)
2. Your account needs billing/credits set up
3. The API key was revoked or expired
4. Account was downgraded or model access was removed

✅ WHAT TO CHECK:
1. Visit https://console.anthropic.com/ and verify:
   - Account has credits/billing configured
   - API key is active and not revoked
   - Account has access to Claude models
2. Try creating a new API key
3. Test the API key directly with curl:
   curl https://api.anthropic.com/v1/messages \\
     -H "x-api-key: YOUR_KEY" \\
     -H "anthropic-version: 2023-06-01" \\
     -H "content-type: application/json" \\
     -d '{"model": "claude-3-haiku-20240307", "max_tokens": 10, "messages": [{"role": "user", "content": "hi"}]}'
        `
        throw new Error(`All Claude models are unavailable (404 errors).${diagnosticInfo}`)
      }
      
      throw new Error(`All Claude models failed. Last error: ${lastErrorMsg} (Status: ${lastStatus})`)
    }

    const description = message.content[0].type === 'text' 
      ? message.content[0].text 
      : ''

    // Check if response was cut off due to token limit
    const stopReason = (message as any).stop_reason || (message as any).stopReason
    const wasCutOff = stopReason === 'max_tokens' || stopReason === 'length'
    
    if (wasCutOff) {
      console.warn(`[AI GENERATION] WARNING: Response was cut off due to token limit (stop_reason: ${stopReason})`)
      console.warn(`[AI GENERATION] Description length: ${description.length} chars, Word count: ${description.split(/\s+/).length}`)
      console.warn(`[AI GENERATION] Consider increasing maxTokens (current: ${maxTokens})`)
    }

    // 9. Validate description for logical consistency and completeness
    const validation = validateDescription(description, product.name || product.sku, productType)
    
    // Add warning if response was cut off
    if (wasCutOff) {
      validation.warnings.push('⚠️ A leírás a token limit miatt le lett vágva. Érdemes növelni a maxTokens értékét vagy rövidebb leírást kérni.')
    }
    
    // Check for incomplete endings (cut-off sentences, empty paragraphs at end)
    const trimmedDescription = description.trim()
    const endsWithIncomplete = 
      trimmedDescription.endsWith('<p></p>') ||
      trimmedDescription.endsWith('<li><p>') ||
      trimmedDescription.endsWith('<li><p>✅</p></li>') ||
      trimmedDescription.match(/<h[1-6]>[^<]*$/) || // Heading without closing tag
      trimmedDescription.match(/<p>[^<]*$/) || // Paragraph without closing tag
      trimmedDescription.match(/<li>[^<]*$/) // List item without closing tag
    
    if (endsWithIncomplete && !wasCutOff) {
      validation.warnings.push('⚠️ A leírás hiányosnak tűnik - lehet, hogy a válasz le lett vágva.')
    }
    
    if (validation.warnings.length > 0) {
      console.warn(`[AI GENERATION] Validation warnings for ${product.sku}:`, validation.warnings)
    }

    // 10. Calculate metrics
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
      validationWarnings: validation.warnings.length > 0 ? validation.warnings : undefined,
      searchQueriesUsed: queriesToUse && queriesToUse.length > 0 
        ? queriesToUse.slice(0, 10).map(q => ({ query: q.query, impressions: q.impressions, clicks: q.clicks }))
        : undefined
    }
  } catch (error) {
    console.error('Error generating description:', error)
    throw new Error(`Description generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
