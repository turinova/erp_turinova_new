import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/[id]/bank-accounts/[accountId]
 * Fetch a single bank account
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  try {
    const { id, accountId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch bank account
    const { data: bankAccount, error } = await supabase
      .from('customer_bank_accounts')
      .select(`
        *,
        currencies:currency_id(id, code, name, symbol)
      `)
      .eq('id', accountId)
      .eq('customer_entity_id', id)
      .is('deleted_at', null)
      .single()

    if (error || !bankAccount) {
      return NextResponse.json(
        { error: 'Bankszámla nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ bank_account: bankAccount })
  } catch (error) {
    console.error('Error in customer bank account GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/customers/[id]/bank-accounts/[accountId]
 * Update a bank account
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  try {
    const { id, accountId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      bank_name,
      account_number,
      swift_bic,
      currency_id,
      is_default
    } = body

    // Validation
    if (bank_name !== undefined && !bank_name?.trim()) {
      return NextResponse.json(
        { error: 'A bank neve kötelező' },
        { status: 400 }
      )
    }

    if (account_number !== undefined && !account_number?.trim()) {
      return NextResponse.json(
        { error: 'A bankszámlaszám kötelező' },
        { status: 400 }
      )
    }

    // If setting as default, unset other defaults
    if (is_default === true) {
      await supabase
        .from('customer_bank_accounts')
        .update({ is_default: false })
        .eq('customer_entity_id', id)
        .neq('id', accountId)
        .is('deleted_at', null)
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (bank_name !== undefined) updateData.bank_name = bank_name.trim()
    if (account_number !== undefined) updateData.account_number = account_number.trim()
    if (swift_bic !== undefined) updateData.swift_bic = swift_bic?.trim() || null
    if (currency_id !== undefined) updateData.currency_id = currency_id || null
    if (is_default !== undefined) updateData.is_default = is_default

    // Update bank account
    const { data, error } = await supabase
      .from('customer_bank_accounts')
      .update(updateData)
      .eq('id', accountId)
      .eq('customer_entity_id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating customer bank account:', error)
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
    console.error('Error in customer bank account PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customers/[id]/bank-accounts/[accountId]
 * Soft delete a bank account
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  try {
    const { id, accountId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Soft delete bank account
    const { error } = await supabase
      .from('customer_bank_accounts')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', accountId)
      .eq('customer_entity_id', id)

    if (error) {
      console.error('Error deleting customer bank account:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a bankszámla törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in customer bank account DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
