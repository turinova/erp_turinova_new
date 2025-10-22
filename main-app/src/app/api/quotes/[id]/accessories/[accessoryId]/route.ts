import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recalculateQuoteTotals } from '../../fees/route'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// PATCH - Update accessory quantity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; accessoryId: string }> }
) {
  try {
    const { id: quoteId, accessoryId } = await params
    const body = await request.json()
    const { quantity } = body

    if (!quantity || quantity < 1) {
      return NextResponse.json(
        { error: 'quantity must be at least 1' },
        { status: 400 }
      )
    }

    // Get current accessory
    const { data: accessory, error: fetchError } = await supabase
      .from('quote_accessories')
      .select('*')
      .eq('id', accessoryId)
      .eq('quote_id', quoteId)
      .is('deleted_at', null)
      .single()

    if (fetchError || !accessory) {
      return NextResponse.json(
        { error: 'Accessory not found' },
        { status: 404 }
      )
    }

    // Recalculate totals
    const totalNet = Number(accessory.unit_price_net) * quantity
    const totalVat = totalNet * Number(accessory.vat_rate)
    const totalGross = totalNet + totalVat

    // Update accessory
    const { data: updated, error: updateError } = await supabase
      .from('quote_accessories')
      .update({
        quantity: quantity,
        total_net: totalNet,
        total_vat: totalVat,
        total_gross: totalGross
      })
      .eq('id', accessoryId)
      .eq('quote_id', quoteId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating accessory:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Recalculate quote totals
    await recalculateQuoteTotals(quoteId)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error in PATCH /api/quotes/[id]/accessories/[accessoryId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE an accessory from a quote
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; accessoryId: string }> }
) {
  try {
    const { id: quoteId, accessoryId } = await params

    // Soft delete
    const { error } = await supabase
      .from('quote_accessories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', accessoryId)
      .eq('quote_id', quoteId)

    if (error) {
      console.error('Error deleting accessory:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Recalculate quote totals
    await recalculateQuoteTotals(quoteId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/quotes/[id]/accessories/[accessoryId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

