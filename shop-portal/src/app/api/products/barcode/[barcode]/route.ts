import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/products/barcode/[barcode]
 * Find product by barcode (supports internal_barcode, gtin, or supplier_barcode)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ barcode: string }> }
) {
  try {
    const { barcode } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!barcode || !barcode.trim()) {
      return NextResponse.json(
        { error: 'Vonalkód kötelező' },
        { status: 400 }
      )
    }

    const barcodeTrimmed = barcode.trim()

    // First, try to find by internal_barcode
    let { data: product, error } = await supabase
      .from('shoprenter_products')
      .select('id, name, sku, gtin, internal_barcode')
      .eq('internal_barcode', barcodeTrimmed)
      .is('deleted_at', null)
      .maybeSingle()

    // If not found, try gtin (supplier/manufacturer barcode)
    if (!product) {
      const { data: productByGtin } = await supabase
        .from('shoprenter_products')
        .select('id, name, sku, gtin, internal_barcode')
        .eq('gtin', barcodeTrimmed)
        .is('deleted_at', null)
        .maybeSingle()

      product = productByGtin || null
    }

    // If still not found, try supplier_barcode from product_suppliers
    if (!product) {
      const { data: productSupplier } = await supabase
        .from('product_suppliers')
        .select(`
          supplier_barcode,
          products:product_id(id, name, sku, gtin, internal_barcode)
        `)
        .eq('supplier_barcode', barcodeTrimmed)
        .is('deleted_at', null)
        .maybeSingle()

      if (productSupplier && (productSupplier as any).products) {
        product = (productSupplier as any).products
      }
    }

    if (!product) {
      return NextResponse.json(
        { error: 'Termék nem található ezzel a vonalkóddal' },
        { status: 404 }
      )
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Error in barcode lookup API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
