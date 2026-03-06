import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'

/**
 * GET /api/connections/[id]/categories
 * Get all available categories for a connection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params
    
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify connection exists
    const connection = await getConnectionById(connectionId)
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Get all categories for this connection with hierarchy
    const { data: categories, error } = await supabase
      .from('shoprenter_categories')
      .select(`
        id,
        name,
        url_slug,
        category_url,
        parent_category_id,
        shoprenter_category_descriptions(name, description)
      `)
      .eq('connection_id', connectionId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('[API] Error fetching categories:', error)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    // Build hierarchy
    const categoryMap = new Map()
    const rootCategories: any[] = []

    // First pass: create map
    categories?.forEach(cat => {
      categoryMap.set(cat.id, {
        ...cat,
        children: []
      })
    })

    // Second pass: build tree
    categories?.forEach(cat => {
      const category = categoryMap.get(cat.id)
      if (cat.parent_category_id && categoryMap.has(cat.parent_category_id)) {
        const parent = categoryMap.get(cat.parent_category_id)
        parent.children.push(category)
      } else {
        rootCategories.push(category)
      }
    })

    // Flatten for easier selection (but keep hierarchy info)
    const flattenCategories = (cats: any[], level = 0, path = ''): any[] => {
      const result: any[] = []
      cats.forEach(cat => {
        const catName = cat.shoprenter_category_descriptions?.[0]?.name || cat.name || 'Kategória'
        const currentPath = path ? `${path} > ${catName}` : catName
        result.push({
          ...cat,
          level,
          path: currentPath,
          displayName: catName
        })
        if (cat.children && cat.children.length > 0) {
          result.push(...flattenCategories(cat.children, level + 1, currentPath))
        }
      })
      return result
    }

    const flattened = flattenCategories(rootCategories)

    return NextResponse.json({ 
      categories: flattened,
      hierarchical: rootCategories
    })
  } catch (error) {
    console.error('[API] Error in categories route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
