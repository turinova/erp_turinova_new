import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientOfferById } from '@/lib/supabase-server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// GET - Get single client offer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await getClientOfferById(id)
    
    if (!result) {
      return NextResponse.json(
        { error: 'Ajánlat nem található' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching client offer:', error)
    return NextResponse.json(
      { error: 'Hiba az ajánlat lekérdezésekor' },
      { status: 500 }
    )
  }
}

// PATCH - Update client offer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      customer_id,
      worker_id,
      customer_name,
      customer_email,
      customer_mobile,
      billing_name,
      billing_country,
      billing_city,
      billing_postal_code,
      billing_street,
      billing_house_number,
      billing_tax_number,
      billing_company_reg_number,
      subtotal_net,
      total_vat,
      total_gross,
      discount_percentage,
      discount_amount,
      status,
      notes
    } = body

    // Validate required fields
    if (!customer_name) {
      return NextResponse.json(
        { error: 'Ügyfél neve kötelező' },
        { status: 400 }
      )
    }

    // Check if offer exists and is not deleted
    const { data: existingOffer, error: checkError } = await supabaseAdmin
      .from('client_offers')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (checkError || !existingOffer) {
      return NextResponse.json(
        { error: 'Ajánlat nem található' },
        { status: 404 }
      )
    }

    // Update offer
    const updateData: any = {
      customer_id: customer_id || null,
      worker_id: worker_id || null,
      customer_name,
      customer_email: customer_email || null,
      customer_mobile: customer_mobile || null,
      billing_name: billing_name || null,
      billing_country: billing_country || 'Magyarország',
      billing_city: billing_city || null,
      billing_postal_code: billing_postal_code || null,
      billing_street: billing_street || null,
      billing_house_number: billing_house_number || null,
      billing_tax_number: billing_tax_number || null,
      billing_company_reg_number: billing_company_reg_number || null,
      subtotal_net: subtotal_net || 0,
      total_vat: total_vat || 0,
      total_gross: total_gross || 0,
      discount_percentage: discount_percentage || 0,
      discount_amount: discount_amount || 0,
      notes: notes || null
    }

    // Only update status if provided
    if (status !== undefined) {
      updateData.status = status
    }

    const { data: offer, error: updateError } = await supabaseAdmin
      .from('client_offers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError || !offer) {
      console.error('Error updating client offer:', updateError)
      return NextResponse.json(
        { error: 'Hiba az ajánlat frissítésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      offer 
    })
  } catch (error) {
    console.error('Error updating client offer:', error)
    return NextResponse.json(
      { error: 'Hiba az ajánlat frissítésekor' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete client offer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { error } = await supabaseAdmin
      .from('client_offers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error deleting client offer:', error)
      return NextResponse.json(
        { error: 'Hiba az ajánlat törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting client offer:', error)
    return NextResponse.json(
      { error: 'Hiba az ajánlat törlésekor' },
      { status: 500 }
    )
  }
}

