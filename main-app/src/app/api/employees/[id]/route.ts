import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
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

    const { data, error } = await supabase
      .from('employees')
      .select('id, name, employee_code, rfid_card_id, pin_code, active, lunch_break_start, lunch_break_end, works_on_saturday, created_at, updated_at')
      .eq('id', resolvedParams.id)
      .single()

    if (error) {
      console.error('Error fetching employee:', error)
      return NextResponse.json({ error: 'Dolgozó nem található' }, { status: 404 })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in employee GET API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(
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
    const { name, employee_code, rfid_card_id, pin_code, active, lunch_break_start, lunch_break_end, works_on_saturday } = body

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
      .update({
        name: name.trim(),
        employee_code: employee_code.trim(),
        rfid_card_id: rfid_card_id?.trim() || null,
        pin_code: pin_code?.trim() || null,
        active: active !== undefined ? active : true,
        lunch_break_start: lunch_break_start || null,
        lunch_break_end: lunch_break_end || null,
        works_on_saturday: works_on_saturday !== undefined ? works_on_saturday : false,
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedParams.id)
      .select('id, name, employee_code, rfid_card_id, pin_code, active, lunch_break_start, lunch_break_end, works_on_saturday, created_at, updated_at')
      .single()

    if (error) {
      console.error('Error updating employee:', error)
      
      // Handle unique constraint violations
      if (error.code === '23505') {
        if (error.message.includes('employee_code')) {
          return NextResponse.json({ error: 'Ez a dolgozói kód már létezik' }, { status: 409 })
        }
        if (error.message.includes('rfid_card_id')) {
          return NextResponse.json({ error: 'Ez az RFID kártya ID már használatban van' }, { status: 409 })
        }
      }
      
      return NextResponse.json({ error: 'Hiba történt a dolgozó frissítése során' }, { status: 500 })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in employee PUT API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/employees/[id] - Soft delete employee
export async function DELETE(
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

    // Soft delete by setting deleted_at timestamp
    const { error } = await supabase
      .from('employees')
      .update({
        deleted_at: new Date().toISOString(),
        active: false // Also set active to false
      })
      .eq('id', resolvedParams.id)
      .is('deleted_at', null) // Only update if not already deleted

    if (error) {
      console.error('Error deleting employee:', error)
      return NextResponse.json({ error: 'Hiba történt a dolgozó törlése során' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in employee DELETE API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
