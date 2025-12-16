import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { offer_ids } = body

    if (!offer_ids || !Array.isArray(offer_ids) || offer_ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott ajánlat' }, { status: 400 })
    }

    // Fetch offers to delete
    const { data: offersToDelete, error: checkError } = await supabaseAdmin
      .from('client_offers')
      .select('id, offer_number')
      .in('id', offer_ids)
      .is('deleted_at', null)

    if (checkError) {
      console.error('Error checking offers:', checkError)
      return NextResponse.json({ error: 'Hiba az ellenőrzés során' }, { status: 500 })
    }

    if (!offersToDelete || offersToDelete.length === 0) {
      return NextResponse.json({ error: 'Nincs törölhető ajánlat' }, { status: 400 })
    }

    // Soft delete all offers and items
    const now = new Date().toISOString()

    // Soft delete offers
    const { error: offersError } = await supabaseAdmin
      .from('client_offers')
      .update({ deleted_at: now })
      .in('id', offer_ids)
      .is('deleted_at', null)

    if (offersError) {
      console.error('Error soft deleting client offers:', offersError)
      return NextResponse.json({ error: 'Hiba az ajánlatok törlése során' }, { status: 500 })
    }

    // Soft delete all items in these offers
    const { error: itemsDeleteError } = await supabaseAdmin
      .from('client_offers_items')
      .update({ deleted_at: now })
      .in('client_offer_id', offer_ids)
      .is('deleted_at', null)

    if (itemsDeleteError) {
      console.error('Error soft deleting client offer items:', itemsDeleteError)
      // Don't fail, just log
    }

    return NextResponse.json({ 
      success: true, 
      deleted_count: offer_ids.length 
    })
  } catch (error) {
    console.error('Error in DELETE /api/client-offers/bulk-delete', error)
    return NextResponse.json({ error: 'Belső szerverhiba' }, { status: 500 })
  }
}

