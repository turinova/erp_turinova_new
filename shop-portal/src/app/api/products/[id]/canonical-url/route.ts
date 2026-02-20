import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { 
  updateCanonicalUrlForChild,
  updateCanonicalUrlsForChildren,
  clearCanonicalUrl
} from '@/lib/canonical-url-service'

/**
 * POST /api/products/[id]/canonical-url
 * Update canonical URL for child products
 * If product is a parent, updates all its children
 * If product is a child, updates itself
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
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await request.json().catch(() => ({}))
    const action = body.action || 'update' // 'update' or 'clear'

    if (action === 'clear') {
      const result = await clearCanonicalUrl(supabase, id)
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }
      return NextResponse.json({
        success: true,
        message: 'Canonical URL cleared'
      })
    }

    // Check if product is a parent or child
    const { data: product } = await supabase
      .from('shoprenter_products')
      .select('id, parent_product_id')
      .eq('id', id)
      .single()

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // If product is a child, update itself
    if (product.parent_product_id) {
      const result = await updateCanonicalUrlForChild(supabase, id)
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }
      return NextResponse.json({
        success: true,
        message: 'Canonical URL updated for child product'
      })
    }

    // If product is a parent, update all children
    const result = await updateCanonicalUrlsForChildren(supabase, id)
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Canonical URLs updated for ${result.updated} child products`,
      updated: result.updated
    })
  } catch (error) {
    console.error('Error in POST /api/products/[id]/canonical-url:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update canonical URL'
    }, { status: 500 })
  }
}
