import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getCategoryById } from '@/lib/categories-server'
import { generateCategoryDescription } from '@/lib/ai-category-generation-service'
import {
  generateCategoryGeoContent,
  type CategoryGeoProfile
} from '@/lib/ai-category-geo-service'
import { validateCategoryGeoContent } from '@/lib/category-geo-validator'
import { trackAIUsage } from '@/lib/ai-usage-tracker'
import { checkCreditsForAIFeature } from '@/lib/credit-checker'
import { calculateCreditsForAI } from '@/lib/credit-calculator'

/**
 * POST /api/categories/[id]/generate-description
 * Generate AI category description (compact intro or full GEO package)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const category = await getCategoryById(categoryId)
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      language = 'hu',
      useProductData = true,
      temperature = 0.7,
      maxTokens = 2000,
      generationInstructions,
      profile = 'geo-full'
    } = body as {
      language?: string
      useProductData?: boolean
      temperature?: number
      maxTokens?: number
      generationInstructions?: string
      profile?: CategoryGeoProfile
    }

    const isGeoProfile = profile === 'geo-full' || profile === 'intro-only' || profile === 'footer-only'
    const featureType = isGeoProfile ? 'category_geo_description' : 'category_description'

    const creditCheck = await checkCreditsForAIFeature(user.id, featureType)
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
      }, { status: 402 })
    }

    const creditsUsed = calculateCreditsForAI(featureType)

    if (isGeoProfile) {
      const result = await generateCategoryGeoContent(supabase, categoryId, {
        language,
        useProductData,
        temperature,
        generationInstructions,
        profile
      })

      const validation = validateCategoryGeoContent(result.description, result.footerSeoText)

      await trackAIUsage({
        userId: user.id,
        featureType: 'category_geo_description',
        tokensUsed: result.tokensUsed,
        modelUsed: result.modelUsed || 'claude-sonnet-4-6',
        categoryId,
        creditsUsed,
        creditType: 'ai_generation',
        metadata: {
          productsAnalyzed: result.productsAnalyzed,
          language,
          useProductData,
          profile: result.profile
        }
      })

      return NextResponse.json({
        success: true,
        profile: result.profile,
        description: result.description,
        footerSeoText: result.footerSeoText,
        tokensUsed: result.tokensUsed,
        productsAnalyzed: result.productsAnalyzed,
        validation
      })
    }

    const result = await generateCategoryDescription(supabase, categoryId, {
      language,
      useProductData,
      temperature,
      maxTokens,
      generationInstructions
    })

    await trackAIUsage({
      userId: user.id,
      featureType: 'category_description',
      tokensUsed: result.tokensUsed,
      modelUsed: result.modelUsed || 'claude-sonnet-4-6',
      categoryId,
      creditsUsed,
      creditType: 'ai_generation',
      metadata: {
        productsAnalyzed: result.productsAnalyzed,
        language,
        useProductData,
        profile: 'compact'
      }
    })

    return NextResponse.json({
      success: true,
      profile: 'compact',
      description: result.description,
      footerSeoText: null,
      tokensUsed: result.tokensUsed,
      productsAnalyzed: result.productsAnalyzed
    })
  } catch (error: any) {
    console.error('[CATEGORY AI GENERATION] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate category description'
    }, { status: 500 })
  }
}
