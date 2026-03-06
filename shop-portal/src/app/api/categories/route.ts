import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getCategoriesForConnection } from '@/lib/categories-server'

/**
 * GET /api/categories?connection_id=XXX
 * Get categories for a connection (with hierarchy)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connection_id')

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connection_id kötelező' },
        { status: 400 }
      )
    }

    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get categories for connection
    const categories = await getCategoriesForConnection(connectionId)

    // Build hierarchy paths
    const categoryMap = new Map(categories.map(cat => [cat.id, cat]))
    const categoriesWithPaths = categories.map(category => {
      // Build path from root to this category
      const path: string[] = []
      let currentCategory: any = category
      
      while (currentCategory) {
        const desc = currentCategory.shoprenter_category_descriptions?.[0]
        const name = desc?.name || currentCategory.name || 'Névtelen'
        path.unshift(name)
        
        if (currentCategory.parent_category_id) {
          currentCategory = categoryMap.get(currentCategory.parent_category_id)
        } else {
          currentCategory = null
        }
      }

      return {
        id: category.id,
        name: category.shoprenter_category_descriptions?.[0]?.name || category.name || 'Névtelen',
        parent_category_id: category.parent_category_id,
        path: path.join(' > ')
      }
    })

    return NextResponse.json({
      success: true,
      categories: categoriesWithPaths
    })
  } catch (error) {
    console.error('Error in categories route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
