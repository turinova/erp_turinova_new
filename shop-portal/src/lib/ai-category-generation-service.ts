/**
 * AI Category Description Generation Service
 * Generates SEO-optimized category descriptions using Claude AI
 * Analyzes products in category to create comprehensive descriptions
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

export interface CategoryGenerationOptions {
  language?: string
  temperature?: number
  maxTokens?: number
  useProductData?: boolean // Analyze products in category
  generationInstructions?: string
}

export interface GeneratedCategoryDescription {
  description: string
  tokensUsed: number
  productsAnalyzed: number
}

/**
 * Generate category description using Claude AI
 */
export async function generateCategoryDescription(
  supabase: any,
  categoryId: string,
  options: CategoryGenerationOptions = {}
): Promise<GeneratedCategoryDescription> {
  const {
    language = 'hu',
    temperature = 0.7,
    maxTokens = 800, // Reduced from 2000 - shorter descriptions for category pages
    useProductData = true,
    generationInstructions
  } = options

  try {
    // 1. Get category data
    const { data: category, error: categoryError } = await supabase
      .from('shoprenter_categories')
      .select(`
        *,
        shoprenter_category_descriptions(*)
      `)
      .eq('id', categoryId)
      .is('deleted_at', null)
      .single()

    if (categoryError) {
      console.error('[AI CATEGORY GENERATION] Error fetching category:', categoryError)
      throw new Error(`Category query failed: ${categoryError.message}`)
    }

    if (!category) {
      throw new Error('Category not found')
    }

    // Get connection separately (optional, for shop URL)
    let connection: any = null
    if (category.connection_id) {
      const { data: connData } = await supabase
        .from('webshop_connections')
        .select('name, api_url')
        .eq('id', category.connection_id)
        .single()
      connection = connData
    }

    // 2. Get products in category (if useProductData is true)
    let products: any[] = []
    let productsAnalyzed = 0

    if (useProductData) {
      const { data: relations } = await supabase
        .from('shoprenter_product_category_relations')
        .select(`
          shoprenter_products(
            id,
            sku,
            name,
            status,
            price,
            product_url,
            product_attributes,
            shoprenter_product_descriptions(name, description, short_description)
          )
        `)
        .eq('category_id', categoryId)
        .is('deleted_at', null)
        .is('shoprenter_products.deleted_at', null)
        .limit(50) // Limit to 50 products for analysis

      products = (relations || [])
        .map(rel => rel.shoprenter_products)
        .filter(Boolean)
        .filter((p: any) => p.status === 1) // Only active products

      productsAnalyzed = products.length
      
      console.log(`[AI CATEGORY GENERATION] Found ${productsAnalyzed} products in category for analysis`)
    }

    // 3. Build context from products
    let productContext = ''
    let commonFeatures: string[] = []
    let productTypes: string[] = []
    let productDescriptions: string[] = []

    if (products.length > 0) {
      // Extract product names, SKUs, key attributes, and descriptions
      const productSummaries = products.map((product: any) => {
        const name = product.name || product.shoprenter_product_descriptions?.[0]?.name || product.sku
        const sku = product.sku || ''
        const attrs = product.product_attributes || []
        const description = product.shoprenter_product_descriptions?.[0]?.description || ''
        const shortDescription = product.shoprenter_product_descriptions?.[0]?.short_description || ''
        const productUrl = product.product_url
        
        // Extract key attributes
        const keyAttrs = attrs
          .filter((attr: any) => attr.display_name && attr.value)
          .map((attr: any) => {
            const value = Array.isArray(attr.value) 
              ? attr.value.map((v: any) => typeof v === 'object' && v.value ? v.value : v).join(', ')
              : attr.value
            return `${attr.display_name}: ${value}`
          })
          .slice(0, 5) // Increased to 5 key attributes
        
        // Extract description snippets (first 200 chars, strip HTML)
        const descSnippet = (description || shortDescription || '')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .trim()
          .substring(0, 200)
        
        if (descSnippet) {
          productDescriptions.push(descSnippet)
        }
        
        return {
          name,
          sku,
          attributes: keyAttrs,
          description: descSnippet,
          url: productUrl
        }
      })

      // Build comprehensive product list context
      productContext = `\n\n=== TERMÉKEK EBBEN A KATEGÓRIÁBAN (${products.length} termék) ===\n`
      productContext += `Az alábbi termékek tartoznak ebbe a kategóriába. Használd ezt az információt a kategória leírásának írásához:\n\n`
      
      productSummaries.slice(0, 20).forEach((p, idx) => {
        productContext += `Termék ${idx + 1}: ${p.name} (SKU: ${p.sku})\n`
        if (p.attributes.length > 0) {
          productContext += `   Főbb jellemzők: ${p.attributes.join('; ')}\n`
        }
        if (p.description) {
          productContext += `   Leírás részlet: ${p.description}...\n`
        }
        if (p.url) {
          productContext += `   URL: ${p.url}\n`
        }
        productContext += `\n`
      })
      
      if (products.length > 20) {
        productContext += `... és még ${products.length - 20} termék.\n\n`
      }

      // Identify common features from attributes
      const allAttributes = products
        .flatMap((p: any) => p.product_attributes || [])
        .filter((attr: any) => attr.display_name && attr.value)
        .map((attr: any) => ({
          name: attr.display_name,
          value: attr.value
        }))

      // Count attribute frequency
      const attributeCounts: Record<string, number> = {}
      allAttributes.forEach((attr: any) => {
        attributeCounts[attr.name] = (attributeCounts[attr.name] || 0) + 1
      })

      // Get most common attributes (appearing in at least 25% of products, lowered threshold)
      const threshold = Math.max(2, Math.ceil(products.length * 0.25))
      commonFeatures = Object.entries(attributeCounts)
        .filter(([_, count]) => count >= threshold)
        .sort(([_, a], [__, b]) => b - a) // Sort by frequency
        .map(([attr, _]) => attr)
        .slice(0, 15) // Increased to 15 common features

      // Identify product types (from names/SKUs)
      const nameWords = products
        .flatMap((p: any) => (p.name || p.sku || '').toLowerCase().split(/\s+/))
        .filter((word: string) => word.length > 3)

      const wordCounts: Record<string, number> = {}
      nameWords.forEach((word: string) => {
        wordCounts[word] = (wordCounts[word] || 0) + 1
      })

      productTypes = Object.entries(wordCounts)
        .filter(([_, count]) => count >= threshold)
        .map(([word, _]) => word)
        .slice(0, 5)
    }

    // 4. Get category description (if exists)
    const categoryDescription = category.shoprenter_category_descriptions?.find(
      (desc: any) => desc.language_id === 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian default
    ) || category.shoprenter_category_descriptions?.[0]

    const currentName = categoryDescription?.name || category.name || 'Kategória'
    const currentDescription = categoryDescription?.description || ''

    // 5. Get parent category info (if exists)
    let parentCategoryInfo = ''
    if (category.parent_category_id) {
      const { data: parentCategory } = await supabase
        .from('shoprenter_categories')
        .select('name, shoprenter_category_descriptions(name)')
        .eq('id', category.parent_category_id)
        .is('deleted_at', null)
        .single()

      if (parentCategory) {
        const parentName = parentCategory.shoprenter_category_descriptions?.[0]?.name || parentCategory.name
        parentCategoryInfo = `\nSzülő kategória: ${parentName}`
      }
    }

    // 6. Build system prompt
    const systemPrompt = `You are an expert SEO copywriter specializing in creating concise, 
SEO-optimized category descriptions for e-commerce websites in Hungarian.

CRITICAL REQUIREMENTS:
1. Write EXCLUSIVELY in Hungarian - no English, no mixed languages
2. Create a SHORT, concise category description (100-200 words maximum)
3. This description appears ABOVE product listings, so it must be brief and not take up too much space
4. Use natural, conversational Hungarian tone
5. Include relevant keywords naturally (no keyword stuffing)
6. NO HTML headings - just plain paragraphs or simple formatting
7. Mention key product types and common features if product data is provided (briefly)
8. Make it SEO-friendly and engaging but keep it SHORT

DESCRIPTION STRUCTURE (keep it brief):
1. **Brief Introduction** (2-3 sentences)
   - Introduce the category concisely
   - Mention what types of products are available
   - Hook the reader quickly

2. **Key Features/Benefits** (2-3 sentences)
   - Highlight 2-3 most common features or benefits
   - Keep it brief - don't list everything
   - Focus on what makes this category valuable

3. **Brief Use Case** (1-2 sentences, optional)
   - Quick mention of where/how products are used
   - Only if it adds value

IMPORTANT: 
- Total length: 100-200 words maximum
- NO long paragraphs - keep sentences short
- NO extensive lists
- NO multiple sections with headings
- Just 2-4 short paragraphs total
- This appears above products, so brevity is key

LANGUAGE REQUIREMENTS:
- Write ONLY in Hungarian
- Use proper Hungarian grammar and spelling
- Use industry-specific terminology in Hungarian
- Natural, human-like writing style

FORMATTING:
- Use simple HTML: <p> tags for paragraphs, <strong> for emphasis if needed
- NO headings (<h2>, <h3>) - keep it simple
- NO lists - just flowing text
- Keep paragraphs short (2-3 sentences each)

Write ONLY the short category description in simple HTML format (just <p> tags). Do not include meta tags or other fields.`

    // 7. Build user prompt
    let userPrompt = `Generate a comprehensive category description for: ${currentName}\n\n`

    if (currentDescription) {
      userPrompt += `CURRENT DESCRIPTION (for reference):\n${currentDescription.substring(0, 500)}...\n\n`
    }

    if (parentCategoryInfo) {
      userPrompt += `${parentCategoryInfo}\n\n`
    }

    if (productContext) {
      userPrompt += productContext
    }

    if (commonFeatures.length > 0) {
      userPrompt += `\n\n=== KÖZÖS JELLEMZŐK A KATEGÓRIÁBAN ===\n`
      userPrompt += `Az alábbi jellemzők gyakran előfordulnak a kategória termékeinél. Említsd ezeket a leírásban:\n`
      commonFeatures.forEach((feature, idx) => {
        userPrompt += `${idx + 1}. ${feature}\n`
      })
      userPrompt += `\n`
    }

    if (productTypes.length > 0) {
      userPrompt += `\n\n=== TERMÉKTÍPUSOK ===\n`
      userPrompt += `A kategóriában található főbb terméktípusok:\n`
      productTypes.forEach((type, idx) => {
        userPrompt += `${idx + 1}. ${type}\n`
      })
      userPrompt += `\n`
    }
    
    if (productDescriptions.length > 0) {
      // Extract common themes from product descriptions
      const allDescText = productDescriptions.join(' ').toLowerCase()
      const commonWords = allDescText
        .split(/\s+/)
        .filter((word: string) => word.length > 4)
        .filter((word: string) => !['termék', 'kategória', 'leírás', 'részlet'].includes(word))
      
      const wordCounts: Record<string, number> = {}
      commonWords.forEach((word: string) => {
        wordCounts[word] = (wordCounts[word] || 0) + 1
      })
      
      const topWords = Object.entries(wordCounts)
        .sort(([_, a], [__, b]) => b - a)
        .slice(0, 10)
        .map(([word, _]) => word)
      
      if (topWords.length > 0) {
        userPrompt += `\n\n=== GYAKORI KULCSSZAVAK A TERMÉKLEÍRÁSOKBAN ===\n`
        userPrompt += `A termékleírásokban gyakran előforduló kulcsszavak (használd ezeket természetesen):\n`
        userPrompt += topWords.join(', ') + '\n\n'
      }
    }

    if (generationInstructions) {
      userPrompt += `\n\nSPECIAL INSTRUCTIONS:\n${generationInstructions}\n`
    }

    userPrompt += `\n\nCRITICAL: Generate a SHORT, concise category description (100-200 words maximum) in Hungarian. 
This description appears ABOVE product listings, so it must be brief and not take up too much space.
- Keep it to 2-4 short paragraphs
- NO HTML headings
- Focus on the most important information
- Be concise and to the point`

    // 8. Call Claude AI with model fallback (same as product generation)
    // Updated to use new generation model identifiers (claude-sonnet-4-6, etc.)
    const modelsToTry = [
      'claude-sonnet-4-6',              // Default: good quality/price balance
      'claude-opus-4-6',                // Max quality option
      'claude-haiku-4-5-20251001',      // Cheap/fast fallback
      'claude-sonnet-4-5-20250929',     // Older fallback option
      'claude-sonnet-4-20250514'        // Older fallback option
    ]

    let message: any = null
    let modelUsed = ''
    let lastError: any = null

    for (const model of modelsToTry) {
      try {
        console.log(`[AI CATEGORY GENERATION] Trying model: ${model}`)
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
        console.log(`[AI CATEGORY GENERATION] Success with model: ${model}`)
        break // Success, exit loop
      } catch (error: any) {
        lastError = error
        console.error(`[AI CATEGORY GENERATION] Model ${model} failed:`, {
          status: error.status,
          message: error.message,
          error: error.error
        })

        // If it's a 404 (model not found), try next model
        if (error.status === 404) {
          continue
        }

        // If it's authentication or rate limit, stop trying
        if (error.status === 401 || error.status === 429) {
          throw error
        }
      }
    }

    if (!message) {
      throw new Error(`All Claude models failed. Last error: ${lastError?.message || 'Unknown error'}`)
    }

    // 9. Extract description
    const description = message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n')

    const tokensUsed = message.usage.input_tokens + message.usage.output_tokens

    // 10. Save generation history
    await supabase
      .from('category_description_generations')
      .insert({
        category_id: categoryId,
        generated_description: description,
        model: modelUsed || modelsToTry[0], // Use the model that actually worked
        tokens_used: tokensUsed,
        source_products_count: productsAnalyzed,
        generation_instructions: generationInstructions || null,
        language: language
      })

    return {
      description,
      tokensUsed,
      productsAnalyzed
    }
  } catch (error: any) {
    console.error('[AI CATEGORY GENERATION] Error:', error)
    throw new Error(`Failed to generate category description: ${error.message || 'Unknown error'}`)
  }
}
