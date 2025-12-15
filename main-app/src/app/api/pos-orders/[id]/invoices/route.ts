import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// GET /api/pos-orders/[id]/invoices - list invoices for a POS order (provider = szamlazz_hu)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('related_order_type', 'pos_order')
      .eq('related_order_id', id)
      .eq('provider', 'szamlazz_hu')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invoices for POS order:', error)
      return NextResponse.json({ error: 'Hiba a számlák lekérdezésekor' }, { status: 500 })
    }

    return NextResponse.json({ invoices: data || [] })
  } catch (error: any) {
    console.error('Unhandled error in GET pos-order invoices:', error)
    return NextResponse.json(
      { error: error.message || 'Belső hiba a számlák lekérdezésekor' },
      { status: 500 }
    )
  }
}


