import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/suppliers
 * Fetch all active suppliers from the database
 */
export async function GET() {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active suppliers
    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select('id, name, short_name, email, phone, website, tax_number, eu_tax_number, note, status, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching suppliers:', error)
      
return NextResponse.json(
        { error: error.message || 'Hiba a beszállítók lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ suppliers: suppliers || [] })
  } catch (error) {
    console.error('Error in suppliers API:', error)
    
return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/suppliers
 * Create a new supplier
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const { 
      name, 
      short_name, 
      email, 
      phone, 
      website, 
      tax_number, 
      eu_tax_number, 
      note,
      status = 'active'
    } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'A beszállító neve kötelező' },
        { status: 400 }
      )
    }

    if (!short_name || !String(short_name).trim()) {
      return NextResponse.json(
        { error: 'A beszállító kód kötelező' },
        { status: 400 }
      )
    }

    // Check if name already exists
    const { data: existingByName } = await supabase
      .from('suppliers')
      .select('id')
      .eq('name', name.trim())
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik beszállító ezzel a névvel' },
        { status: 400 }
      )
    }

    const supplierCode = String(short_name).trim()

    const { data: existingByCode } = await supabase
      .from('suppliers')
      .select('id')
      .ilike('short_name', supplierCode)
      .is('deleted_at', null)
      .single()

    if (existingByCode) {
      return NextResponse.json(
        { error: 'Már létezik beszállító ezzel a beszállító kóddal' },
        { status: 400 }
      )
    }

    // Create supplier
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name: name.trim(),
        short_name: supplierCode,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        website: website?.trim() || null,
        tax_number: tax_number?.trim() || null,
        eu_tax_number: eu_tax_number?.trim() || null,
        note: note?.trim() || null,
        status: status || 'active'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating supplier:', error)
      
return NextResponse.json(
        { error: error.message || 'Hiba a beszállító létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ supplier: data }, { status: 201 })
  } catch (error) {
    console.error('Error in suppliers POST API:', error)
    
return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
