import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      worker_id,
      payment_type,
      customer = {},
      discount = { percentage: 0, amount: 0 },
      items = [],
      fees = []
    } = body

    // Validation
    if (!worker_id) {
      return NextResponse.json(
        { error: 'Dolgozó ID kötelező' },
        { status: 400 }
      )
    }

    if (!payment_type || !['cash', 'card'].includes(payment_type)) {
      return NextResponse.json(
        { error: 'Érvénytelen fizetési típus. Használjon "cash" vagy "card" értéket.' },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy termék szükséges a rendeléshez' },
        { status: 400 }
      )
    }

    // Validate items structure
    for (const item of items) {
      if (!item.product_type || !item.name || !item.quantity || !item.unit_price_net || !item.unit_price_gross || !item.vat_id || !item.currency_id) {
        return NextResponse.json(
          { error: 'Minden termékhez szükséges: product_type, name, quantity, unit_price_net, unit_price_gross, vat_id, currency_id' },
          { status: 400 }
        )
      }
      // Validate that appropriate ID is present based on product_type
      if (item.product_type === 'accessory' && !item.accessory_id) {
        return NextResponse.json(
          { error: 'Kellék termékekhez szükséges: accessory_id' },
          { status: 400 }
        )
      }
      if (item.product_type === 'material' && !item.material_id) {
        return NextResponse.json(
          { error: 'Bútorlap termékekhez szükséges: material_id' },
          { status: 400 }
        )
      }
      if (item.product_type === 'linear_material' && !item.linear_material_id) {
        return NextResponse.json(
          { error: 'Szálas termékekhez szükséges: linear_material_id' },
          { status: 400 }
        )
      }
    }

    // Validate fees structure (if provided)
    for (const fee of fees) {
      if (!fee.name || !fee.quantity || !fee.unit_price_net || !fee.unit_price_gross || !fee.vat_id || !fee.currency_id) {
        return NextResponse.json(
          { error: 'Minden díjhoz szükséges: name, quantity, unit_price_net, unit_price_gross, vat_id, currency_id' },
          { status: 400 }
        )
      }
    }

    // Call PostgreSQL function for atomic transaction
    const { data, error } = await supabaseServer.rpc('create_pos_sale', {
      p_worker_id: worker_id,
      p_payment_type: payment_type,
      p_customer: customer,
      p_items: items,
      p_fees: fees,
      p_discount: discount
    })

    if (error) {
      console.error('Error creating POS sale:', error)
      // Return user-friendly error message
      const errorMessage = error.message || 'Hiba történt a rendelés létrehozásakor'
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/pos/orders:', error)
    return NextResponse.json(
      { error: 'Belső szerver hiba történt' },
      { status: 500 }
    )
  }
}

