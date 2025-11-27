import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/partners - active partners (not deleted), ordered by name
export async function GET(_request: NextRequest) {
  try {
    const { data, error } = await supabaseServer
      .from('partners')
      .select(`
        id,
        name,
        country,
        postal_code,
        city,
        address,
        mobile,
        email,
        tax_number,
        company_registration_number,
        bank_account,
        notes,
        status,
        contact_person,
        vat_id,
        currency_id,
        payment_terms,
        created_at,
        updated_at
      `)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching partners:', error)
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (e) {
    console.error('Error in GET /api/partners:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/partners - Create new partner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'A név mező kötelező' }, { status: 400 })
    }

    // Clean the data - convert empty strings to null for UUID fields and optional fields
    const cleanData = {
      name: body.name.trim(),
      vat_id: body.vat_id && body.vat_id.trim() !== '' ? body.vat_id : null,
      currency_id: body.currency_id && body.currency_id.trim() !== '' ? body.currency_id : null,
      country: body.country && body.country.trim() !== '' ? body.country : null,
      postal_code: body.postal_code && body.postal_code.trim() !== '' ? body.postal_code : null,
      city: body.city && body.city.trim() !== '' ? body.city : null,
      address: body.address && body.address.trim() !== '' ? body.address : null,
      mobile: body.mobile && body.mobile.trim() !== '' ? body.mobile : null,
      email: body.email && body.email.trim() !== '' ? body.email : null,
      tax_number: body.tax_number && body.tax_number.trim() !== '' ? body.tax_number : null,
      company_registration_number: body.company_registration_number && body.company_registration_number.trim() !== '' ? body.company_registration_number : null,
      bank_account: body.bank_account && body.bank_account.trim() !== '' ? body.bank_account : null,
      notes: body.notes && body.notes.trim() !== '' ? body.notes : null,
      contact_person: body.contact_person && body.contact_person.trim() !== '' ? body.contact_person : null,
      status: body.status || 'active',
      payment_terms: body.payment_terms && body.payment_terms > 0 ? body.payment_terms : 30, // Default to 30 if 0 or not provided
    }

    const { data, error } = await supabaseServer
      .from('partners')
      .insert([cleanData])
      .select(`
        id,
        name,
        country,
        postal_code,
        city,
        address,
        mobile,
        email,
        tax_number,
        company_registration_number,
        bank_account,
        notes,
        status,
        contact_person,
        vat_id,
        currency_id,
        payment_terms,
        created_at,
        updated_at
      `)
      .single()

    if (error) {
      console.error('Error creating partner:', error)
      
      // Handle specific error cases
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Egy beszállító már létezik ezzel a névvel' },
          { status: 409 }
        )
      }
      
      return NextResponse.json({ 
        error: 'Failed to create partner',
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating partner:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
