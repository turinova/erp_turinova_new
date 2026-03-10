import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/currencies
 * Fetch all active currencies from the database
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active currencies
    const { data: currencies, error } = await supabase
      .from('currencies')
      .select('id, name, code, symbol, rate, is_base, created_at, updated_at')
      .is('deleted_at', null)
      .order('is_base', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching currencies:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a pénznemek lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ currencies: currencies || [] })
  } catch (error) {
    console.error('Error in currencies API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/currencies
 * Create a new currency
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
        .is('deleted_at', null)
    }

    // Check if name or code already exists
    const { data: existing } = await supabase
      .from('currencies')
      .select('id, name, code')
      .or(`name.eq.${name.trim()},code.eq.${code.trim().toUpperCase()}`)
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

    // Create currency
    const { data, error } = await supabase
      .from('currencies')
      .insert({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        symbol: symbol?.trim() || null,
        rate: rateNum,
        is_base: is_base || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating currency:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a pénznem létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ currency: data }, { status: 201 })
  } catch (error) {
    console.error('Error in currencies POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
