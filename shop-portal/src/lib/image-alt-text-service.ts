// Image Alt Text Generation Service
// Generates SEO-friendly alt text for product images using Claude

import Anthropic from '@anthropic-ai/sdk'

/**
 * Get Anthropic client for alt text generation
 */
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables')
  }
  
  const client = new Anthropic({
    apiKey: apiKey,
    baseURL: 'https://api.anthropic.com',
    defaultHeaders: {
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  })
  
  return client
}

export interface ImageAltTextContext {
  productName: string
  sku: string
  productAttributes?: Array<{
    name: string
    type: string
    value: any
  }> | null
  imageType: 'main' | 'additional'
  sortOrder: number
  imagePath?: string
  isParent?: boolean // If true, this is a parent product with variants
  variantAttributes?: string[] // List of attribute names that vary across children (e.g., ['meret', 'szin'])
}

export interface GeneratedAltText {
  altText: string
  tokensUsed: number
  modelUsed: string
}

/**
 * Generate SEO-friendly alt text for a product image
 */
export async function generateImageAltText(
  context: ImageAltTextContext
): Promise<GeneratedAltText> {
  const client = getAnthropicClient()
  
  // Build context string from product attributes
  // For parent products, exclude variant-specific attributes (size, color)
  let attributesText = ''
  if (context.productAttributes && context.productAttributes.length > 0) {
    const variantAttributeNames = (context.variantAttributes || []).map(name => name.toLowerCase())
    
    const relevantAttributes = context.productAttributes
      .filter(attr => {
        const name = attr.name.toLowerCase()
        // Focus on visual attributes that would be visible in images
        const isVisualAttribute = ['szin', 'color', 'meret', 'size', 'finish', 'finish', 'material', 'anyag'].includes(name)
        
        // If this is a parent product, exclude variant-specific attributes
        if (context.isParent && variantAttributeNames.includes(name)) {
          return false // Exclude variant attributes for parent products
        }
        
        return isVisualAttribute
      })
      .map(attr => {
        if (attr.type === 'LIST' && Array.isArray(attr.value)) {
          const values = attr.value.map((v: any) => v.value || v).join(', ')
        return `${attr.display_name || attr.name}: ${values}`
      }
      return `${attr.display_name || attr.name}: ${attr.value}`
      })
      .join(', ')
    
    if (relevantAttributes) {
      attributesText = `\nAttribútumok: ${relevantAttributes}`
    }
  }
  
  // Determine image context hint based on sort order
  let imageContextHint = ''
  if (context.imageType === 'main') {
    imageContextHint = 'Ez a fő termékkép, amely a termék teljes nézetét mutatja.'
  } else {
    if (context.sortOrder === 1) {
      imageContextHint = 'Ez egy részletes nézet vagy más szögű kép a termékről.'
    } else {
      imageContextHint = `Ez a ${context.sortOrder + 1}. kiegészítő kép a termékről.`
    }
  }
  
  // Build system prompt with parent product handling
  let parentProductWarning = ''
  if (context.isParent) {
    parentProductWarning = `
CRITICAL FOR PARENT PRODUCTS:
- This is a PARENT product with multiple variants (children)
- DO NOT mention specific sizes, colors, or other variant-specific attributes
- Only include attributes that are consistent across ALL variants
- Describe the product type/generic features only
- Example: "K-StrongMax fiókcsúszka, fekete színben" (if all variants are black)
- Example: "K-StrongMax fiókcsúszka" (if variants have different colors)
- DO NOT say: "K-StrongMax 270mm fiókcsúszka" (specific size - wrong!)
- DO NOT say: "több méretben elérhető" (availability info - not for alt text!)
`
  }

  const systemPrompt = `You are an expert SEO copywriter specializing in creating concise, descriptive alt text for product images in Hungarian e-commerce.

CRITICAL REQUIREMENTS:
1. **Maximum 125 characters** - Alt text must be concise and under 125 characters
2. **Hungarian language only** - Write exclusively in Hungarian
3. **Descriptive and specific** - Include product type, key attributes, and distinguishing features
4. **SEO-optimized** - Include relevant keywords naturally
5. **No redundant words** - Do NOT use words like "kép", "fotó", "kép a", "fotó a"
6. **Natural language** - Write as if describing the product to a visually impaired person
7. **Focus on what's visible** - Describe what can be seen in the image (color, size, material, etc.)
${parentProductWarning}
FORMAT GUIDELINES:
- Start with product type/category
- Include key visual attributes (color, size, finish) - BUT ONLY if consistent across all variants for parent products
- Be specific but concise
- Use natural Hungarian grammar

EXAMPLES:
- Child product: "K-StrongMax 249 40kg teherbírású fiókcsúszka, fekete színben"
- Parent product (all variants same color): "K-StrongMax fiókcsúszka, fekete színben"
- Parent product (variants differ): "K-StrongMax fiókcsúszka"
- "Szekrénycsukló, 110° nyitási szög, lágyzárás, fehér finish"
- "Fiókrendszer, gránitkompozit anyag, antracit szín" (no size if it varies)

Write ONLY the alt text, nothing else. No explanations, no quotes, just the alt text.`

  const userPrompt = `Generate alt text for this product image:

Termék neve: ${context.productName}
SKU: ${context.sku}${attributesText}
Kép típusa: ${context.imageType === 'main' ? 'Fő kép' : 'Kiegészítő kép'}
${imageContextHint}

Generate a concise, SEO-friendly alt text (max 125 characters) in Hungarian.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6', // Use the same model as AI generation service
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

    // Extract alt text from response
    let altText = ''
    if (response.content && response.content.length > 0) {
      const textContent = response.content.find(block => block.type === 'text')
      if (textContent && textContent.type === 'text') {
        altText = textContent.text.trim()
        
        // Remove quotes if present
        altText = altText.replace(/^["']|["']$/g, '')
        
        // Truncate to 125 characters if needed
        if (altText.length > 125) {
          altText = altText.substring(0, 122) + '...'
        }
      }
    }

    if (!altText) {
      throw new Error('Failed to generate alt text: Empty response from AI')
    }

    // Calculate tokens used
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)

    return {
      altText,
      tokensUsed,
      modelUsed: 'claude-sonnet-4-6'
    }
  } catch (error: any) {
    console.error('[IMAGE ALT TEXT] Generation error:', error)
    throw new Error(`Failed to generate alt text: ${error?.message || 'Unknown error'}`)
  }
}

/**
 * Generate alt text for multiple images
 */
export async function generateAltTextForMultipleImages(
  contexts: ImageAltTextContext[]
): Promise<Array<GeneratedAltText & { context: ImageAltTextContext }>> {
  const results = await Promise.all(
    contexts.map(async (context) => {
      try {
        const result = await generateImageAltText(context)
        return { ...result, context }
      } catch (error: any) {
        console.error(`[IMAGE ALT TEXT] Failed for ${context.sku}:`, error)
        throw error
      }
    })
  )
  
  return results
}
