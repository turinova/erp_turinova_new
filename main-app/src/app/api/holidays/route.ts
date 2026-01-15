import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET /api/holidays - List all holidays (excluding soft-deleted)
// Optional query params: start_date, end_date for filtering by date range
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    let query = supabase
      .from('holidays')
      .select('id, name, start_date, end_date, type, active, created_at, updated_at')
      .is('deleted_at', null)

    // Filter by date range if provided
    if (startDate && endDate) {
      query = query
        .lte('start_date', endDate)
        .gte('end_date', startDate)
    }

    query = query.order('start_date', { ascending: true })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching holidays:', error)
      return NextResponse.json({ error: 'Hiba történt az ünnepek lekérdezése során' }, { status: 500 })
    }

    return NextResponse.json(data || [])

  } catch (error) {
    console.error('Error in holidays GET API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/holidays - Create new holiday
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const body = await request.json()
    const { name, start_date, end_date, type, active } = body

    // Validation
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Az ünnep neve megadása kötelező' }, { status: 400 })
    }

    if (!start_date) {
      return NextResponse.json({ error: 'Kezdő dátum megadása kötelező' }, { status: 400 })
    }

    if (!end_date) {
      return NextResponse.json({ error: 'Vég dátum megadása kötelező' }, { status: 400 })
    }

    if (new Date(end_date) < new Date(start_date)) {
      return NextResponse.json({ error: 'A vég dátum nem lehet korábbi, mint a kezdő dátum' }, { status: 400 })
    }

    if (!type || !['national', 'company'].includes(type)) {
      return NextResponse.json({ error: 'Érvénytelen ünnep típus' }, { status: 400 })
    }

    // Check for duplicate (same name, start_date, end_date)
    const { data: existing } = await supabase
      .from('holidays')
      .select('id')
      .eq('name', name.trim())
      .eq('start_date', start_date)
      .eq('end_date', end_date)
      .is('deleted_at', null)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Ez az ünnep már létezik' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('holidays')
      .insert({
        name: name.trim(),
        start_date,
        end_date,
        type,
        active: active !== undefined ? active : true
      })
      .select('id, name, start_date, end_date, type, active, created_at, updated_at')
      .single()

    if (error) {
      console.error('Error creating holiday:', error)
      
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ez az ünnep már létezik' }, { status: 409 })
      }
      
      return NextResponse.json({ error: 'Hiba történt az ünnep létrehozása során' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })

  } catch (error) {
    console.error('Error in holidays POST API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
