import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'

/**
 * GET /api/connections/[id]/product-classes
 * Fetch all available Product Classes from database (synced from ShopRenter)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection
    const connection = await getConnectionById(id)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json(
        { error: 'Kapcsolat nem található vagy érvénytelen típus' },
        { status: 404 }
      )
    }

    // Fetch Product Classes from database
    const { data: productClasses, error } = await supabase
      .from('shoprenter_product_classes')
      .select('id, shoprenter_id, name, description')
      .eq('connection_id', connection.id)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('[PRODUCT-CLASSES] Database error:', error)
      return NextResponse.json(
        { error: 'Hiba a termék típusok lekérdezésekor' },
        { status: 500 }
      )
    }

    // Format response (use shoprenter_id as id for API compatibility)
    const formattedClasses = (productClasses || []).map((pc: any) => ({
      id: pc.shoprenter_id, // Use ShopRenter ID for API compatibility
      name: pc.name || '',
      description: pc.description || null
    }))

    return NextResponse.json({
      success: true,
      productClasses: formattedClasses
    })
  } catch (error: any) {
    console.error('Error in product-classes route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
