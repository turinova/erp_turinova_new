import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/suppliers/[id]/bank-accounts/[bankAccountId]
 * Update a bank account
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bankAccountId: string }> }
) {
  try {
    const { id, bankAccountId } = await params
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
        .neq('id', bankAccountId)
        .is('deleted_at', null)
    }

    const { data, error } = await supabase
      .from('supplier_bank_accounts')
      .update({
        bank_name: bank_name.trim(),
        account_number: account_number.trim(),
        swift_bic: swift_bic?.trim() || null,
        currency_id: currency_id || null,
        is_default: is_default || false,
        updated_at: new Date().toISOString()
      })
      .eq('id', bankAccountId)
      .select()
      .single()

    if (error) {
      console.error('Error updating bank account:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a bankszámla frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Bankszámla nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ bank_account: data })
  } catch (error) {
    console.error('Error in bank-accounts PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/suppliers/[id]/bank-accounts/[bankAccountId]
 * Soft delete a bank account
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bankAccountId: string }> }
) {
  try {
    const { bankAccountId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('supplier_bank_accounts')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', bankAccountId)

    if (error) {
      console.error('Error deleting bank account:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a bankszámla törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in bank-accounts DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
