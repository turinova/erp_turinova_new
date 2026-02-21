// Meta SEO Generation Service
// Generates high-ranking meta titles, keywords, and descriptions for products

import Anthropic from '@anthropic-ai/sdk'

/**
 * Get Anthropic client
 */
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables')
  }
  
  return new Anthropic({
    apiKey: apiKey,
    baseURL: 'https://api.anthropic.com',
    defaultHeaders: {
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  })
}

export interface MetaGenerationContext {
  product: {
    id: string
    sku: string
    name: string | null
    model_number: string | null
    price: number | null
    product_attributes: any[] | null
  }
  description?: string | null
  isParent: boolean
  isChild: boolean
  parentProduct?: {
    name: string | null
    sku: string
  } | null
  childProducts?: Array<{
    name: string | null
    sku: string
    product_attributes: any[] | null
  }>
  searchQueries?: Array<{
    query: string
    impressions: number
    clicks: number
    position: number
  }>
}

export interface GeneratedMeta {
  meta_title: string
  meta_keywords: string
  meta_description: string
}

/**
 * Generate meta title (50-60 characters optimal, max 70)
 */
export async function generateMetaTitle(context: MetaGenerationContext): Promise<string> {
  const client = getAnthropicClient()
  
  // Build variant info for parent products
  let variantInfo = ''
  if (context.isParent && context.childProducts && context.childProducts.length > 0) {
    const variantAttributes = new Set<string>()
    context.childProducts.forEach(child => {
      if (child.product_attributes) {
        child.product_attributes.forEach((attr: any) => {
          if (attr.name === 'meret' || attr.name === 'szin' || attr.name === 'size' || attr.name === 'color') {
            if (attr.value && Array.isArray(attr.value) && attr.value.length > 0) {
              variantAttributes.add(attr.name)
            }
          }
        })
      }
    })
    
    if (variantAttributes.size > 0) {
      const variantList = Array.from(variantAttributes).map(v => {
        if (v === 'meret' || v === 'size') return 'méretekben'
        if (v === 'szin' || v === 'color') return 'színekben'
        return v
      }).join(', ')
      variantInfo = ` A termék ${variantList} elérhető.`
    }
  }
  
  // Build child product info
  let childInfo = ''
  if (context.isChild && context.parentProduct) {
    childInfo = ` Ez a ${context.parentProduct.name || context.parentProduct.sku} termék variánsa.`
  }
  
  // Get top search queries for optimization
  let searchQueryInfo = ''
  if (context.searchQueries && context.searchQueries.length > 0) {
    const topQueries = context.searchQueries
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 3)
      .map(q => q.query)
    if (topQueries.length > 0) {
      searchQueryInfo = `\n\nTop keresési lekérdezések optimalizáláshoz: ${topQueries.join(', ')}`
    }
  }
  
  const systemPrompt = `You are an expert SEO copywriter specializing in creating high-ranking meta titles for e-commerce products in Hungarian.

CRITICAL REQUIREMENTS:
1. **Length**: MUST be between 50-60 characters (optimal for Google). Maximum 70 characters.
2. **Language**: Write EXCLUSIVELY in Hungarian
3. **Keyword placement**: Primary keyword should be near the beginning
4. **Dynamic tags**: You MUST include ShopRenter dynamic tags where appropriate:
   - [PRODUCT] - Product name (use this for the main product name)
   - [CATEGORY] - Category name (use if category is relevant)
   - [PRICE] - Price (use if price is a selling point)
   - [SKU] - SKU (use if SKU is important for identification)
   - [SERIAL] - Model number (use if model number is important)
5. **Action words**: Use compelling action words when space allows
6. **No special characters**: Avoid special characters that might break display (except the dynamic tags)
7. **Unique**: Must be unique and specific to this product

SEO BEST PRACTICES:
- Start with the most important keyword
- Include product type/category using [CATEGORY] tag
- Use [PRODUCT] tag for the product name
- Add value proposition if space allows
- Use natural Hungarian language
- Avoid keyword stuffing
- Make it click-worthy but accurate
- Include [PRICE] if competitive pricing is a selling point

PARENT-CHILD RELATIONSHIPS:
- For PARENT products: Mention that variants are available (e.g., "több méretben", "több színben") but DON'T specify a single variant. Use [PRODUCT] for the parent product name.
- For CHILD products: Can mention specific variant (e.g., "400mm", "fekete") but also reference it's part of a product line. Use [PRODUCT] for the child product name.

DYNAMIC TAG USAGE:
- Always include [PRODUCT] for the product name
- Include [CATEGORY] if the category is relevant and adds value
- Include [PRICE] only if price is a key selling point (e.g., "akciós", "kedvező")
- Include [SERIAL] if model number is important for identification
- The tags will be replaced by ShopRenter with actual values, so write around them naturally

Return ONLY the meta title text with dynamic tags, nothing else. No quotes, no explanations.`

  const userPrompt = `Generate a high-ranking meta title for this product:

Product Name: ${context.product.name || 'N/A'}
SKU: ${context.product.sku}
Model Number: ${context.product.model_number || 'N/A'}
${context.isParent ? 'Type: Parent product (has variants)' : context.isChild ? 'Type: Child product (variant)' : 'Type: Standalone product'}
${variantInfo}
${childInfo}
${context.description ? `Product Description (for context): ${context.description.substring(0, 500)}` : ''}
${searchQueryInfo}

Generate a meta title that:
- Is 50-60 characters (optimal) - COUNT THE CHARACTERS INCLUDING THE DYNAMIC TAGS
- Contains the primary keyword
- Includes [PRODUCT] tag for the product name
- Optionally includes [CATEGORY], [PRICE], [SKU], or [SERIAL] tags where relevant
- Is compelling and click-worthy
- Is in Hungarian
- Follows SEO best practices
- ${context.isParent ? 'Mentions variants are available but not specific variant' : context.isChild ? 'Can mention specific variant' : 'Is specific to this product'}

Example format: "[PRODUCT] - [CATEGORY] | Versenyképes áron" or "[PRODUCT] [SERIAL] - Minőségi szekrény kellék"`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    })

    let metaTitle = ''
    if (response.content && response.content[0] && 'text' in response.content[0]) {
      metaTitle = response.content[0].text.trim()
    }

    // Clean up and validate
    metaTitle = metaTitle.replace(/^["']|["']$/g, '').trim()
    
    // Ensure length is within limits
    if (metaTitle.length > 70) {
      metaTitle = metaTitle.substring(0, 67) + '...'
    }
    
    // Ensure minimum length
    if (metaTitle.length < 30) {
      // Fallback: use product name with dynamic tags
      metaTitle = `[PRODUCT]${context.product.model_number ? ` [SERIAL]` : ''} - Szekrény kellék`
      if (metaTitle.length > 70) {
        metaTitle = metaTitle.substring(0, 67) + '...'
      }
    }
    
    // Ensure [PRODUCT] tag is included if not present
    if (!metaTitle.includes('[PRODUCT]')) {
      // Try to replace product name with [PRODUCT] tag
      const productName = context.product.name || context.product.sku
      if (productName && metaTitle.includes(productName)) {
        metaTitle = metaTitle.replace(productName, '[PRODUCT]')
      } else {
        // Add [PRODUCT] at the beginning if there's space
        if (metaTitle.length + 10 <= 70) {
          metaTitle = `[PRODUCT] - ${metaTitle}`
        }
      }
    }

    return metaTitle
  } catch (error) {
    console.error('[META TITLE GENERATION] Error:', error)
    // Fallback with dynamic tags
    return `[PRODUCT]${context.product.model_number ? ` [SERIAL]` : ''} - Szekrény kellék`
  }
}

