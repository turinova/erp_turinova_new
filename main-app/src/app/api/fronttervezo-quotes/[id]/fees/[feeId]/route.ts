import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { recalculateFronttervezoQuoteTotals } from '@/lib/fronttervezo-quote-totals'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const { id: quoteId, feeId } = await params

    const { error } = await supabase
      .from('fronttervezo_quote_fees')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', feeId)
      .eq('quote_id', quoteId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await recalculateFronttervezoQuoteTotals(quoteId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[fronttervezo fee DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
