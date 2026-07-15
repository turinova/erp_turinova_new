/**
 * Category meta field generation (name, meta title, meta description)
 */

import Anthropic from '@anthropic-ai/sdk'
import { trackAIUsage } from '@/lib/ai-usage-tracker'
import { HU_LANG_ID } from '@/lib/category-geo-validator'

const MODELS_TO_TRY = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-20250514'
]

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({
    apiKey,
    baseURL: 'https://api.anthropic.com',
    defaultHeaders: {
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  })
}

export type CategoryMetaField = 'name' | 'meta_title' | 'meta_description'

export interface GeneratedCategoryMeta {
  name?: string
  meta_title?: string
  meta_description?: string
  tokensUsed: number
  creditsUsed: number
}

async function gatherMetaContext(supabase: any, categoryId: string) {
  const { data: category, error } = await supabase
    .from('shoprenter_categories')
    .select(`*, shoprenter_category_descriptions(*)`)
    .eq('id', categoryId)
    .is('deleted_at', null)
    .single()

  if (error || !category) throw new Error('Category not found')

  const { data: relations } = await supabase
    .from('shoprenter_product_category_relations')
    .select(`
      shoprenter_products(
        id, sku, name, status, price, product_attributes,
        shoprenter_product_descriptions(name, description, short_description)
      )
    `)
    .eq('category_id', categoryId)
    .is('deleted_at', null)
    .is('shoprenter_products.deleted_at', null)
    .limit(20)

  const products = (relations || [])
    .map((rel: any) => rel.shoprenter_products)
    .filter(Boolean)
    .filter((p: any) => p.status === 1)

  const currentDescription =
    category.shoprenter_category_descriptions?.find((d: any) => d.language_id === HU_LANG_ID) ||
    category.shoprenter_category_descriptions?.[0]

  const categoryName = currentDescription?.name || category.name || 'Kategória'
  const categoryDescription = currentDescription?.description || ''

  let productContext = ''
  if (products.length > 0) {
    productContext = `\n\n=== TERMÉKEK EBBEN A KATEGÓRIÁBAN (${products.length} termék) ===\n`
    products.slice(0, 10).forEach((product: any, idx: number) => {
      const name = product.name || product.shoprenter_product_descriptions?.[0]?.name || product.sku
      const sku = product.sku || ''
      const attrs = product.product_attributes || []
      const keyAttrs = attrs
        .filter((attr: any) => attr.display_name && attr.value)
        .map((attr: any) => {
          const value = Array.isArray(attr.value)
            ? attr.value.map((v: any) => (typeof v === 'object' && v.value ? v.value : v)).join(', ')
            : attr.value
          return `${attr.display_name}: ${value}`
        })
        .slice(0, 3)
      productContext += `Termék ${idx + 1}: ${name} (SKU: ${sku})\n`
      if (keyAttrs.length > 0) productContext += `   Főbb jellemzők: ${keyAttrs.join('; ')}\n`
      productContext += '\n'
    })
  }

  return { categoryName, categoryDescription, productContext }
}

