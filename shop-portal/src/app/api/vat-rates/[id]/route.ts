import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/vat-rates/[id]
 * Update a VAT rate
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, kulcs } = body

    // Validation
    if (!name || kulcs === undefined || kulcs === null) {
      return NextResponse.json(
        { error: 'Név és kulcs megadása kötelező' },
        { status: 400 }
      )
    }

    if (kulcs < 0 || kulcs > 100) {
      return NextResponse.json(
        { error: 'Az ÁFA kulcs 0 és 100 közé kell essen' },
        { status: 400 }
      )
    }

    // Check if name already exists (excluding current record)
    const { data: existing } = await supabase
      .from('vat')
      .select('id')
      .eq('name', name.trim())
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Már létezik ÁFA kulcs ezzel a névvel' },
        { status: 400 }
      )
    }

    // Update VAT rate
    const { data, error } = await supabase
      .from('vat')
      .update({
        name: name.trim(),
        kulcs: parseFloat(kulcs),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating VAT rate:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba az ÁFA kulcs frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'ÁFA kulcs nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ vatRate: data })
  } catch (error) {
    console.error('Error in VAT rates PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/vat-rates/[id]
 * Soft delete a VAT rate
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Soft delete VAT rate
    const { error } = await supabase
      .from('vat')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error deleting VAT rate:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba az ÁFA kulcs törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in VAT rates DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
