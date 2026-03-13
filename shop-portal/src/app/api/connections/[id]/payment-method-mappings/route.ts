import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'

/**
 * GET /api/connections/[id]/payment-method-mappings
 * Returns ERP payment methods, current mappings for this connection.
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

    const connection = await getConnectionById(id, supabase)
    if (!connection) {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    const { data: paymentMethods, error: pmError } = await supabase
      .from('payment_methods')
      .select('id, name, code, comment, active')
      .is('deleted_at', null)
      .eq('active', true)
      .order('name', { ascending: true })

    if (pmError) {
      console.error('Error fetching payment methods:', pmError)
      return NextResponse.json(
        { error: 'Hiba a fizetési módok lekérdezésekor' },
        { status: 500 }
      )
    }

    const { data: mappings, error: mappingError } = await supabase
      .from('connection_payment_method_mappings')
      .select('payment_method_id, platform_payment_code, platform_payment_name')
      .eq('connection_id', id)

    if (mappingError) {
      console.error('Error fetching payment mappings:', mappingError)
      return NextResponse.json(
        { error: 'Hiba a fizetési mód leképezések lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      paymentMethods: paymentMethods || [],
      mappings: mappings || []
    })
  } catch (error) {
    console.error('Error in payment-method-mappings GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/connections/[id]/payment-method-mappings
 * Create or update a payment method mapping (upsert by connection_id + platform_payment_code).
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

    const connection = await getConnectionById(id, supabase)
    if (!connection) {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    const body = await request.json()
    const { payment_method_id, platform_payment_code, platform_payment_name } = body

    if (!payment_method_id || !platform_payment_code || !String(platform_payment_code).trim()) {
      return NextResponse.json(
        { error: 'payment_method_id és platform_payment_code megadása kötelező' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('connection_payment_method_mappings')
      .upsert(
        {
          connection_id: id,
          payment_method_id,
          platform_payment_code: String(platform_payment_code).trim(),
          platform_payment_name: platform_payment_name?.trim() || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'connection_id,platform_payment_code' }
      )
      .select()
      .single()

    if (error) {
      console.error('Error saving payment mapping:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a leképezés mentésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ mapping: data })
  } catch (error) {
    console.error('Error in payment-method-mappings POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/connections/[id]/payment-method-mappings?payment_method_id=... or ?platform_payment_code=...
 */
export async function DELETE(
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

    const { searchParams } = new URL(request.url)
    const payment_method_id = searchParams.get('payment_method_id')
    const platform_payment_code = searchParams.get('platform_payment_code')

    if (!payment_method_id && !platform_payment_code) {
      return NextResponse.json(
        { error: 'payment_method_id vagy platform_payment_code megadása kötelező' },
        { status: 400 }
      )
    }

    let q = supabase
      .from('connection_payment_method_mappings')
      .delete()
      .eq('connection_id', id)

    if (payment_method_id) q = q.eq('payment_method_id', payment_method_id)
    if (platform_payment_code) q = q.eq('platform_payment_code', platform_payment_code)

    const { error } = await q

    if (error) {
      console.error('Error deleting payment mapping:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a leképezés törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in payment-method-mappings DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
