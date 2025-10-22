import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase not configured for partners API')
    return null
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function GET() {
  try {
    const supabase = createServerClient()
    
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }
    
    const { data, error } = await supabase
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
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching partners:', error)
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }
    const body = await request.json()

    // Clean the data - convert empty strings to null for UUID fields and optional fields
    const cleanData = {
      ...body,
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
      contact_person: body.contact_person && body.contact_person.trim() !== '' ? body.contact_person : null
    }

    const { data, error } = await supabase
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
      return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
