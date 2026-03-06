import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * POST /api/connections/[id]/migrate-products
 * Migrate products from a deleted connection to the current connection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { fromConnectionId } = body

    if (!fromConnectionId) {
      return NextResponse.json(
        { error: 'fromConnectionId is required' },
        { status: 400 }
      )
    }

    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify target connection exists and is not deleted
    const { data: targetConnection, error: targetError } = await supabase
      .from('webshop_connections')
      .select('id, connection_type')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (targetError || !targetConnection) {
      return NextResponse.json(
        { error: 'Target connection not found or is deleted' },
        { status: 404 }
      )
    }

    // Verify source connection exists (can be deleted)
    const { data: sourceConnection, error: sourceError } = await supabase
      .from('webshop_connections')
      .select('id, connection_type')
      .eq('id', fromConnectionId)
      .single()

    if (sourceError || !sourceConnection) {
      return NextResponse.json(
        { error: 'Source connection not found' },
        { status: 404 }
      )
    }

    // Verify connection types match
    if (sourceConnection.connection_type !== targetConnection.connection_type) {
      return NextResponse.json(
        { error: 'Connection types must match' },
        { status: 400 }
      )
    }

    // Count products to migrate
    const { count: productCount, error: countError } = await supabase
      .from('shoprenter_products')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', fromConnectionId)
      .is('deleted_at', null)

    if (countError) {
      console.error('Error counting products:', countError)
      return NextResponse.json(
        { error: 'Error counting products to migrate' },
        { status: 500 }
      )
    }

    if (!productCount || productCount === 0) {
      return NextResponse.json({
        success: true,
        migrated: 0,
        message: 'No products to migrate'
      })
    }

    // Migrate products
    const { data: migratedProducts, error: migrateError } = await supabase
      .from('shoprenter_products')
      .update({ connection_id: id })
      .eq('connection_id', fromConnectionId)
      .is('deleted_at', null)
      .select('id')

    if (migrateError) {
      console.error('Error migrating products:', migrateError)
      return NextResponse.json(
        { error: 'Error migrating products: ' + migrateError.message },
        { status: 500 }
      )
    }

    // Also migrate categories
    const { data: migratedCategories, error: categoryError } = await supabase
      .from('shoprenter_categories')
      .update({ connection_id: id })
      .eq('connection_id', fromConnectionId)
      .is('deleted_at', null)
      .select('id')

    if (categoryError) {
      console.error('Error migrating categories:', categoryError)
      // Non-fatal, continue
    }

    // Also migrate tax class mappings
    const { data: migratedTaxMappings, error: taxError } = await supabase
      .from('shoprenter_tax_class_mappings')
      .update({ connection_id: id })
      .eq('connection_id', fromConnectionId)
      .select('id')

    if (taxError) {
      console.error('Error migrating tax mappings:', taxError)
      // Non-fatal, continue
    }

    return NextResponse.json({
      success: true,
      migrated: migratedProducts?.length || 0,
      categoriesMigrated: migratedCategories?.length || 0,
      taxMappingsMigrated: migratedTaxMappings?.length || 0,
      message: `Successfully migrated ${migratedProducts?.length || 0} products`
    })
  } catch (error) {
    console.error('Error in migrate-products:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