/**
 * Generate meta keywords (comma-separated, 5-10 keywords optimal)
 */
export async function generateMetaKeywords(context: MetaGenerationContext): Promise<string> {
  const client = getAnthropicClient()
  
  // Extract variant attributes for keywords
  let variantKeywords: string[] = []
  if (context.isParent && context.childProducts && context.childProducts.length > 0) {
    const allAttributes = new Set<string>()
    context.childProducts.forEach(child => {
      if (child.product_attributes) {
        child.product_attributes.forEach((attr: any) => {
          if (attr.value && Array.isArray(attr.value)) {
            attr.value.forEach((val: any) => {
              if (val.value && typeof val.value === 'string') {
                allAttributes.add(val.value.toLowerCase())
              }
            })
          }
        })
      }
    })
    variantKeywords = Array.from(allAttributes).slice(0, 5)
  } else if (context.isChild && context.product.product_attributes) {
    context.product.product_attributes.forEach((attr: any) => {
      if (attr.value && Array.isArray(attr.value)) {
        attr.value.forEach((val: any) => {
          if (val.value && typeof val.value === 'string') {
            variantKeywords.push(val.value)
          }
        })
      }
    })
  }
  
  const systemPrompt = `You are an expert SEO specialist creating meta keywords for e-commerce products in Hungarian.

CRITICAL REQUIREMENTS:
1. **Format**: Comma-separated keywords, no quotes
2. **Count**: 5-10 keywords optimal (max 15)
3. **Language**: ALL keywords in Hungarian
4. **Relevance**: Only highly relevant keywords
5. **Order**: Most important first
6. **No duplicates**: Each keyword appears only once
7. **Specificity**: Include specific product attributes when relevant

SEO BEST PRACTICES:
- Start with primary product name/category
- Include brand/model if relevant
- Add specific attributes (size, color, material, etc.)
- Include use cases/benefits
- Use natural Hungarian terms
- Avoid generic terms unless highly relevant

PARENT-CHILD RELATIONSHIPS:
- For PARENT products: Include general variant types (e.g., "több méretben", "több színben") but NOT specific values
- For CHILD products: Include specific variant values (e.g., "400mm", "fekete") plus general product terms

Return ONLY the comma-separated keywords, nothing else.`

  const userPrompt = `Generate meta keywords for this product:

Product Name: ${context.product.name || 'N/A'}
SKU: ${context.product.sku}
Model Number: ${context.product.model_number || 'N/A'}
${context.isParent ? 'Type: Parent product (has variants)' : context.isChild ? 'Type: Child product (variant)' : 'Type: Standalone product'}
${variantKeywords.length > 0 ? `Variant attributes: ${variantKeywords.join(', ')}` : ''}
${context.description ? `Product Description (for context): ${context.description.substring(0, 500)}` : ''}

Generate 5-10 highly relevant keywords in Hungarian, comma-separated.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    })

    let keywords = ''
    if (response.content && response.content[0] && 'text' in response.content[0]) {
      keywords = response.content[0].text.trim()
    }

    // Clean up
    keywords = keywords.replace(/^["']|["']$/g, '').trim()
    
    // Remove any "Keywords:" prefix
    keywords = keywords.replace(/^(Keywords?|Kulcsszavak?):\s*/i, '').trim()
    
    // Fallback
    if (!keywords || keywords.length < 5) {
      const fallbackKeywords = [
        context.product.name || context.product.sku,
        context.product.model_number,
        'szekrény kellék',
        'bútorkellék'
      ].filter(Boolean)
      keywords = fallbackKeywords.join(', ')
    }

    return keywords
  } catch (error) {
    console.error('[META KEYWORDS GENERATION] Error:', error)
    // Fallback with dynamic tags
    return `[PRODUCT], ${context.product.model_number ? '[SERIAL], ' : ''}szekrény kellék, bútorkellék, [CATEGORY]`
  }
}

/**
 * Generate meta description (150-160 characters optimal, max 160)
 */
export async function generateMetaDescription(context: MetaGenerationContext): Promise<string> {
  const client = getAnthropicClient()
  
  // Build variant info for parent products
  let variantInfo = ''
  if (context.isParent && context.childProducts && context.childProducts.length > 0) {
    const variantCount = context.childProducts.length
    variantInfo = ` A termék ${variantCount} változatban elérhető.`
  }
  
  // Build child product info
  let childInfo = ''
  if (context.isChild && context.parentProduct) {
    childInfo = ` A ${context.parentProduct.name || context.parentProduct.sku} termék variánsa.`
  }
  
  // Get top search queries for optimization
  let searchQueryInfo = ''
  if (context.searchQueries && context.searchQueries.length > 0) {
    const topQueries = context.searchQueries
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 3)
      .map(q => q.query)
    if (topQueries.length > 0) {
      searchQueryInfo = `\n\nTop keresési lekérdezések optimalizáláshoz: ${topQueries.join(', ')}`
    }
  }
  
  const systemPrompt = `You are an expert SEO copywriter creating high-ranking meta descriptions for e-commerce products in Hungarian.

CRITICAL REQUIREMENTS:
1. **Length**: MUST be between 150-160 characters (optimal for Google). Maximum 160 characters.
2. **Language**: Write EXCLUSIVELY in Hungarian
3. **Compelling**: Must be compelling and encourage clicks
4. **Value proposition**: Include key benefits or unique selling points
5. **Call to action**: Include subtle call to action when space allows
6. **Keyword-rich**: Naturally include primary keywords
7. **Dynamic tags**: You MUST include ShopRenter dynamic tags where appropriate:
   - [PRODUCT] - Product name (use this for the main product name)
   - [CATEGORY] - Category name (use if category is relevant)
   - [PRICE] - Price (use if price is a selling point)
   - [SKU] - SKU (use if SKU is important for identification)
   - [SERIAL] - Model number (use if model number is important)
8. **No special characters**: Avoid characters that might break display (except the dynamic tags)
9. **Complete sentence**: Must be a complete, readable sentence

SEO BEST PRACTICES:
- Start with the most important benefit or feature
- Include primary keyword naturally
- Use [PRODUCT] tag for the product name
- Add value proposition
- Include call to action (e.g., "vásároljon", "fedezze fel", "további információ")
- Make it compelling but accurate
- Use active voice
- Avoid keyword stuffing
- Include [PRICE] if competitive pricing is mentioned

PARENT-CHILD RELATIONSHIPS:
- For PARENT products: Mention variants are available but focus on general product benefits. Use [PRODUCT] for the parent product name.
- For CHILD products: Can mention specific variant but also general benefits. Use [PRODUCT] for the child product name.
- Keep variant info brief

DYNAMIC TAG USAGE:
- Always include [PRODUCT] for the product name
- Include [CATEGORY] if the category is relevant and adds value
- Include [PRICE] if price is mentioned (e.g., "csak [PRICE] Ft", "versenyképes áron")
- Include [SERIAL] if model number is important for identification
- The tags will be replaced by ShopRenter with actual values, so write around them naturally

Return ONLY the meta description text with dynamic tags, nothing else. No quotes, no explanations.`

  const userPrompt = `Generate a high-ranking meta description for this product:

Product Name: ${context.product.name || 'N/A'}
SKU: ${context.product.sku}
Model Number: ${context.product.model_number || 'N/A'}
Price: ${context.product.price ? `${context.product.price} Ft` : 'N/A'}
${context.isParent ? 'Type: Parent product (has variants)' : context.isChild ? 'Type: Child product (variant)' : 'Type: Standalone product'}
${variantInfo}
${childInfo}
${context.description ? `Product Description (for context): ${context.description.substring(0, 500)}` : ''}
${searchQueryInfo}

Generate a meta description that:
- Is 150-160 characters (optimal) - COUNT THE CHARACTERS INCLUDING THE DYNAMIC TAGS
- Is compelling and click-worthy
- Includes [PRODUCT] tag for the product name
- Optionally includes [CATEGORY], [PRICE], [SKU], or [SERIAL] tags where relevant
- Includes key benefits
- Has a subtle call to action
- Is in Hungarian
- Follows SEO best practices
- ${context.isParent ? 'Mentions variants but focuses on general benefits' : context.isChild ? 'Can mention specific variant' : 'Is specific to this product'}

Example format: "[PRODUCT] - Minőségi [CATEGORY] kellék, versenyképes áron. Fedezze fel a részleteket és vásároljon most!" or "[PRODUCT] [SERIAL] - Prémium minőség, csak [PRICE] Ft. Szállítás és garancia. További információ!"`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    })

    let metaDescription = ''
    if (response.content && response.content[0] && 'text' in response.content[0]) {
      metaDescription = response.content[0].text.trim()
    }

    // Clean up and validate
    metaDescription = metaDescription.replace(/^["']|["']$/g, '').trim()
    
    // Ensure length is within limits
    if (metaDescription.length > 160) {
      // Try to cut at sentence boundary
      const cutAt = metaDescription.lastIndexOf('.', 157)
      if (cutAt > 120) {
        metaDescription = metaDescription.substring(0, cutAt + 1)
      } else {
        metaDescription = metaDescription.substring(0, 157) + '...'
      }
    }
    
    // Ensure minimum length
    if (metaDescription.length < 120) {
      // Fallback: create basic description with dynamic tags
      const fallback = `[PRODUCT]${context.product.model_number ? ` [SERIAL]` : ''} - Minőségi szekrény kellék, versenyképes áron. Fedezze fel részleteket és vásároljon most!`
      metaDescription = fallback.length > 160 ? fallback.substring(0, 157) + '...' : fallback
    }
    
    // Ensure [PRODUCT] tag is included if not present
    if (!metaDescription.includes('[PRODUCT]')) {
      // Try to replace product name with [PRODUCT] tag
      const productName = context.product.name || context.product.sku
      if (productName && metaDescription.includes(productName)) {
        metaDescription = metaDescription.replace(productName, '[PRODUCT]')
      } else {
        // Add [PRODUCT] at the beginning if there's space
        if (metaDescription.length + 12 <= 160) {
          metaDescription = `[PRODUCT] - ${metaDescription}`
        }
      }
    }

    return metaDescription
  } catch (error) {
    console.error('[META DESCRIPTION GENERATION] Error:', error)
    // Fallback with dynamic tags
    const fallback = `[PRODUCT]${context.product.model_number ? ` [SERIAL]` : ''} - Minőségi szekrény kellék, versenyképes áron. Fedezze fel részleteket!`
    return fallback.length > 160 ? fallback.substring(0, 157) + '...' : fallback
  }
}

/**
 * Generate all meta fields at once
 */
export async function generateAllMetaFields(
  context: MetaGenerationContext
): Promise<GeneratedMeta> {
  const [metaTitle, metaKeywords, metaDescription] = await Promise.all([
    generateMetaTitle(context),
    generateMetaKeywords(context),
    generateMetaDescription(context)
  ])

  return {
    meta_title: metaTitle,
    meta_keywords: metaKeywords,
    meta_description: metaDescription
  }
}