export async function generateCategoryMetaFields(
  supabase: any,
  categoryId: string,
  userId: string,
  fields: CategoryMetaField[] = ['name', 'meta_title', 'meta_description'],
  options?: { trackCredits?: boolean }
): Promise<GeneratedCategoryMeta> {
  const trackCredits = options?.trackCredits !== false
  const anthropic = getAnthropicClient()
  const { categoryName, categoryDescription, productContext } = await gatherMetaContext(supabase, categoryId)

  const results: GeneratedCategoryMeta = { tokensUsed: 0, creditsUsed: 0 }

  if (fields.includes('name')) {
    const systemPrompt = `You are an expert SEO copywriter creating optimized category names for e-commerce in Hungarian.
CRITICAL: Hungarian only, 2-5 words, SEO-friendly, clear. Return ONLY the category name.`

    const userPrompt = `Generate an optimized category name for: ${categoryName}
${productContext}
${categoryDescription ? `Current description: ${categoryDescription.substring(0, 300)}` : ''}`

    let generated = categoryName
    for (const model of MODELS_TO_TRY) {
      try {
        const message = await anthropic.messages.create({
          model,
          max_tokens: 50,
          temperature: 0.7,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
        const text = message.content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('')
          .trim()
          .replace(/^["']|["']$/g, '')
        if (text) {
          generated = text
          const tokensUsed = message.usage.input_tokens + message.usage.output_tokens
          results.tokensUsed += tokensUsed
          results.creditsUsed += 1
          if (trackCredits) {
            await trackAIUsage({
              userId,
              featureType: 'category_meta',
              tokensUsed,
              modelUsed: model,
              categoryId,
              creditsUsed: 1,
              creditType: 'ai_generation',
              metadata: { field: 'name', bulk: true }
            })
          }
          break
        }
      } catch (e: any) {
        if (e.status === 404) continue
        throw e
      }
    }
    results.name = generated
  }

  if (fields.includes('meta_title')) {
    const systemPrompt = `Expert Hungarian SEO meta title writer for e-commerce categories.
50-60 chars optimal, max 70. MUST include [CATEGORY] tag. Return ONLY the title.`

    const userPrompt = `Category: ${categoryName}
${productContext}
Generate meta title with [CATEGORY] tag, 50-60 chars.`

    let metaTitle = `[CATEGORY] - ${categoryName}`
    for (const model of MODELS_TO_TRY) {
      try {
        const message = await anthropic.messages.create({
          model,
          max_tokens: 100,
          temperature: 0.7,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
        let text = message.content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('')
          .trim()
          .replace(/^["']|["']$/g, '')
        if (text.length > 70) text = text.substring(0, 67) + '...'
        if (text.length < 30) text = `[CATEGORY] - ${categoryName}`
        if (!text.includes('[CATEGORY]')) {
          text = text.length + 12 <= 70 ? `[CATEGORY] - ${text}` : text.replace(categoryName, '[CATEGORY]')
        }
        metaTitle = text
        const tokensUsed = message.usage.input_tokens + message.usage.output_tokens
        results.tokensUsed += tokensUsed
        results.creditsUsed += 1
        if (trackCredits) {
          await trackAIUsage({
            userId,
            featureType: 'meta_title',
            tokensUsed,
            modelUsed: model,
            categoryId,
            creditsUsed: 1,
            creditType: 'ai_generation',
            metadata: { bulk: true }
          })
        }
        break
      } catch (e: any) {
        if (e.status === 404) continue
        throw e
      }
    }
    results.meta_title = metaTitle
  }

  if (fields.includes('meta_description')) {
    const systemPrompt = `Expert Hungarian SEO meta description writer for e-commerce categories.
150-160 chars, MUST include [CATEGORY] tag. Return ONLY the description.`

    const userPrompt = `Category: ${categoryName}
${productContext}
Generate meta description with [CATEGORY], 150-160 chars.`

    let metaDesc = `[CATEGORY] - Minőségi termékek, versenyképes áron. Fedezze fel és vásároljon most!`
    for (const model of MODELS_TO_TRY) {
      try {
        const message = await anthropic.messages.create({
          model,
          max_tokens: 200,
          temperature: 0.7,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
        let text = message.content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('')
          .trim()
          .replace(/^["']|["']$/g, '')
        if (text.length > 160) {
          const cutAt = text.lastIndexOf('.', 157)
          text = cutAt > 120 ? text.substring(0, cutAt + 1) : text.substring(0, 157) + '...'
        }
        if (text.length < 120) {
          const fb = `[CATEGORY] - Minőségi termékek, versenyképes áron. Fedezze fel és vásároljon most!`
          text = fb.length > 160 ? fb.substring(0, 157) + '...' : fb
        }
        if (!text.includes('[CATEGORY]')) {
          text = text.length + 12 <= 160 ? `[CATEGORY] - ${text}` : text.replace(categoryName, '[CATEGORY]')
        }
        metaDesc = text
        const tokensUsed = message.usage.input_tokens + message.usage.output_tokens
        results.tokensUsed += tokensUsed
        results.creditsUsed += 1
        if (trackCredits) {
          await trackAIUsage({
            userId,
            featureType: 'meta_description',
            tokensUsed,
            modelUsed: model,
            categoryId,
            creditsUsed: 1,
            creditType: 'ai_generation',
            metadata: { bulk: true }
          })
        }
        break
      } catch (e: any) {
        if (e.status === 404) continue
        throw e
      }
    }
    results.meta_description = metaDesc
  }

  return results
}
