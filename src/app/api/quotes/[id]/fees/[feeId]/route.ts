import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recalculateQuoteTotals } from '../route'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// DELETE a fee from a quote
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const { id: quoteId, feeId } = await params

    // Soft delete
    const { error } = await supabase
      .from('quote_fees')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', feeId)
      .eq('quote_id', quoteId)

    if (error) {
      console.error('Error deleting fee:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Recalculate quote totals
    await recalculateQuoteTotals(quoteId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/quotes/[id]/fees/[feeId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

