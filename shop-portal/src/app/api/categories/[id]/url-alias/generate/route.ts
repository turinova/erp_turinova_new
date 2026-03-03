import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import Anthropic from '@anthropic-ai/sdk'
import { trackAIUsage } from '@/lib/ai-usage-tracker'
import { checkCreditsForAIFeature } from '@/lib/credit-checker'

/**
 * POST /api/categories/[id]/url-alias/generate
 * Generate SEO-optimized URL slug using AI
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check credits before generation
    const creditCheck = await checkCreditsForAIFeature(user.id, 'url_slug')
    if (!creditCheck.hasEnough) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient credits',
        credits: {
          available: creditCheck.available,
          required: creditCheck.required,
          limit: creditCheck.limit,
          used: creditCheck.used
        }
      }, { status: 402 }) // 402 Payment Required
    }

    // Get category with descriptions
    const { data: category, error: categoryError } = await supabase
      .from('shoprenter_categories')
      .select(`
        id,
        name,
        url_slug,
        shoprenter_category_descriptions (
          name,
          language_id
        )
      `)
      .eq('id', id)
      .single()

    if (categoryError || !category) {
      return NextResponse.json(
        { success: false, error: 'Kategória nem található' },
        { status: 404 }
      )
    }

    // Get Hungarian description
    const huDescription = (category.shoprenter_category_descriptions || []).find(
      (d: any) => d.language_id?.includes('hu') || d.language_id === 'hu'
    ) || { name: category.name || '' }

    // Get parent category name (if available)
    const { data: parentCategoryData } = await supabase
      .from('shoprenter_categories')
      .select(`
        name,
        shoprenter_category_descriptions (
          name,
          language_id
        )
      `)
      .eq('id', (category as any).parent_category_id)
      .single()

    let parentCategoryName = ''
    if (parentCategoryData?.shoprenter_category_descriptions) {
      const parentDesc = parentCategoryData.shoprenter_category_descriptions.find(
        (d: any) => d.language_id?.includes('hu') || d.language_id === 'hu'
      )
      parentCategoryName = parentDesc?.name || parentCategoryData.name || ''
    }

    // Prepare AI prompt
    const categoryName = huDescription.name || category.name || ''
    const currentSlug = category.url_slug || ''

    const prompt = `Generate an SEO-optimized URL slug for this Hungarian e-commerce category:

Category Name: ${categoryName}
Parent Category: ${parentCategoryName || '(nincs)'}
Current URL Slug: ${currentSlug || '(nincs)'}

Requirements:
- Hungarian language, convert accents to ASCII (á→a, é→e, í→i, ó→o, ö→o, ő→o, ú→u, ü→u, ű→u)
- Maximum 60 characters
- Use hyphens (-) between words
- Include primary keyword from category name
- No stop words (a, az, és, vagy, van, volt, lesz)
- Lowercase only
- No special characters except hyphens
- Make it readable and SEO-friendly
- If parent category exists, consider including it in the slug

Return ONLY the slug, nothing else. Example: "konyhai-butorok" or "konyhai-butorok-szekrenyek"`

    // Call Claude AI with retry logic for 529 (overloaded) errors
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    let message: any = null
    let lastError: any = null
    const maxRetries = 5
    const baseDelayMs = 1000

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        message = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 100,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
        break // Success, exit retry loop
      } catch (error: any) {
        lastError = error
        
        // Check if it's an overloaded error or rate limit
        const isRetryable = 
          error?.message?.includes('overloaded') ||
          error?.message?.includes('Overloaded') ||
          error?.status === 529 ||
          error?.status === 429 ||
          error?.error?.type === 'overloaded_error'
        
        if (!isRetryable || attempt === maxRetries - 1) {
          // Not retryable or last attempt - throw error
          console.error('[CATEGORY URL SLUG GENERATION] API error:', error)
          throw new Error(`Failed to generate URL slug: ${error?.message || 'Unknown error'}`)
        }
        
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = baseDelayMs * Math.pow(2, attempt)
        console.log(`[CATEGORY URL SLUG GENERATION] API overloaded (529), retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'AI nem tudott URL slug-ot generálni (túlterhelt szolgáltatás)' },
        { status: 503 } // Service Unavailable
      )
    }

    const generatedSlug = message.content[0].type === 'text' 
      ? message.content[0].text.trim()
      : ''

    if (!generatedSlug) {
      return NextResponse.json(
        { success: false, error: 'AI nem tudott URL slug-ot generálni' },
        { status: 500 }
      )
    }

    // Sanitize the generated slug
    const sanitizedSlug = generatedSlug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60) // Enforce max length

    // Track AI usage after successful generation
    const tokensUsed = message.usage.input_tokens + message.usage.output_tokens
    await trackAIUsage({
      userId: user.id,
      featureType: 'url_slug',
      tokensUsed: tokensUsed,
      modelUsed: 'claude-haiku-4-5-20251001',
      categoryId: id,
      creditsUsed: 1,
      creditType: 'ai_generation',
      metadata: { generated: true }
    })

    return NextResponse.json({
      success: true,
      data: {
        suggestedSlug: sanitizedSlug,
        currentSlug: currentSlug || '',
        previewUrl: sanitizedSlug ? `https://turinovakft.hu/${sanitizedSlug}` : null
      }
    })
  } catch (error: any) {
    console.error('Error generating URL alias:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Hiba történt az AI generálás során' },
      { status: 500 }
    )
  }
}
