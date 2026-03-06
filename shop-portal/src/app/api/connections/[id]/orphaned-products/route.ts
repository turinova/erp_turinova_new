import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/connections/[id]/orphaned-products
 * Check for orphaned products from deleted connections with same credentials
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

    // Get current connection details
    const { data: currentConnection, error: connError } = await supabase
      .from('webshop_connections')
      .select('id, connection_type, api_url, username, password')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (connError || !currentConnection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    // Find deleted connections with same credentials
    const { data: deletedConnections, error: deletedError } = await supabase
      .from('webshop_connections')
      .select('id, name, deleted_at')
      .eq('connection_type', currentConnection.connection_type)
      .eq('api_url', currentConnection.api_url)
      .eq('username', currentConnection.username)
      .eq('password', currentConnection.password)
      .not('deleted_at', 'is', null)
      .neq('id', id)

    if (deletedError) {
      console.error('Error finding deleted connections:', deletedError)
      return NextResponse.json(
        { error: 'Error checking for orphaned products' },
        { status: 500 }
      )
    }

    if (!deletedConnections || deletedConnections.length === 0) {
      return NextResponse.json({
        hasOrphanedProducts: false,
        orphanedConnections: []
      })
    }

    // Check for orphaned products from deleted connections
    const orphanedConnections = []
    for (const deletedConn of deletedConnections) {
      const { count, error: countError } = await supabase
        .from('shoprenter_products')
        .select('*', { count: 'exact', head: true })
        .eq('connection_id', deletedConn.id)
        .is('deleted_at', null)

      if (!countError && count && count > 0) {
        orphanedConnections.push({
          id: deletedConn.id,
          name: deletedConn.name,
          deletedAt: deletedConn.deleted_at,
          productCount: count
        })
      }
    }

    return NextResponse.json({
      hasOrphanedProducts: orphanedConnections.length > 0,
      orphanedConnections
    })
  } catch (error) {
    console.error('Error in orphaned-products:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
