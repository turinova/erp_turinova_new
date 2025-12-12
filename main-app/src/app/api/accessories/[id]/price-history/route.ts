import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabaseServer
      .from('accessory_price_history')
      .select(`
        id,
        old_base_price,
        new_base_price,
        old_multiplier,
        new_multiplier,
        old_net_price,
        new_net_price,
        old_currency_id,
        new_currency_id,
        old_vat_id,
        new_vat_id,
        changed_at,
        changed_by,
        source_type,
        source_reference,
        old_currency:old_currency_id(name),
        new_currency:new_currency_id(name),
        old_vat:old_vat_id(kulcs),
        new_vat:new_vat_id(kulcs)
      `)
      .eq('accessory_id', id)
      .order('changed_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching accessory price history:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Enrich with user emails
    const enrichedData = await Promise.all((data || []).map(async (h: any) => {
      let userEmail = null
      if (h.changed_by) {
        try {
          const { data: userData } = await supabaseServer.auth.admin.getUserById(h.changed_by)
          userEmail = userData?.user?.email || null
        } catch (err) {
          console.error('Error fetching user:', err)
        }
      }
      
      return {
        ...h,
        changed_by_user: userEmail
      }
    }))

    return NextResponse.json(enrichedData || [])
  } catch (error) {
    console.error('Error in accessory price history API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

