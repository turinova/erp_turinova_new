import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
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
