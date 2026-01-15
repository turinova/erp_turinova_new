import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET /api/employees/[id]/holidays - Get employee holidays
// Optional query params: year, month for filtering
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined

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
      .from('employee_holidays')
      .select('id, date, type, name, created_at, updated_at')
      .eq('employee_id', resolvedParams.id)
      .order('date', { ascending: true })

    if (year && month) {
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]
      query = query.gte('date', startDate).lte('date', endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching employee holidays:', error)
      return NextResponse.json({ error: 'Hiba történt a szabadságok lekérdezése során' }, { status: 500 })
    }

    return NextResponse.json(data || [])

  } catch (error) {
    console.error('Error in employee holidays GET API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/employees/[id]/holidays - Create employee holiday
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
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
    const { date, type, name } = body

    // Validation
    if (!date) {
      return NextResponse.json({ error: 'Dátum megadása kötelező' }, { status: 400 })
    }

    if (!type || !['Szabadság', 'Betegszabadság'].includes(type)) {
      return NextResponse.json({ error: 'Érvénytelen szabadság típus' }, { status: 400 })
    }

    // Check if holiday already exists for this employee and date
    const { data: existing } = await supabase
      .from('employee_holidays')
      .select('id')
      .eq('employee_id', resolvedParams.id)
      .eq('date', date)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Ez a nap már szabadságként van jelölve' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('employee_holidays')
      .insert({
        employee_id: resolvedParams.id,
        date,
        type,
        name: name?.trim() || null,
      })
      .select('id, date, type, name, created_at, updated_at')
      .single()

    if (error) {
      console.error('Error creating employee holiday:', error)
      
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ez a nap már szabadságként van jelölve' }, { status: 409 })
      }
      
      return NextResponse.json({ error: 'Hiba történt a szabadság létrehozása során' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })

  } catch (error) {
    console.error('Error in employee holidays POST API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
