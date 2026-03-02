import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

    const { data: relations, error } = await supabase
      .from('shoprenter_product_category_relations')
      .select(`
        category_id,
        shoprenter_categories(
          id,
          name,
          url_slug,
          category_url,
          shoprenter_category_descriptions(name, description)
        )
      `)
      .eq('product_id', id)
      .is('deleted_at', null)

    if (error) {
      console.error('[API] Error fetching categories for product:', error)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    // Extract categories from relations
    const categories = (relations || [])
      .map(rel => rel.shoprenter_categories)
      .filter(Boolean)

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('[API] Error in categories route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
