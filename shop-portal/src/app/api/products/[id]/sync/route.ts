import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'

/**
 * POST /api/products/[id]/sync
 * Sync a single product from ShopRenter
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

    // Get product
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('*, webshop_connections(*)')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const connection = product.webshop_connections
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    // Call the connection sync API
    const syncResponse = await fetch(`${request.nextUrl.origin}/api/connections/${connection.id}/sync-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: product.shoprenter_id
      })
    })

    const syncResult = await syncResponse.json()

    if (!syncResult.success) {
      // Update product sync status
      await supabase
        .from('shoprenter_products')
        .update({
          sync_status: 'error',
          sync_error: syncResult.error || 'Sync failed',
          last_synced_at: new Date().toISOString()
        })
        .eq('id', id)

      return NextResponse.json({ 
        success: false, 
        error: syncResult.error || 'Sync failed' 
      }, { status: 500 })
    }

    // Update product sync status
    await supabase
      .from('shoprenter_products')
      .update({
        sync_status: 'synced',
        sync_error: null,
        last_synced_at: new Date().toISOString()
      })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error syncing product:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
