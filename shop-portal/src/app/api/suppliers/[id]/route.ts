import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/suppliers/[id]
 * Fetch a single supplier with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch supplier with related data
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Beszállító nem található' },
        { status: 404 }
      )
    }

    // Fetch addresses
    const { data: addresses } = await supabase
      .from('supplier_addresses')
      .select('*')
      .eq('supplier_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    // Fetch bank accounts
    const { data: bankAccounts } = await supabase
      .from('supplier_bank_accounts')
      .select('*')
      .eq('supplier_id', id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    // Fetch order channels
    const { data: orderChannels } = await supabase
      .from('supplier_order_channels')
      .select('*')
      .eq('supplier_id', id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    return NextResponse.json({
      supplier: {
        ...supplier,
        addresses: addresses || [],
        bank_accounts: bankAccounts || [],
        order_channels: orderChannels || []
      }
    })
  } catch (error) {
    console.error('Error in suppliers GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/suppliers/[id]
 * Update a supplier
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      status,
      default_payment_method_id,
      default_payment_terms_days,
      default_vat_id,
      default_currency_id
    } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'A beszállító neve kötelező' },
        { status: 400 }
      )
    }

    // Check if name already exists (excluding current record)
    const { data: existingByName } = await supabase
      .from('suppliers')
      .select('id')
      .eq('name', name.trim())
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik beszállító ezzel a névvel' },
        { status: 400 }
      )
    }

    // Update supplier
    const { data, error } = await supabase
      .from('suppliers')
      .update({
        name: name.trim(),
        short_name: short_name?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        website: website?.trim() || null,
        tax_number: tax_number?.trim() || null,
        eu_tax_number: eu_tax_number?.trim() || null,
        note: note?.trim() || null,
        status: status || 'active',
        default_payment_method_id: default_payment_method_id || null,
        default_payment_terms_days: default_payment_terms_days || null,
        default_vat_id: default_vat_id || null,
        default_currency_id: default_currency_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating supplier:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a beszállító frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Beszállító nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ supplier: data })
  } catch (error) {
    console.error('Error in suppliers PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/suppliers/[id]
 * Soft delete a supplier
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Soft delete supplier (cascade will handle related records)
    const { error } = await supabase
      .from('suppliers')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error deleting supplier:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a beszállító törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in suppliers DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
