/**
 * AI short product description (rövid leírás) for Merchant / Shopping-style feeds.
 * Plain text, no internal links, fact-grounded — separate from long HTML description.
 */

import {
  detectProductType,
  findRelevantChunks,
  getAnthropicClient,
  validateDescription,
  type GenerationOptions
} from './ai-generation-service'
import { mergeSearchQueriesByImpressions, variantDifferentiatorFromAttributes } from './product-variant-helpers'
import { sanitizeAiTypography } from './copy-sanitize'

const MAX_CHARS = 1000
const MIN_TARGET_CHARS = 500

export interface ShortDescriptionResult {
  shortDescription: string
  charCount: number
  /** Sum of input+output tokens across primary and optional shorten calls */
  tokensUsed: number
  modelUsed: string
  sourceMaterialsUsed: string[]
  productType?: string
  validationWarnings?: string[]
  searchQueriesUsed?: Array<{ query: string; impressions: number; clicks: number }>
}

function formatAttributeValue(attr: any): string {
  if (!attr || attr.value === null || attr.value === undefined) {
    return 'N/A'
  }
  if (attr.type === 'LIST' && Array.isArray(attr.value)) {
    const values = attr.value
      .map((val: any) => {
        if (typeof val === 'object' && val.value !== null && val.value !== undefined) {
          return String(val.value)
        }
        if (typeof val === 'string') return val
        return null
      })
      .filter((v: any) => v !== null && v !== '')
    return values.length > 0 ? values.join(', ') : 'N/A'
  }
  if (attr.type === 'TEXT' && Array.isArray(attr.value)) {
    const values = attr.value
      .map((val: any) => {
        if (typeof val === 'object' && val.value !== null && val.value !== undefined) {
          return String(val.value)
        }
        if (typeof val === 'string') return val
        return null
      })
      .filter((v: any) => v !== null && v !== '')
    return values.length > 0 ? values.join(', ') : 'N/A'
  }
  if (attr.value !== null && attr.value !== undefined) {
    return String(attr.value)
  }
  return 'N/A'
}

