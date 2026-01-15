import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET /api/holidays/[id] - Get holiday by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    const { data, error } = await supabase
      .from('holidays')
      .select('id, name, start_date, end_date, type, active, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Error fetching holiday:', error)
      return NextResponse.json({ error: 'Ünnep nem található' }, { status: 404 })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in holiday GET API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT /api/holidays/[id] - Update holiday
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, start_date, end_date, type, active } = body

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

    // Check for duplicate (excluding current holiday)
    const { data: existing } = await supabase
      .from('holidays')
      .select('id')
      .eq('name', name.trim())
      .eq('start_date', start_date)
      .eq('end_date', end_date)
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Ez az ünnep már létezik' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('holidays')
      .update({
        name: name.trim(),
        start_date,
        end_date,
        type,
        active: active !== undefined ? active : true
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, name, start_date, end_date, type, active, created_at, updated_at')
      .single()

    if (error) {
      console.error('Error updating holiday:', error)
      
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Ünnep nem található' }, { status: 404 })
      }
      
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ez az ünnep már létezik' }, { status: 409 })
      }
      
      return NextResponse.json({ error: 'Hiba történt az ünnep frissítése során' }, { status: 500 })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in holiday PUT API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/holidays/[id] - Soft delete holiday
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('holidays')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) {
      console.error('Error deleting holiday:', error)
      return NextResponse.json({ error: 'Hiba történt az ünnep törlése során' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error) {
    console.error('Error in holiday DELETE API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
