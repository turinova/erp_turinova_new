import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/suppliers/[id]/bank-accounts
 * Fetch all bank accounts for a supplier
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: bankAccounts, error } = await supabase
      .from('supplier_bank_accounts')
      .select('*')
      .eq('supplier_id', id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching bank accounts:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a bankszámlák lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ bank_accounts: bankAccounts || [] })
  } catch (error) {
    console.error('Error in bank-accounts GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/suppliers/[id]/bank-accounts
 * Create a new bank account for a supplier
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { bank_name, account_number, swift_bic, currency_id, is_default } = body

    // Validation
    if (!bank_name || !account_number) {
      return NextResponse.json(
        { error: 'A bank neve és számlaszám kötelező' },
        { status: 400 }
      )
    }

    // If this is set as default, unset other defaults
    if (is_default) {
      await supabase
        .from('supplier_bank_accounts')
        .update({ is_default: false })
        .eq('supplier_id', id)
        .is('deleted_at', null)
    }

    const { data, error } = await supabase
      .from('supplier_bank_accounts')
      .insert({
        supplier_id: id,
        bank_name: bank_name.trim(),
        account_number: account_number.trim(),
        swift_bic: swift_bic?.trim() || null,
        currency_id: currency_id || null,
        is_default: is_default || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating bank account:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a bankszámla létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ bank_account: data }, { status: 201 })
  } catch (error) {
    console.error('Error in bank-accounts POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
