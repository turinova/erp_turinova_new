import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateProductDescription } from '@/lib/ai-generation-service'
import { trackAIUsage } from '@/lib/ai-usage-tracker'

/**
 * POST /api/products/[id]/generate-description
 * Generate product description using AI with RAG
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await request.json().catch(() => ({}))
    
    // Get generation instructions from product description if not provided in request
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
      temperature: body.temperature || 0.7,
      maxTokens: body.maxTokens || 8000, // Increased default to 8000 to prevent description cutoff
      language: body.language || 'hu',
      generationInstructions: generationInstructions || undefined,
      useSearchConsoleQueries: body.useSearchConsoleQueries !== false, // Default to true
      useCompetitorContent: body.useCompetitorContent === true // Default to false for speed (can be enabled for better SEO)
    }

    // Generate description
    const result = await generateProductDescription(supabase, id, options)

    // Save generation history
    const { data: generation, error: genError } = await supabase
      .from('product_description_generations')
      .insert({
        product_id: id,
        generated_description: result.description,
        model_used: result.modelUsed,
        source_materials_used: result.sourceMaterialsUsed,
        word_count: result.wordCount,
        status: 'draft'
      })
      .select()
      .single()

    if (genError) {
      console.error('Error saving generation history:', genError)
      // Continue anyway - generation was successful
    }

    // Track AI usage
    await trackAIUsage({
      userId: user.id,
      featureType: 'product_description',
      tokensUsed: result.tokensUsed,
      modelUsed: result.modelUsed,
      productId: id,
      metadata: {
        wordCount: result.wordCount,
        sourceMaterialsUsed: result.sourceMaterialsUsed.length,
        searchQueriesUsed: result.searchQueriesUsed?.length || 0
      }
    })

    return NextResponse.json({
      success: true,
      description: result.description,
      generationId: generation?.id,
      productType: result.productType,
      validationWarnings: result.validationWarnings,
      searchQueriesUsed: result.searchQueriesUsed,
      metrics: {
        wordCount: result.wordCount,
        tokensUsed: result.tokensUsed,
        modelUsed: result.modelUsed,
        sourceMaterialsUsed: result.sourceMaterialsUsed.length,
        searchQueriesUsed: result.searchQueriesUsed?.length || 0
      }
    })

  } catch (error) {
    console.error('Error in POST /api/products/[id]/generate-description:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Description generation failed'
    }, { status: 500 })
  }
}
