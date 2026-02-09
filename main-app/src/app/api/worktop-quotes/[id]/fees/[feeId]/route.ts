import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recalculateWorktopQuoteTotals } from '../route'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// DELETE - Remove a fee from a worktop quote
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const { id: worktopQuoteId, feeId } = await params

    // Soft delete the fee
    const { error } = await supabase
      .from('worktop_quote_fees')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', feeId)
      .eq('worktop_quote_id', worktopQuoteId)

    if (error) {
      console.error('Error deleting worktop quote fee:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Recalculate worktop quote totals
    await recalculateWorktopQuoteTotals(worktopQuoteId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/worktop-quotes/[id]/fees/[feeId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
