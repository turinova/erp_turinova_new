import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getCategoryById } from '@/lib/categories-server'

/**
 * GET /api/categories/[id]/descriptions
 * Get category descriptions
 */
export async function GET(
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

    // Get descriptions
    const { data: descriptions, error } = await supabase
      .from('shoprenter_category_descriptions')
      .select('*')
      .eq('category_id', categoryId)
      .order('language_id')

    if (error) {
      console.error('[CATEGORY DESCRIPTIONS] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch descriptions' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      descriptions: descriptions || []
    })
  } catch (error: any) {
    console.error('[CATEGORY DESCRIPTIONS] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
