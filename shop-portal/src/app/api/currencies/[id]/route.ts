import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/currencies/[id]
 * Update a currency
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
    const { name, code, symbol, rate, is_base } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'A pénznem neve kötelező' },
        { status: 400 }
      )
    }

    if (!code || !code.trim() || code.trim().length !== 3) {
      return NextResponse.json(
        { error: 'A pénznem kódja kötelező és pontosan 3 karakter kell legyen' },
        { status: 400 }
      )
    }

    const rateNum = parseFloat(rate)
    if (isNaN(rateNum) || rateNum < 0) {
      return NextResponse.json(
        { error: 'Az árfolyam érvényes pozitív szám kell legyen' },
        { status: 400 }
      )
    }

    // If setting as base, unset other bases
    if (is_base) {
      await supabase
        .from('currencies')
        .update({ is_base: false })
        .neq('id', id)
        .is('deleted_at', null)
    }

    // Check if name or code already exists (excluding current record)
    const { data: existing } = await supabase
      .from('currencies')
      .select('id, name, code')
      .or(`name.eq.${name.trim()},code.eq.${code.trim().toUpperCase()}`)
      .neq('id', id)
      .is('deleted_at', null)

    if (existing && existing.length > 0) {
      const existingName = existing.find(e => e.name.toLowerCase() === name.trim().toLowerCase())
      const existingCode = existing.find(e => e.code.toUpperCase() === code.trim().toUpperCase())
      
      if (existingName) {
        return NextResponse.json(
          { error: 'Már létezik pénznem ezzel a névvel' },
          { status: 400 }
        )
      }
      if (existingCode) {
        return NextResponse.json(
          { error: 'Már létezik pénznem ezzel a kóddal' },
          { status: 400 }
        )
      }
    }

    // Update currency
    const { data, error } = await supabase
      .from('currencies')
      .update({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        symbol: symbol?.trim() || null,
        rate: rateNum,
        is_base: is_base || false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating currency:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a pénznem frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Pénznem nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ currency: data })
  } catch (error) {
    console.error('Error in currencies PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/currencies/[id]
 * Soft delete a currency
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

    // Soft delete currency
    const { error } = await supabase
      .from('currencies')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error deleting currency:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a pénznem törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in currencies DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
