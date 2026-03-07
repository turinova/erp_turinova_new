import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customer-groups
 * Fetch all active customer groups from the database
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active customer groups
    const { data: customerGroups, error } = await supabase
      .from('customer_groups')
      .select('id, name, code, description, shoprenter_customer_group_id, price_multiplier, is_default, is_active, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching customer groups:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a vevőcsoportok lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ customerGroups: customerGroups || [] })
  } catch (error) {
    console.error('Error in customer-groups API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customer-groups
 * Create a new customer group
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
    const { name, code, description, price_multiplier, is_default, is_active } = body

    // Validation
    if (!name || !code) {
      return NextResponse.json(
        { error: 'Név és kód megadása kötelező' },
        { status: 400 }
      )
    }

    // Validate code format (uppercase, alphanumeric, underscore)
    const codeRegex = /^[A-Z0-9_]+$/
    if (!codeRegex.test(code.trim().toUpperCase())) {
      return NextResponse.json(
        { error: 'A kód csak nagybetűket, számokat és aláhúzást tartalmazhat' },
        { status: 400 }
      )
    }

    const normalizedCode = code.trim().toUpperCase()

    // Check if code already exists
    const { data: existingByCode } = await supabase
      .from('customer_groups')
      .select('id')
      .eq('code', normalizedCode)
      .is('deleted_at', null)
      .single()

    if (existingByCode) {
      return NextResponse.json(
        { error: 'Már létezik vevőcsoport ezzel a kóddal' },
        { status: 400 }
      )
    }

    // Check if name already exists
    const { data: existingByName } = await supabase
      .from('customer_groups')
      .select('id')
      .eq('name', name.trim())
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
        .is('deleted_at', null)
    }

    // Create customer group
    const { data, error } = await supabase
      .from('customer_groups')
      .insert({
        name: name.trim(),
        code: normalizedCode,
        description: description?.trim() || null,
        price_multiplier: price_multiplier !== undefined && price_multiplier !== null && price_multiplier !== '' ? parseFloat(price_multiplier) : null,
        is_default: is_default || false,
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating customer group:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a vevőcsoport létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ customerGroup: data }, { status: 201 })
  } catch (error) {
    console.error('Error in customer-groups POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
