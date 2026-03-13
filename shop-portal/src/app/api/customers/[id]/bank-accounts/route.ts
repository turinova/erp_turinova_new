import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/[id]/bank-accounts
 * Fetch all bank accounts for a customer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customer_entities')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Vevő nem található' },
        { status: 404 }
      )
    }

    // Fetch bank accounts
    const { data: bankAccounts, error } = await supabase
      .from('customer_bank_accounts')
      .select(`
        *,
        currencies:currency_id(id, code, name, symbol)
      `)
      .eq('customer_entity_id', id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching customer bank accounts:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a bankszámlák lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      bank_accounts: bankAccounts || []
    })
  } catch (error) {
    console.error('Error in customer bank accounts GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/[id]/bank-accounts
 * Add a new bank account to a customer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customer_entities')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Vevő nem található' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      bank_name,
      account_number,
      swift_bic,
      currency_id,
      is_default = false
    } = body

    // Validation
    if (!bank_name || !bank_name.trim()) {
      return NextResponse.json(
        { error: 'A bank neve kötelező' },
        { status: 400 }
      )
    }

    if (!account_number || !account_number.trim()) {
      return NextResponse.json(
        { error: 'A bankszámlaszám kötelező' },
        { status: 400 }
      )
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from('customer_bank_accounts')
        .update({ is_default: false })
        .eq('customer_entity_id', id)
        .is('deleted_at', null)
    }

    // Create bank account
    const { data, error } = await supabase
      .from('customer_bank_accounts')
      .insert({
        customer_entity_id: id,
        bank_name: bank_name.trim(),
        account_number: account_number.trim(),
        swift_bic: swift_bic?.trim() || null,
        currency_id: currency_id || null,
        is_default: is_default || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating customer bank account:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a bankszámla létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ bank_account: data }, { status: 201 })
  } catch (error) {
    console.error('Error in customer bank accounts POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
