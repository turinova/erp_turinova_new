import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/purchase-orders/[id]/approve
 * Approve a purchase order (sets approved_at, approved_by, status = 'approved')
 */
export async function PUT(
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

    // Check if PO exists and get current status
    const { data: existingPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, status, item_count')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingPO) {
      return NextResponse.json(
        { error: 'Beszerzési rendelés nem található' },
        { status: 404 }
      )
    }

    // Validate status transition
    if (existingPO.status !== 'pending_approval' && existingPO.status !== 'draft') {
      return NextResponse.json(
        { error: `Csak 'vázlat' vagy 'jóváhagyásra vár' státuszú rendelés jóváhagyható. Jelenlegi státusz: ${existingPO.status}` },
        { status: 400 }
      )
    }

    // Must have at least one item
    if (existingPO.item_count === 0) {
      return NextResponse.json(
        { error: 'A rendelésnek legalább egy tétele kell legyen' },
        { status: 400 }
      )
    }

    // Update purchase order (do not touch note — preserve existing value)
    const { data: updatedPO, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id
      })
      .eq('id', id)
      .select(`
        *,
        suppliers:supplier_id(id, name),
        warehouses:warehouse_id(id, name),
        approved_by_user:approved_by(id, email, full_name)
      `)
      .single()

    if (updateError) {
      console.error('Error approving purchase order:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Hiba a beszerzési rendelés jóváhagyásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ purchase_order: updatedPO })
  } catch (error) {
    console.error('Error in purchase orders approve API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
