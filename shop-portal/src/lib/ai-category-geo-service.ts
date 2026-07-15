/**
 * AI Category GEO Generation Service
 * Two-layer content: intro (description) + footer SEO (footerSeoText)
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  HU_LANG_ID,
  sanitizeCategoryIntroHtml,
  sanitizeCategoryFooterHtml,
  stripHtmlToPlainText,
  validateCategoryGeoContent
} from '@/lib/category-geo-validator'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

const MODELS_TO_TRY = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-20250514'
]

export type CategoryGeoProfile = 'geo-full' | 'intro-only' | 'footer-only' | 'compact'

export interface CategoryGeoGenerationOptions {
  language?: string
  temperature?: number
  useProductData?: boolean
  generationInstructions?: string
  profile?: CategoryGeoProfile
}

export interface GeneratedCategoryGeoContent {
  description: string
  footerSeoText: string
  tokensUsed: number
  productsAnalyzed: number
  modelUsed?: string
  profile: CategoryGeoProfile
}

interface CategoryAIContext {
  category: any
  currentName: string
  currentDescription: string
  currentFooter: string
  productContext: string
  commonFeatures: string[]
  productTypes: string[]
  hierarchyContext: string
  relatedCategoriesContext: string
  parentCategoryLink: string
  topProductLinks: string
  productsAnalyzed: number
}

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number
): Promise<{ text: string; tokensUsed: number; modelUsed: string }> {
  let lastError: any = null

  for (const model of MODELS_TO_TRY) {
    try {
      const message = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })

      const text = message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n')
        .trim()

      return {
        text,
        tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
        modelUsed: model
      }
    } catch (error: any) {
      lastError = error
      if (error.status === 404) continue
      if (error.status === 401 || error.status === 429) throw error
    }
  }

  throw new Error(`All Claude models failed. Last error: ${lastError?.message || 'Unknown error'}`)
}

async function gatherCategoryAIContext(
  supabase: any,
  categoryId: string,
  useProductData: boolean
): Promise<CategoryAIContext> {
  const { data: category, error: categoryError } = await supabase
    .from('shoprenter_categories')
    .select(`
      *,
      shoprenter_category_descriptions(*)
    `)
    .eq('id', categoryId)
    .is('deleted_at', null)
    .single()

  if (categoryError || !category) {
    throw new Error(categoryError?.message || 'Category not found')
  }

  const categoryDescription =
    category.shoprenter_category_descriptions?.find(
      (desc: any) => desc.language_id === HU_LANG_ID
    ) || category.shoprenter_category_descriptions?.[0]

  const currentName = categoryDescription?.name || category.name || 'Kategória'
  const currentDescription = categoryDescription?.description || ''
  const currentFooter = categoryDescription?.footer_seo_text || ''

  let products: any[] = []
  let productContext = ''
  let commonFeatures: string[] = []
  let productTypes: string[] = []
  const topProductLinks: string[] = []

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
      .limit(50)

    products = (relations || [])
      .map((rel: any) => rel.shoprenter_products)
      .filter(Boolean)
      .filter((p: any) => p.status === 1)

    if (products.length > 0) {
      productContext = `\n\n=== TERMÉKEK EBBEN A KATEGÓRIÁBAN (${products.length} termék) ===\n`

      products.slice(0, 20).forEach((product: any, idx: number) => {
        const name =
          product.name || product.shoprenter_product_descriptions?.[0]?.name || product.sku
        const sku = product.sku || ''
        const attrs = (product.product_attributes || [])
          .filter((attr: any) => attr.display_name && attr.value)
          .map((attr: any) => {
            const value = Array.isArray(attr.value)
              ? attr.value
                  .map((v: any) => (typeof v === 'object' && v.value ? v.value : v))
                  .join(', ')
              : attr.value
            return `${attr.display_name}: ${value}`
          })
          .slice(0, 5)

        const descSnippet = (
          product.shoprenter_product_descriptions?.[0]?.description ||
          product.shoprenter_product_descriptions?.[0]?.short_description ||
          ''
        )
          .replace(/<[^>]*>/g, '')
          .trim()
          .substring(0, 200)

        productContext += `Termék ${idx + 1}: ${name} (SKU: ${sku})\n`
        if (attrs.length > 0) productContext += `   Jellemzők: ${attrs.join('; ')}\n`
        if (descSnippet) productContext += `   Részlet: ${descSnippet}...\n`
        if (product.product_url) {
          productContext += `   URL: ${product.product_url}\n`
          if (idx < 5) {
            topProductLinks.push(`<a href="${product.product_url}">${name}</a>`)
          }
        }
        productContext += '\n'
      })

      const allAttributes = products
        .flatMap((p: any) => p.product_attributes || [])
        .filter((attr: any) => attr.display_name && attr.value)

      const attributeCounts: Record<string, number> = {}
      allAttributes.forEach((attr: any) => {
        attributeCounts[attr.display_name] = (attributeCounts[attr.display_name] || 0) + 1
      })

      const threshold = Math.max(2, Math.ceil(products.length * 0.25))
      commonFeatures = Object.entries(attributeCounts)
        .filter(([_, count]) => count >= threshold)
        .sort(([, a], [, b]) => b - a)
        .map(([name]) => name)
        .slice(0, 15)

      const nameWords = products
        .flatMap((p: any) => (p.name || p.sku || '').toLowerCase().split(/\s+/))
        .filter((word: string) => word.length > 3)

      const wordCounts: Record<string, number> = {}
      nameWords.forEach((word: string) => {
        wordCounts[word] = (wordCounts[word] || 0) + 1
      })

      productTypes = Object.entries(wordCounts)
        .filter(([_, count]) => count >= threshold)
        .map(([word]) => word)
        .slice(0, 8)
    }
  }

  let hierarchyContext = ''
  let parentCategoryLink = ''
  if (category.parent_category_id) {
    const { data: parentCategory } = await supabase
      .from('shoprenter_categories')
      .select('name, url_slug, category_url, shoprenter_category_descriptions(name)')
      .eq('id', category.parent_category_id)
      .is('deleted_at', null)
      .single()

    if (parentCategory) {
      const parentName =
        parentCategory.shoprenter_category_descriptions?.[0]?.name || parentCategory.name
      const parentUrl = parentCategory.category_url || ''
      hierarchyContext += `\nSzülő kategória: ${parentName}${parentUrl ? ` — URL: ${parentUrl}` : ''}`
      if (parentUrl) {
        parentCategoryLink = `<a href="${parentUrl}">${parentName}</a>`
      }
    }
  }

  const { data: childCategories } = await supabase
    .from('shoprenter_categories')
    .select('name, url_slug, category_url, shoprenter_category_descriptions(name)')
    .eq('parent_category_id', categoryId)
    .is('deleted_at', null)
    .eq('status', 1)
    .limit(8)

  let relatedCategoriesContext = ''
  if (childCategories && childCategories.length > 0) {
    relatedCategoriesContext = '\n\n=== ALKATEGÓRIÁK ===\n'
    childCategories.forEach((child: any, idx: number) => {
      const childName = child.shoprenter_category_descriptions?.[0]?.name || child.name
      const childUrl = child.category_url || child.url_slug || ''
      relatedCategoriesContext += `${idx + 1}. ${childName}${childUrl ? ` — ${childUrl}` : ''}\n`
    })
  }

  return {
    category,
    currentName,
    currentDescription,
    currentFooter,
    productContext,
    commonFeatures,
    productTypes,
    hierarchyContext,
    relatedCategoriesContext,
    parentCategoryLink,
    topProductLinks: topProductLinks.join(', '),
    productsAnalyzed: products.length
  }
}

function buildSharedUserContext(ctx: CategoryAIContext): string {
  let prompt = `Kategória: ${ctx.currentName}\n`
  if (ctx.hierarchyContext) prompt += ctx.hierarchyContext
  if (ctx.relatedCategoriesContext) prompt += ctx.relatedCategoriesContext
  if (ctx.productContext) prompt += ctx.productContext

  if (ctx.commonFeatures.length > 0) {
    prompt += `\n\nKözös jellemzők:\n${ctx.commonFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n`
  }
  if (ctx.productTypes.length > 0) {
    prompt += `\nTerméktípus kulcsszavak: ${ctx.productTypes.join(', ')}\n`
  }
  if (ctx.topProductLinks) {
    prompt += `\nKötelező termék linkek a footer utolsó szekciójában (másold be pontosan): ${ctx.topProductLinks}\n`
  }
  if (ctx.parentCategoryLink) {
    prompt += `\nSzülő kategória link a footerben: ${ctx.parentCategoryLink}\n`
  }
  if (ctx.currentDescription) {
    prompt += `\nJelenlegi intro (referencia): ${ctx.currentDescription.substring(0, 400)}\n`
  }
  if (ctx.currentFooter) {
    prompt += `\nJelenlegi footer SEO (referencia): ${ctx.currentFooter.substring(0, 400)}\n`
  }

  return prompt
}

async function generateIntro(ctx: CategoryAIContext, temperature: number, extra?: string): Promise<{ text: string; tokensUsed: number; modelUsed: string }> {
  const systemPrompt = `You are an expert Hungarian e-commerce SEO copywriter.

Write a SHORT category intro that appears ABOVE the product grid on a ShopRenter category page.

CRITICAL OUTPUT FORMAT:
- Return ONLY raw HTML — NO markdown, NO code fences, NO \`\`\`html blocks
- Use ONLY <p> tags (1-2 paragraphs). NO headings, NO lists, NO <a> links

CONTENT RULES:
- Hungarian only
- 50-90 words total — keep it SHORT
- Explain WHAT the category is and WHO it is for
- Do NOT list multiple product names — at most ONE brand or product type as example
- Do NOT repeat detailed specs (sizes, SKUs) — those belong in the footer below the grid
- First <p>: standalone 40-55 word answer (what + who + one fact)
- Second <p> (optional): one sentence on what types of products are available (generic, no SKU list)
- Natural keywords, no stuffing
- Use only facts from the provided context`

  const userPrompt = `${buildSharedUserContext(ctx)}\n\n${extra || ''}\n\nGenerate the intro HTML now (raw HTML only, no markdown).`

  const result = await callClaude(systemPrompt, userPrompt, 500, temperature)
  return { ...result, text: sanitizeCategoryIntroHtml(result.text) }
}

async function generateFooter(
  ctx: CategoryAIContext,
  temperature: number,
  extra?: string,
  introPlainText?: string
): Promise<{ text: string; tokensUsed: number; modelUsed: string }> {
  const antiDuplication = introPlainText
    ? `\n\nIMPORTANT — AVOID DUPLICATION:\nThe intro ABOVE the product grid already says:\n"${introPlainText.substring(0, 300)}"\nDo NOT repeat this text. The footer opening <p> must use a DIFFERENT angle (e.g. selection criteria, use cases, brands available).\n`
    : ''

  const systemPrompt = `You are an expert Hungarian e-commerce GEO/SEO copywriter.

Write footer SEO content that appears BELOW the product grid (footerSeoText field).

CRITICAL OUTPUT FORMAT:
- Return ONLY raw HTML — NO markdown, NO code fences, NO \`\`\`html blocks, NO plain-text headings
- You MUST use real HTML tags: <p>, <h2>, <h3>, <ul>, <li>, <a href="...">, <strong>
- Every section title MUST be <h2>, every FAQ question MUST be <h3>
- Lists MUST use <ul><li>, never bullet characters (•) or dashes

STRUCTURE (exact order):
1. <p> TL;DR (40-60 words, different from intro above grid)
2. <h2>Miben különbözik ez a kategória?</h2><p>...</p>
3. <h2>Kinek és mire ajánlott?</h2><p>...</p>
4. <h2>Fontos jellemzők és választási szempontok</h2><ul><li>...</li></ul> (4-6 items)
5. <h2>Gyakran ismételt kérdések</h2> + EXACTLY 5 pairs: <h3>Question?</h3><p>Answer 40-80 words</p>
6. <h2>Kapcsolódó kategóriák és termékek</h2><p> with 2-4 <a href="FULL_URL">label</a> links copied from context

LINK RULES:
- If a product or category URL is provided in context, you MUST use <a href="URL">Name</a>
- Never write product/category names as plain text when a URL is available
- Copy the exact href URLs from the context

CONTENT RULES:
- Hungarian only, 400-700 words plain text
- FAQ questions: natural shopper wording
- NO invented specs — only provided data`

  const userPrompt = `${buildSharedUserContext(ctx)}${antiDuplication}\n${extra || ''}\n\nGenerate the footer SEO HTML now (raw HTML only, no markdown).`

  const result = await callClaude(systemPrompt, userPrompt, 3500, temperature)
  return { ...result, text: sanitizeCategoryFooterHtml(result.text) }
}

export async function generateCategoryGeoContent(
  supabase: any,
  categoryId: string,
  options: CategoryGeoGenerationOptions = {}
): Promise<GeneratedCategoryGeoContent> {
  const {
    language = 'hu',
    temperature = 0.7,
    useProductData = true,
    generationInstructions,
    profile = 'geo-full'
  } = options

  const ctx = await gatherCategoryAIContext(supabase, categoryId, useProductData)
  const extra = generationInstructions ? `\nSPECIAL INSTRUCTIONS:\n${generationInstructions}` : ''

  let description = ctx.currentDescription
  let footerSeoText = ctx.currentFooter
  let totalTokens = 0
  let modelUsed = MODELS_TO_TRY[0]

  if (profile === 'geo-full' || profile === 'intro-only') {
    const intro = await generateIntro(ctx, temperature, extra)
    description = intro.text
    totalTokens += intro.tokensUsed
    modelUsed = intro.modelUsed
  }

  if (profile === 'geo-full' || profile === 'footer-only') {
    const introPlain = stripHtmlToPlainText(description)
    let footer = await generateFooter(ctx, temperature, extra, introPlain)
    footerSeoText = footer.text
    totalTokens += footer.tokensUsed
    modelUsed = footer.modelUsed

    let validation = validateCategoryGeoContent(
      profile === 'footer-only' ? ctx.currentDescription : description,
      footerSeoText
    )

    if (!validation.valid && (validation.stats.footerH2Count < 3 || validation.stats.footerLinkCount < 1)) {
      console.log('[AI CATEGORY GEO] Footer validation failed, retrying with stricter prompt...')
      const retryExtra = `${extra}\n\nRETRY: Previous output was missing required HTML tags or links. You MUST output valid HTML with <h2>, <h3>, <ul><li>, and <a href="..."> links using URLs from context. NO markdown fences.`
      footer = await generateFooter(ctx, 0.35, retryExtra, introPlain)
      footerSeoText = footer.text
      totalTokens += footer.tokensUsed
      modelUsed = footer.modelUsed
      validation = validateCategoryGeoContent(
        profile === 'footer-only' ? ctx.currentDescription : description,
        footerSeoText
      )
    }
  }

  description = sanitizeCategoryIntroHtml(description)
  footerSeoText = sanitizeCategoryFooterHtml(footerSeoText)

  await supabase.from('category_description_generations').insert({
    category_id: categoryId,
    generated_description: description,
    model: modelUsed,
    tokens_used: totalTokens,
    source_products_count: ctx.productsAnalyzed,
    generation_instructions: JSON.stringify({
      profile,
      footerSeoText: footerSeoText?.substring(0, 5000),
      language
    }),
    language
  })

  return {
    description,
    footerSeoText,
    tokensUsed: totalTokens,
    productsAnalyzed: ctx.productsAnalyzed,
    modelUsed,
    profile
  }
}
