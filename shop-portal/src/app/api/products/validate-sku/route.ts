import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/products/validate-sku
 * Check if a SKU already exists for a given connection
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const connectionId = searchParams.get('connectionId')
    const sku = searchParams.get('sku')

    if (!connectionId || !sku) {
      return NextResponse.json(
        { error: 'Kapcsolat ID és SKU kötelező' },
        { status: 400 }
      )
    }

    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if SKU exists
    const { data: existingProduct, error: skuCheckError } = await supabase
      .from('shoprenter_products')
      .select('id, sku')
      .eq('connection_id', connectionId)
      .eq('sku', sku.trim())
      .is('deleted_at', null)
      .maybeSingle()

    if (skuCheckError) {
      console.error('Error checking SKU:', skuCheckError)
      return NextResponse.json(
        { error: 'Hiba a SKU ellenőrzésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      exists: !!existingProduct,
      message: existingProduct 
        ? `A SKU "${sku}" már létezik ezen a kapcsolaton` 
        : 'A SKU elérhető'
    })
  } catch (error) {
    console.error('Error in GET /api/products/validate-sku:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
