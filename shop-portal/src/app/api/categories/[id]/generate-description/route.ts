import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getCategoryById } from '@/lib/categories-server'
import { generateCategoryDescription } from '@/lib/ai-category-generation-service'

/**
 * POST /api/categories/[id]/generate-description
 * Generate AI category description
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params
    
    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get category
    const category = await getCategoryById(categoryId)
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const {
      language = 'hu',
      useProductData = true,
      temperature = 0.7,
      maxTokens = 2000,
      generationInstructions
    } = body

    // Generate description
    const result = await generateCategoryDescription(
      supabase,
      categoryId,
      {
        language,
        useProductData,
        temperature,
        maxTokens,
        generationInstructions
      }
    )

    return NextResponse.json({
      success: true,
      description: result.description,
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
