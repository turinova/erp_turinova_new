import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { generateProductShortDescription } from '@/lib/ai-short-description-service'
import { trackAIUsage } from '@/lib/ai-usage-tracker'
import { checkAvailableCredits } from '@/lib/credit-checker'
import { calculateCreditsForAI, type AIFeatureType } from '@/lib/credit-calculator'
import { encodeHtmlEntitiesForStorage } from '@/lib/copy-sanitize'

export const maxDuration = 300

const FEATURE: AIFeatureType = 'product_short_description'
const CREDITS_PER_PRODUCT = calculateCreditsForAI(FEATURE)
const MAX_IDS_PER_REQUEST = 20
const DELAY_MS_MIN = 280
const DELAY_MS_MAX = 620

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function jitterDelay() {
  return DELAY_MS_MIN + Math.floor(Math.random() * (DELAY_MS_MAX - DELAY_MS_MIN + 1))
}

function isRateLimitError(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return m.includes('429') || m.includes('rate limit')
}

async function generateShortWithRetries(
  supabase: any,
  productId: string,
  options: Parameters<typeof generateProductShortDescription>[2]
) {
  let lastErr: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await generateProductShortDescription(supabase, productId, options)
    } catch (e) {
      lastErr = e
      if (isRateLimitError(e) && attempt < 4) {
        const backoff = 2000 * Math.pow(2, attempt) + Math.floor(Math.random() * 800)
        console.warn(`[bulk-short-desc] Rate limit for ${productId}, retry in ${backoff}ms`)
        await sleep(backoff)
        continue
      }
      throw e
    }
  }
  throw lastErr
}

async function persistShortDescription(
  supabase: any,
  productId: string,
  language: string,
  plainShort: string
) {
  const encoded = encodeHtmlEntitiesForStorage(plainShort)

  const { data: existing, error: selErr } = await supabase
    .from('shoprenter_product_descriptions')
    .select('id')
    .eq('product_id', productId)
    .eq('language_code', language)
    .maybeSingle()

  if (selErr) {
    throw new Error(selErr.message)
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('shoprenter_product_descriptions')
      .update({
        short_description: encoded || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
    return
  }

  const { data: prod, error: pErr } = await supabase
    .from('shoprenter_products')
    .select('name')
    .eq('id', productId)
    .single()

  if (pErr || !prod) {
    throw new Error(pErr?.message || 'Product not found for description insert')
  }

  const { error: insErr } = await supabase.from('shoprenter_product_descriptions').insert({
    product_id: productId,
    language_code: language,
    name: prod.name || '',
    meta_title: null,
    meta_keywords: null,
    meta_description: null,
    short_description: encoded || null,
    description: null,
    parameters: null,
    measurement_unit: 'db',
    generation_instructions: null,
    updated_at: new Date().toISOString()
  })

  if (insErr) throw new Error(insErr.message)
}

/**
 * POST /api/products/bulk-generate-short-description
 * Body: { productIds: string[] (max 20), onlyMissing?: boolean, useSourceMaterials?: boolean, language?: string }
 * Generates Merchant-style short description per product, saves to DB immediately, tracks credits.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const productIds: string[] = Array.isArray(body.productIds) ? body.productIds : []
    const onlyMissing = body.onlyMissing !== false
    const useSourceMaterials = body.useSourceMaterials !== false
    const language = (body.language as string) || 'hu'

    if (productIds.length === 0) {
      return NextResponse.json({ error: 'productIds required (non-empty array)' }, { status: 400 })
    }
    if (productIds.length > MAX_IDS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IDS_PER_REQUEST} products per request. Send multiple batches from the client.` },
        { status: 400 }
      )
    }

    const creditsThisBatch = productIds.length * CREDITS_PER_PRODUCT
    const creditCheck = await checkAvailableCredits(user.id, creditsThisBatch)
    if (!creditCheck.hasEnough) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient credits',
          credits: {
            available: creditCheck.available,
            required: creditsThisBatch,
            limit: creditCheck.limit,
            used: creditCheck.used
          }
        },
        { status: 402 }
      )
    }

    const results = {
      attempted: 0,
      generated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ productId: string; error: string }>
    }

    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i]
      results.attempted++

      if (i > 0) {
        await sleep(jitterDelay())
      }

      try {
        if (onlyMissing) {
          const { data: descRow } = await supabase
            .from('shoprenter_product_descriptions')
            .select('short_description')
            .eq('product_id', productId)
            .eq('language_code', language)
            .maybeSingle()

          const raw = descRow?.short_description
          const decoded =
            typeof raw === 'string'
              ? raw
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&amp;/g, '&')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .trim()
              : ''
          if (decoded.length >= 30) {
            results.skipped++
            continue
          }
        }

        const gen = await generateShortWithRetries(supabase, productId, {
          useSourceMaterials,
          useSearchConsoleQueries: false,
          language,
          temperature: 0.65,
          maxTokens: 800
        })

        await persistShortDescription(supabase, productId, language, gen.shortDescription)

        await trackAIUsage({
          userId: user.id,
          featureType: FEATURE,
          tokensUsed: gen.tokensUsed,
          modelUsed: gen.modelUsed,
          productId,
          creditsUsed: CREDITS_PER_PRODUCT,
          creditType: 'ai_generation',
          metadata: {
            bulk: true,
            charCount: gen.charCount,
            sourceMaterialsUsed: gen.sourceMaterialsUsed.length
          }
        })

        results.generated++
      } catch (e: any) {
        results.failed++
        results.errors.push({
          productId,
          error: e?.message || 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      creditsPerProduct: CREDITS_PER_PRODUCT,
      maxBatchSize: MAX_IDS_PER_REQUEST
    })
  } catch (error) {
    console.error('[bulk-generate-short-description]', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk short description failed'
      },
      { status: 500 }
    )
  }
}
