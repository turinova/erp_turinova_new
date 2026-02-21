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
    maxTokens = 2000,
    useProductData = true,
    generationInstructions
  } = options

  try {
    // 1. Get category data
    const { data: category, error: categoryError } = await supabase
      .from('shoprenter_categories')
      .select(`
        *,
        shoprenter_category_descriptions(*),
        webshop_connections(shop_name, api_url)
      `)
      .eq('id', categoryId)
      .is('deleted_at', null)
      .single()

    if (categoryError || !category) {
      throw new Error('Category not found')
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
            product_attributes,
            shoprenter_product_descriptions(name, description)
          )
        `)
        .eq('category_id', categoryId)
        .is('deleted_at', null)
        .limit(50) // Limit to 50 products for analysis

      products = (relations || [])
        .map(rel => rel.shoprenter_products)
        .filter(Boolean)
        .filter((p: any) => p.status === 1) // Only active products

      productsAnalyzed = products.length
    }

    // 3. Build context from products
    let productContext = ''
    let commonFeatures: string[] = []
    let productTypes: string[] = []

    if (products.length > 0) {
      // Extract product names, SKUs, and key attributes
      const productSummaries = products.map((product: any) => {
        const name = product.name || product.shoprenter_product_descriptions?.[0]?.name || product.sku
        const sku = product.sku || ''
        const attrs = product.product_attributes || []
        
        // Extract key attributes
        const keyAttrs = attrs
          .filter((attr: any) => attr.display_name && attr.value)
          .map((attr: any) => `${attr.display_name}: ${Array.isArray(attr.value) ? attr.value.join(', ') : attr.value}`)
          .slice(0, 3) // Limit to 3 key attributes
        
        return {
          name,
          sku,
          attributes: keyAttrs
        }
      })

      // Build product list context
      productContext = `\n\nTERMÉKEK EBBEN A KATEGÓRIÁBAN (${products.length} termék):\n`
      productSummaries.forEach((p, idx) => {
        productContext += `${idx + 1}. ${p.name} (SKU: ${p.sku})\n`
        if (p.attributes.length > 0) {
          productContext += `   Főbb jellemzők: ${p.attributes.join(', ')}\n`
        }
      })

      // Identify common features
      const allAttributes = products
        .flatMap((p: any) => p.product_attributes || [])
        .filter((attr: any) => attr.display_name)
        .map((attr: any) => attr.display_name)

      // Count attribute frequency
      const attributeCounts: Record<string, number> = {}
      allAttributes.forEach((attr: string) => {
        attributeCounts[attr] = (attributeCounts[attr] || 0) + 1
      })

      // Get most common attributes (appearing in at least 30% of products)
      const threshold = Math.ceil(products.length * 0.3)
      commonFeatures = Object.entries(attributeCounts)
        .filter(([_, count]) => count >= threshold)
        .map(([attr, _]) => attr)
        .slice(0, 10)

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
    const systemPrompt = `You are an expert SEO copywriter specializing in creating comprehensive, 
SEO-optimized category descriptions for e-commerce websites in Hungarian.

CRITICAL REQUIREMENTS:
1. Write EXCLUSIVELY in Hungarian - no English, no mixed languages
2. Create a comprehensive category description (300-600 words)
3. Use natural, conversational Hungarian tone
4. Include relevant keywords naturally (no keyword stuffing)
5. Structure the description with HTML headings (<h2>, <h3>)
6. Mention product types and common features if product data is provided
7. Include internal links to related categories when relevant (format: <a href="URL">Category Name</a>)
8. Make it SEO-friendly and engaging for customers

DESCRIPTION STRUCTURE:
1. **Introduction** (<h2>Bevezetés</h2> or <h2>Áttekintés</h2>)
   - Introduce the category
   - Explain what products are available
   - Hook the reader

2. **Product Types** (<h2>Terméktípusok</h2> or <h2>Elérhető termékek</h2>)
   - List main product types/variants in category
   - Mention key features if product data provided

3. **Common Features/Benefits** (<h2>Főbb jellemzők</h2> or <h2>Kiemelt előnyök</h2>)
   - Highlight common features across products
   - Mention benefits for customers

4. **Use Cases** (<h2>Alkalmazási területek</h2> or <h2>Használati lehetőségek</h2>)
   - Where and how products in this category are used
   - Different application scenarios

5. **Conclusion** (<h2>Összefoglalás</h2>)
   - Summarize key points
   - Reinforce value proposition

INTERNAL LINKING:
- Include 2-4 natural internal links to related categories if relevant
- Use format: <a href="https://shopname.shoprenter.hu/category-slug">Category Name</a>
- Links should be contextually relevant
- Don't over-link - only when it adds value

LANGUAGE REQUIREMENTS:
- Write ONLY in Hungarian
- Use proper Hungarian grammar and spelling
- Use industry-specific terminology in Hungarian
- Natural, human-like writing style

Write ONLY the category description in HTML format. Do not include meta tags or other fields.`

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
      userPrompt += `\n\nKÖZÖS JELLEMZŐK A KATEGÓRIÁBAN:\n`
      commonFeatures.forEach(feature => {
        userPrompt += `- ${feature}\n`
      })
    }

    if (productTypes.length > 0) {
      userPrompt += `\n\nTERMÉKTÍPUSOK:\n`
      productTypes.forEach(type => {
        userPrompt += `- ${type}\n`
      })
    }

    if (generationInstructions) {
      userPrompt += `\n\nSPECIAL INSTRUCTIONS:\n${generationInstructions}\n`
    }

    userPrompt += `\n\nGenerate a comprehensive, SEO-optimized category description in Hungarian following the structure above.`

    // 8. Call Claude AI
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
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
        model: 'claude-3-5-sonnet-20241022',
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
