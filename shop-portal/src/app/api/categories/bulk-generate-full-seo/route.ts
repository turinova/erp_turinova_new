import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { checkAvailableCredits } from '@/lib/credit-checker'
import {
  FULL_SEO_CREDITS_PER_CATEGORY,
  generateCategoryFullSeo
} from '@/lib/category-bulk-full-seo'

export const maxDuration = 300

export const MAX_CATEGORIES_PER_REQUEST = 5
const DELAY_MS_MIN = 800
const DELAY_MS_MAX = 1500

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function jitterDelay() {
  return DELAY_MS_MIN + Math.floor(Math.random() * (DELAY_MS_MAX - DELAY_MS_MIN + 1))
}

function isRateLimitError(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return m.includes('429') || m.includes('rate limit')
}

async function generateWithRetries(
  supabase: any,
  categoryId: string,
  userId: string,
  options: Parameters<typeof generateCategoryFullSeo>[3]
) {
  let lastErr: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await generateCategoryFullSeo(supabase, categoryId, userId, options)
    } catch (e) {
      lastErr = e
      if (isRateLimitError(e) && attempt < 3) {
        const backoff = 2000 * Math.pow(2, attempt) + Math.floor(Math.random() * 800)
        await sleep(backoff)
        continue
      }
      throw e
    }
  }
  throw lastErr
}

/**
 * POST /api/categories/bulk-generate-full-seo
 * Body: { categoryIds: string[] (max 5), onlyMissing?: boolean, skipOnValidationError?: boolean }
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
    const categoryIds: string[] = Array.isArray(body.categoryIds) ? body.categoryIds : []
    const onlyMissing = body.onlyMissing !== false
    const skipOnValidationError = body.skipOnValidationError !== false
    const useProductData = body.useProductData !== false

    if (categoryIds.length === 0) {
      return NextResponse.json({ error: 'categoryIds required' }, { status: 400 })
    }
    if (categoryIds.length > MAX_CATEGORIES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_CATEGORIES_PER_REQUEST} kategória kérésenként. A kliens több batchben küldje.`
        },
        { status: 400 }
      )
    }

    const creditsThisBatch = categoryIds.length * FULL_SEO_CREDITS_PER_CATEGORY
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
      creditsUsed: 0,
      items: [] as Awaited<ReturnType<typeof generateCategoryFullSeo>>[]
    }

    for (let i = 0; i < categoryIds.length; i++) {
      const categoryId = categoryIds[i]
      results.attempted++

      if (i > 0) await sleep(jitterDelay())

      try {
        const item = await generateWithRetries(supabase, categoryId, user.id, {
          onlyMissing,
          skipOnValidationError,
          useProductData
        })
        results.items.push(item)
        results.creditsUsed += item.creditsUsed

        if (item.status === 'generated') results.generated++
        else if (item.status === 'skipped') results.skipped++
        else results.failed++
      } catch (e: any) {
        results.failed++
        results.items.push({
          categoryId,
          categoryName: '—',
          status: 'failed',
          error: e?.message || 'Unknown error',
          creditsUsed: 0,
          fieldsUpdated: []
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      creditsPerCategory: FULL_SEO_CREDITS_PER_CATEGORY,
      maxBatchSize: MAX_CATEGORIES_PER_REQUEST
    })
  } catch (error) {
    console.error('[bulk-generate-full-seo]', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk full SEO failed'
      },
      { status: 500 }
    )
  }
}