function stripToPlainText(text: string): string {
  let s = text.trim()
  s = s.replace(/<[^>]+>/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return sanitizeAiTypography(s, { isHtml: false })
}

async function buildShortDescriptionContext(
  supabase: any,
  product: any,
  sourceMaterials: any[],
  relevantChunks: any[],
  searchQueries?: Array<{ query: string; impressions: number; clicks: number; ctr: number; position: number }>,
  parentProduct?: any | null,
  variantSeoHints?: {
    siblingProducts?: Array<{ sku: string; name: string | null; differentiator: string }>
    parentHasNoChildren?: boolean
  }
): Promise<string> {
  let context = `\n\nPRODUCT INFORMATION:\n`
  if (product.model_number) {
    context += `- Gyártói cikkszám (model_number): ${product.model_number}\n`
  }
  context += `- Name: ${product.name || 'N/A'}\n`
  context += `- SKU (belső azonosító, lehetőleg ne ismételd): ${product.sku}\n`
  const manufacturerName = (product.manufacturers as any)?.name || product.brand || null
  if (manufacturerName) {
    context += `- Brand/Manufacturer: ${manufacturerName}\n`
  }
  if (product.gtin) {
    context += `- GTIN: ${product.gtin}\n`
  }

  if (product.product_attributes && Array.isArray(product.product_attributes) && product.product_attributes.length > 0) {
    context += `\n=== PRODUCT ATTRIBUTES (THIS PRODUCT) ===\n`
    product.product_attributes.forEach((attr: any) => {
      const hasValue =
        attr &&
        ((attr.value !== null && attr.value !== undefined) ||
          (Array.isArray(attr.value) && attr.value.length > 0))
      if (hasValue) {
        const displayName = attr.display_name || attr.name || 'N/A'
        const value = formatAttributeValue(attr)
        const prefix = attr.prefix ? `${attr.prefix} ` : ''
        const postfix = attr.postfix ? ` ${attr.postfix}` : ''
        context += `- ${displayName}: ${prefix}${value}${postfix}\n`
      }
    })
  }

  if (parentProduct?.product_attributes?.length) {
    context += `\n=== PARENT PRODUCT ATTRIBUTES (${parentProduct.sku}) ===\n`
    parentProduct.product_attributes.forEach((attr: any) => {
      if (attr.value !== null && attr.value !== undefined) {
        const displayName = attr.display_name || attr.name || 'N/A'
        const value = formatAttributeValue(attr)
        const prefix = attr.prefix ? `${attr.prefix} ` : ''
        const postfix = attr.postfix ? ` ${attr.postfix}` : ''
        context += `- ${displayName}: ${prefix}${value}${postfix}\n`
      }
    })
    context += `Include shared parent facts where relevant for this variant.\n`
  }

  const { data: categoryRelations } = await supabase
    .from('shoprenter_product_category_relations')
    .select(
      `
      shoprenter_categories(
        id,
        name,
        shoprenter_category_descriptions(name)
      )
    `
    )
    .eq('product_id', product.id)
    .is('deleted_at', null)

  const categories = (categoryRelations || [])
    .map((rel: any) => rel.shoprenter_categories)
    .filter(Boolean)

  if (categories.length > 0) {
    const names = categories
      .map((c: any) => c.shoprenter_category_descriptions?.[0]?.name || c.name)
      .filter(Boolean)
    context += `\n=== CATEGORY NAMES (reference only — DO NOT add links or URLs) ===\n`
    context += names.join(', ') + '\n'
  }

  if (variantSeoHints?.parentHasNoChildren) {
    context += `\n=== NOTE ===\n`
    context += `No synced child variants for this parent — do not claim multiple purchasable variants unless attributes/sources say so.\n`
  }

  if (variantSeoHints?.siblingProducts?.length) {
    context += `\n=== OTHER VARIANTS (differentiate THIS SKU in the opening sentence) ===\n`
    variantSeoHints.siblingProducts.forEach((s, i) => {
      context += `${i + 1}. ${s.sku} — ${s.name || 'N/A'} — ${s.differentiator || 'n/a'}\n`
    })
  }

  if (sourceMaterials.length > 0) {
    context += `\n=== SOURCE MATERIALS (summaries) ===\n`
    sourceMaterials.forEach((source: any, index: number) => {
      context += `Source ${index + 1}: ${source.title || source.source_type}\n`
      if (source.extracted_text) {
        context += `${String(source.extracted_text).slice(0, 280)}...\n`
      }
    })
  }

  if (relevantChunks.length > 0) {
    context += `\n=== RELEVANT CHUNKS ===\n`
    relevantChunks.forEach((chunk: any, index: number) => {
      context += `[${index + 1} - ${chunk.chunk_type}]\n${chunk.chunk_text}\n\n`
    })
  }

  if (searchQueries && searchQueries.length > 0) {
    const sorted = [...searchQueries].sort((a, b) => {
      const scoreA = a.impressions * 0.6 + a.clicks * 0.4
      const scoreB = b.impressions * 0.6 + b.clicks * 0.4
      return scoreB - scoreA
    })
    context += `\n=== SEARCH QUERIES (optional — weave at most 1–2 phrases if they clearly match this product) ===\n`
    sorted.slice(0, 8).forEach((q, i) => {
      context += `${i + 1}. "${q.query}" (${q.impressions} impr., ${q.clicks} clicks)\n`
    })
  }

  return context
}

export async function generateProductShortDescription(
  supabase: any,
  productId: string,
  options: GenerationOptions = {}
): Promise<ShortDescriptionResult> {
  const {
    useSourceMaterials = true,
    temperature = 0.65,
    maxTokens = 800,
    language = 'hu',
    generationInstructions,
    useSearchConsoleQueries = false,
    searchQueries
  } = options

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [productResult, sourcesResult, childrenResult, searchQueriesResult] = await Promise.all([
    supabase
      .from('shoprenter_products')
      .select(`*, manufacturers ( name )`)
      .eq('id', productId)
      .single(),
    useSourceMaterials
      ? supabase
          .from('product_source_materials')
          .select('*')
          .eq('product_id', productId)
          .eq('processing_status', 'processed')
          .order('priority', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from('shoprenter_products')
      .select('id, sku, name, model_number, price, product_attributes')
      .eq('parent_product_id', productId)
      .eq('status', 1),
    useSearchConsoleQueries && !searchQueries
      ? supabase
          .from('product_search_queries')
          .select('query, impressions, clicks, ctr, position')
          .eq('product_id', productId)
          .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
          .order('impressions', { ascending: false })
          .limit(15)
      : Promise.resolve({ data: [] })
  ])

  const { data: product, error: productError } = productResult
  if (productError || !product) {
    throw new Error('Product not found')
  }

  if (product.product_attributes) {
    if (typeof product.product_attributes === 'string') {
      try {
        product.product_attributes = JSON.parse(product.product_attributes)
      } catch {
        product.product_attributes = null
      }
    }
    if (!Array.isArray(product.product_attributes)) {
      product.product_attributes = null
    }
  }

  let sourceMaterials: any[] = sourcesResult.data || []
  let relevantChunks: any[] = []
  if (useSourceMaterials && sourceMaterials.length > 0) {
    const query = `Product facts ${product.sku} ${product.name || ''} cabinet hardware`
    relevantChunks = await findRelevantChunks(supabase, productId, query, 8)
  }

  const productType = detectProductType(product.name || '', product.sku || '')
  let parentProduct: any = null
  const childProducts: any[] = childrenResult.data || []
  let siblingProducts: any[] = []
  const isParentHub = !product.parent_product_id || product.parent_product_id === product.id
  let isChild = false

  if (product.parent_product_id && product.parent_product_id !== product.id) {
    isChild = true
    const { data: parent } = await supabase
      .from('shoprenter_products')
      .select('id, sku, name, model_number, product_attributes')
      .eq('id', product.parent_product_id)
      .single()
    if (parent) {
      if (parent.product_attributes && typeof parent.product_attributes === 'string') {
        try {
          parent.product_attributes = JSON.parse(parent.product_attributes)
        } catch {
          parent.product_attributes = null
        }
      }
      if (parent.product_attributes && !Array.isArray(parent.product_attributes)) {
        parent.product_attributes = null
      }
      parentProduct = parent
      const { data: sibs } = await supabase
        .from('shoprenter_products')
        .select('id, sku, name, product_attributes')
        .eq('parent_product_id', product.parent_product_id)
        .neq('id', product.id)
        .eq('status', 1)
      siblingProducts = sibs || []
    }
  }

  let queriesToUse = searchQueries
  if (useSearchConsoleQueries && !queriesToUse && searchQueriesResult.data?.length) {
    queriesToUse = searchQueriesResult.data
  }
  if (useSearchConsoleQueries && !searchQueries && isChild && parentProduct) {
    const { data: parentQueries } = await supabase
      .from('product_search_queries')
      .select('query, impressions, clicks, ctr, position')
      .eq('product_id', parentProduct.id)
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
      .order('impressions', { ascending: false })
      .limit(15)
    const mappedParent = (parentQueries || []).map((p: any) => ({
      query: p.query || '',
      impressions: p.impressions || 0,
      clicks: p.clicks || 0,
      ctr: p.ctr,
      position: p.position
    }))
    const merged = mergeSearchQueriesByImpressions(queriesToUse || [], mappedParent)
    queriesToUse = merged.length > 0 ? merged : queriesToUse
  }

  const parseAttrsLocal = (raw: unknown): any[] | null => {
    if (raw == null) return null
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      try {
        const p = JSON.parse(raw)
        return Array.isArray(p) ? p : null
      } catch {
        return null
      }
    }
    return null
  }

  const siblingHints =
    isChild && siblingProducts.length > 0
      ? siblingProducts.map((s: any) => ({
          sku: s.sku,
          name: s.name,
          differentiator: variantDifferentiatorFromAttributes(parseAttrsLocal(s.product_attributes))
        }))
      : undefined

  const context = await buildShortDescriptionContext(
    supabase,
    product,
    sourceMaterials,
    relevantChunks,
    queriesToUse,
    parentProduct,
    {
      siblingProducts: siblingHints,
      parentHasNoChildren: isParentHub && childProducts.length === 0
    }
  )

  const systemPrompt = `You write concise Hungarian plain-text product descriptions for shopping feeds (Merchant Center style).

OUTPUT RULES (STRICT):
- Plain text ONLY: no HTML, no markdown, no bullet lists with *, no URLs, no "www", no links.
- Length: ${MIN_TARGET_CHARS}-${MAX_CHARS} characters total (including spaces). Never exceed ${MAX_CHARS} characters.
- The FIRST paragraph (roughly the first 160-250 characters) MUST state: what the product is, brand/manufacturer if known, gyártói cikkszám (model_number) if provided, and what makes THIS variant different from siblings (size, color, load, etc.).
- Prefer model_number over SKU for identification; mention SKU at most once if needed, often omit.
- Use ONLY facts from the provided context (attributes, chunks, sources). Do NOT invent features, soft-close, capacities, or certifications.
- Do NOT mention specific prices, Ft amounts, or promotional deals.
- Tone: factual, calm, like an experienced webshop editor; not marketing boilerplate and not chatbot polish.
- Language: ${language === 'hu' ? 'Hungarian only' : `Write in language code: ${language}`} (brand names may stay as-is).
- **Punctuation**: Use commas and periods only between clauses. Do NOT output Unicode em dash (U+2014), en dash (U+2013), or the … character; use "..." only if needed. Number ranges: ASCII hyphen (300-550).

**SOUND HUMAN: AVOID "AI" PATTERNS (helps quality perception & helpfulness):**
- Do NOT chain filler openers: avoid stacking "Fontos, hogy", "Érdemes tudni", "Összességében", "Kiemelendő", "Ráadásul", "Ezen felül"; at most one such phrase in the whole text, or none.
- Do NOT use empty superlatives: "tökéletes mindenre", "ideális választás", "kiemelkedő megoldás" without concrete support from context.
- Vary sentence length and first words; no three sentences in a row starting the same way or with the same rhythm.
- Prefer **numbers and specs** from attributes over vague claims.
- No meta lines: "Az alábbiakban", "Ebben a szövegben", "Összefoglalva".
- At most **one** short rhetorical question in the entire piece, or zero.

STRUCTURE:
- 2-4 short paragraphs separated by a single blank line (use one newline between paragraphs only; still plain text).

IDENTIFIER PRIORITY:
- If model_number exists, include it naturally in the first paragraph.

Return ONLY the description text, nothing else.`

  const userPrompt = `Write the short product description.

Style: írj úgy, mintha egy tapasztalt magyar webshop-szerkesztő fogalmazta volna boltba / Merchant feedbe; ne úgy, mint egy általános chatbot. Ne használj gondolatjelet (hosszú kötőjel) a mondatok között.

Product line: ${product.name || product.sku}${product.model_number ? ` | Gyártói cikkszám: ${product.model_number}` : ''}

DETECTED TYPE: ${productType.type} (${productType.description})
Confidence: ${productType.confidence}

${childProducts.length > 0 ? `PARENT with ${childProducts.length} variants: summarize range without highlighting one child only; include shared specs.\n` : ''}

${generationInstructions ? `Extra instructions from merchant:\n${generationInstructions}\n\n` : ''}

CONTEXT:${context}`

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables. Please add it to .env.local')
  }

  const modelsToTry = [
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-20250514'
  ]

  let message: any = null
  let modelUsed = ''
  let lastError: any = null
  const anthropic = getAnthropicClient()

  for (const model of modelsToTry) {
    try {
      message = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
      modelUsed = model
      break
    } catch (err: any) {
      lastError = err
      const statusCode = err?.status || err?.statusCode || err?.response?.status
      if (statusCode === 401 || statusCode === 403) {
        throw new Error(
          `Anthropic API authentication failed (${statusCode}). Check ANTHROPIC_API_KEY. ${err?.message || ''}`
        )
      }
      if (statusCode === 429) {
        throw new Error(`Anthropic API rate limit exceeded. ${err?.message || ''}`)
      }
    }
  }

  if (!message) {
    throw new Error(`Short description generation failed: ${lastError?.message || 'Unknown error'}`)
  }

  let raw =
    message.content[0]?.type === 'text' ? message.content[0].text : ''
  let shortDescription = stripToPlainText(raw)

  let tokensUsed = message.usage.input_tokens + message.usage.output_tokens

  const shortenIfNeeded = async (text: string): Promise<string> => {
    if (text.length <= MAX_CHARS && !/https?:\/\//i.test(text)) {
      return sanitizeAiTypography(text, { isHtml: false })
    }
    try {
      const shortenSystem = `You compress Hungarian plain-text product descriptions.

RULES:
- Output plain text only, no HTML, no URLs.
- Max ${MAX_CHARS} characters including spaces.
- Do not add new facts; only shorten or remove words.
- Keep the first sentence as the strongest identity line (product type, brand, model_number if present).
- 2-4 paragraphs max, single newline between paragraphs.
- When cutting, prefer removing filler and repeated connectors; keep concrete specs; do NOT make tone more robotic or template-like.
- Do NOT introduce em dash or en dash; use commas.

Return ONLY the text.`

      const shortened = await anthropic.messages.create({
        model: modelUsed || 'claude-sonnet-4-6',
        max_tokens: 500,
        temperature: 0.2,
        system: shortenSystem,
        messages: [
          {
            role: 'user',
            content: `Trim to <= ${MAX_CHARS} characters and remove any URLs:\n\n${text}`
          }
        ]
      })
      if (shortened.usage) {
        tokensUsed += shortened.usage.input_tokens + shortened.usage.output_tokens
      }
      const t =
        shortened.content[0]?.type === 'text' ? shortened.content[0].text.trim() : ''
      return stripToPlainText(t || text).slice(0, MAX_CHARS)
    } catch {
      return stripToPlainText(text).slice(0, MAX_CHARS)
    }
  }

  shortDescription = await shortenIfNeeded(shortDescription)
  shortDescription = stripToPlainText(shortDescription).replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim()
  shortDescription = sanitizeAiTypography(shortDescription, { isHtml: false })

  const validation = validateDescription(shortDescription, product.name || product.sku, productType)
  const warnings = [...validation.warnings]
  if (shortDescription.length < 200) {
    warnings.push('A generált rövid leírás meglehetősen rövid; érdemes kézzel kiegészíteni.')
  }
  if (/https?:\/\//i.test(shortDescription)) {
    warnings.push('A szöveg URL-t tartalmazott; eltávolításra került. Ellenőrizd.')
  }

  return {
    shortDescription,
    charCount: shortDescription.length,
    tokensUsed,
    modelUsed,
    sourceMaterialsUsed: sourceMaterials.map((s: any) => s.id),
    productType: productType.type,
    validationWarnings: warnings.length > 0 ? warnings : undefined,
    searchQueriesUsed:
      queriesToUse && queriesToUse.length > 0
        ? queriesToUse.slice(0, 8).map(q => ({
            query: q.query,
            impressions: q.impressions,
            clicks: q.clicks
          }))
        : undefined
  }
}
