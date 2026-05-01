import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { generateProductShortDescription } from '@/lib/ai-short-description-service'
import { trackAIUsage } from '@/lib/ai-usage-tracker'
import { checkCreditsForAIFeature } from '@/lib/credit-checker'

/**
 * POST /api/products/[id]/generate-short-description
 * Plain-text rövid leírás for Merchant / Shopping feeds (separate from long HTML description).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const creditCheck = await checkCreditsForAIFeature(user.id, 'product_short_description')
    if (!creditCheck.hasEnough) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient credits',
          credits: {
            available: creditCheck.available,
            required: creditCheck.required,
            limit: creditCheck.limit,
            used: creditCheck.used
          }
        },
        { status: 402 }
      )
    }

    const body = await request.json().catch(() => ({}))

    let generationInstructions = body.generationInstructions
    if (!generationInstructions) {
      const { data: description } = await supabase
        .from('shoprenter_product_descriptions')
        .select('generation_instructions')
        .eq('product_id', id)
        .eq('language_code', body.language || 'hu')
        .single()

      if (description?.generation_instructions) {
        generationInstructions = description.generation_instructions
      }
    }

    const options = {
      useSourceMaterials: body.useSourceMaterials !== false,
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.65,
      maxTokens: typeof body.maxTokens === 'number' ? body.maxTokens : 800,
      language: body.language || 'hu',
      generationInstructions: generationInstructions || undefined,
      useSearchConsoleQueries: body.useSearchConsoleQueries === true,
      useCompetitorContent: false,
      searchQueries: body.searchQueries
    }

    const result = await generateProductShortDescription(supabase, id, options)

    await trackAIUsage({
      userId: user.id,
      featureType: 'product_short_description',
      tokensUsed: result.tokensUsed,
      modelUsed: result.modelUsed,
      productId: id,
      creditsUsed: 2,
      creditType: 'ai_generation',
      metadata: {
        charCount: result.charCount,
        sourceMaterialsUsed: result.sourceMaterialsUsed.length,
        searchQueriesUsed: result.searchQueriesUsed?.length || 0
      }
    })

    return NextResponse.json({
      success: true,
      shortDescription: result.shortDescription,
      productType: result.productType,
      validationWarnings: result.validationWarnings,
      searchQueriesUsed: result.searchQueriesUsed,
      metrics: {
        charCount: result.charCount,
        tokensUsed: result.tokensUsed,
        modelUsed: result.modelUsed,
        sourceMaterialsUsed: result.sourceMaterialsUsed.length,
        searchQueriesUsed: result.searchQueriesUsed?.length || 0
      }
    })
  } catch (error) {
    console.error('[generate-short-description]', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Short description generation failed'
      },
      { status: 500 }
    )
  }
}
