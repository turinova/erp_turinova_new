import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/customer-groups/[id]
 * Update an existing customer group
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getTenantSupabase()
    const { id } = await params

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, code, description, price_multiplier, is_default, is_active } = body

    // Validation
    if (!name || !code) {
      return NextResponse.json(
        { error: 'Név és kód megadása kötelező' },
        { status: 400 }
      )
    }

    // Validate code format
    const codeRegex = /^[A-Z0-9_]+$/
    if (!codeRegex.test(code.trim().toUpperCase())) {
      return NextResponse.json(
        { error: 'A kód csak nagybetűket, számokat és aláhúzást tartalmazhat' },
        { status: 400 }
      )
    }

    const normalizedCode = code.trim().toUpperCase()

    // Check if code already exists (excluding current record)
    const { data: existingByCode } = await supabase
      .from('customer_groups')
      .select('id')
      .eq('code', normalizedCode)
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingByCode) {
      return NextResponse.json(
        { error: 'Már létezik vevőcsoport ezzel a kóddal' },
        { status: 400 }
      )
    }

    // Check if name already exists (excluding current record)
    const { data: existingByName } = await supabase
      .from('customer_groups')
      .select('id')
      .eq('name', name.trim())
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik vevőcsoport ezzel a névvel' },
        { status: 400 }
      )
    }

    // If this is set as default, unset other defaults
    if (is_default) {
      await supabase
        .from('customer_groups')
        .update({ is_default: false })
        .neq('id', id)
        .is('deleted_at', null)
    }

    // Update customer group
    const { data, error } = await supabase
      .from('customer_groups')
      .update({
        name: name.trim(),
        code: normalizedCode,
        description: description?.trim() || null,
        price_multiplier: price_multiplier !== undefined && price_multiplier !== null && price_multiplier !== '' ? parseFloat(price_multiplier) : null,
        is_default: is_default || false,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      console.error('Error updating customer group:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a vevőcsoport frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Vevőcsoport nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ customerGroup: data })
  } catch (error) {
    console.error('Error in customer-groups PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customer-groups/[id]
 * Soft delete a customer group
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getTenantSupabase()
    const { id } = await params

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Soft delete
    const { data, error } = await supabase
      .from('customer_groups')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      console.error('Error deleting customer group:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a vevőcsoport törlésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Vevőcsoport nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in customer-groups DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
