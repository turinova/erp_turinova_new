import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * GET /api/vat-rates
 * Fetch all active VAT rates from the database
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active VAT rates
    const { data: vatRates, error } = await supabase
      .from('vat')
      .select('id, name, kulcs, created_at, updated_at')
      .is('deleted_at', null)
      .order('kulcs', { ascending: true })

    if (error) {
      console.error('Error fetching VAT rates:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba az ÁFA kulcsok lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ vatRates: vatRates || [] })
  } catch (error) {
    console.error('Error in VAT rates API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/vat-rates
 * Create a new VAT rate
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

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

    // Check if name already exists
    const { data: existing } = await supabase
      .from('vat')
      .select('id')
      .eq('name', name.trim())
      .is('deleted_at', null)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Már létezik ÁFA kulcs ezzel a névvel' },
        { status: 400 }
      )
    }

    // Create VAT rate
    const { data, error } = await supabase
      .from('vat')
      .insert({
        name: name.trim(),
        kulcs: parseFloat(kulcs)
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating VAT rate:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba az ÁFA kulcs létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ vatRate: data }, { status: 201 })
  } catch (error) {
    console.error('Error in VAT rates POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
