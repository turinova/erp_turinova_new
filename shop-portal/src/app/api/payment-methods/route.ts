import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/payment-methods
 * Fetch all active payment methods from the database
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active payment methods
    const { data: paymentMethods, error } = await supabase
      .from('payment_methods')
      .select('id, name, comment, active, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching payment methods:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a fizetési módok lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ payment_methods: paymentMethods || [] })
  } catch (error) {
    console.error('Error in payment-methods API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/payment-methods
 * Create a new payment method
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
    const { name, comment, active } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'A fizetési mód neve kötelező' },
        { status: 400 }
      )
    }

    // Check if name already exists
    const { data: existingByName } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('name', name.trim())
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik fizetési mód ezzel a névvel' },
        { status: 400 }
      )
    }

    // Create payment method
    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        name: name.trim(),
        comment: comment?.trim() || null,
        active: active !== undefined ? active : true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating payment method:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a fizetési mód létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ payment_method: data }, { status: 201 })
  } catch (error) {
    console.error('Error in payment-methods POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
