import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
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

    const { data, error } = await supabase
      .from('employees')
      .select('id, name, employee_code, rfid_card_id, pin_code, active, lunch_break_start, lunch_break_end, works_on_saturday, created_at, updated_at')
      .eq('active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching employees:', error)
      return NextResponse.json({ error: 'Hiba történt a dolgozók lekérdezése során' }, { status: 500 })
    }

    return NextResponse.json(data || [])

  } catch (error) {
    console.error('Error in employees GET API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

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
    const { name, employee_code, rfid_card_id, pin_code, active, lunch_break_start, lunch_break_end } = body

    // Validation
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Név megadása kötelező' }, { status: 400 })
    }

    if (!employee_code || employee_code.trim() === '') {
      return NextResponse.json({ error: 'Dolgozói kód megadása kötelező' }, { status: 400 })
    }

    // Validate PIN code format if provided
    if (pin_code && pin_code.trim() !== '') {
      const pinRegex = /^[0-9]{4}$/
      if (!pinRegex.test(pin_code.trim())) {
        return NextResponse.json({ error: 'A PIN kód pontosan 4 számjegyből kell álljon' }, { status: 400 })
      }
    }

    const { data, error } = await supabase
      .from('employees')
      .insert({
        name: name.trim(),
        employee_code: employee_code.trim(),
        rfid_card_id: rfid_card_id?.trim() || null,
        pin_code: pin_code?.trim() || null,
        active: active !== undefined ? active : true,
        lunch_break_start: lunch_break_start || null,
        lunch_break_end: lunch_break_end || null,
        works_on_saturday: body.works_on_saturday !== undefined ? body.works_on_saturday : false,
      })
      .select('id, name, employee_code, rfid_card_id, pin_code, active, lunch_break_start, lunch_break_end, works_on_saturday, created_at, updated_at')
      .single()

    if (error) {
      console.error('Error creating employee:', error)
      
      // Handle unique constraint violations
      if (error.code === '23505') {
        if (error.message.includes('employee_code')) {
          return NextResponse.json({ error: 'Ez a dolgozói kód már létezik' }, { status: 409 })
        }
        if (error.message.includes('rfid_card_id')) {
          return NextResponse.json({ error: 'Ez az RFID kártya ID már használatban van' }, { status: 409 })
        }
      }
      
      return NextResponse.json({ error: 'Hiba történt a dolgozó létrehozása során' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })

  } catch (error) {
    console.error('Error in employee POST API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
