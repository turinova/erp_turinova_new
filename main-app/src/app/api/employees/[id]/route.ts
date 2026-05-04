import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ALLOWED_EMPLOYEE_TYPES = [
  'BOLTI_DOLGOZO',
  'LAPSZABASZ',
  'ELZARO',
  'ASZTALOS',
  'MUHELY',
  'IRODA'
] as const

type EmployeeType = (typeof ALLOWED_EMPLOYEE_TYPES)[number]

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
      .select(
        'id, name, employee_code, employee_type, rfid_card_id, pin_code, active, lunch_break_start, lunch_break_end, works_on_saturday, shift_start_time, shift_end_time, timezone, overtime_enabled, overtime_grace_minutes, overtime_rounding_minutes, overtime_rounding_mode, overtime_daily_cap_minutes, overtime_requires_complete_day, early_overtime_enabled, early_overtime_trigger_time, early_overtime_pay_until_time, early_overtime_mode, early_overtime_fixed_minutes, early_overtime_max_minutes, early_overtime_grace_minutes, early_overtime_rounding_minutes, early_overtime_rounding_mode, early_overtime_daily_cap_minutes, early_overtime_requires_complete_day, created_at, updated_at'
      )
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
    const {
      name,
      employee_code,
      employee_type,
      rfid_card_id,
      pin_code,
      active,
      lunch_break_start,
      lunch_break_end,
      works_on_saturday,
      shift_start_time,
      shift_end_time,
      timezone,
      overtime_enabled,
      overtime_grace_minutes,
      overtime_rounding_minutes,
      overtime_rounding_mode,
      overtime_daily_cap_minutes,
      overtime_requires_complete_day,
      early_overtime_enabled,
      early_overtime_trigger_time,
      early_overtime_pay_until_time,
      early_overtime_mode,
      early_overtime_fixed_minutes,
      early_overtime_max_minutes,
      early_overtime_grace_minutes,
      early_overtime_rounding_minutes,
      early_overtime_rounding_mode,
      early_overtime_daily_cap_minutes,
      early_overtime_requires_complete_day
    } = body

    // Validation
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Név megadása kötelező' }, { status: 400 })
    }

    if (!employee_code || employee_code.trim() === '') {
      return NextResponse.json({ error: 'Dolgozói kód megadása kötelező' }, { status: 400 })
    }

    const typeValue: EmployeeType = ALLOWED_EMPLOYEE_TYPES.includes(employee_type) ? employee_type : 'MUHELY'

    // Validate PIN code format if provided
    if (pin_code && pin_code.trim() !== '') {
      const pinRegex = /^[0-9]{4}$/
      if (!pinRegex.test(pin_code.trim())) {
        return NextResponse.json({ error: 'A PIN kód pontosan 4 számjegyből kell álljon' }, { status: 400 })
      }
    }

    const ss = shift_start_time?.trim() || null
    const se = shift_end_time?.trim() || null
    if ((ss && !se) || (!ss && se)) {
      return NextResponse.json(
        { error: 'A műszak kezdetét és végét együtt kell megadni, vagy mindkettőt üresen hagyni.' },
        { status: 400 }
      )
    }

    const earlyEnabled = early_overtime_enabled === true
    const earlyTrig = early_overtime_trigger_time?.trim() || null
    const earlyPayUntil = early_overtime_pay_until_time?.trim() || null
    const earlyMode = early_overtime_mode === 'fixed_grant' ? 'fixed_grant' : 'capped_actual'
    const earlyRm = ['floor', 'nearest', 'ceil'].includes(early_overtime_rounding_mode)
      ? early_overtime_rounding_mode
      : 'floor'

    if (earlyEnabled && !earlyTrig) {
      return NextResponse.json(
        { error: 'Az előtti túlórához kötelező a küszöb idő (HH:mm).' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('employees')
      .update({
        name: name.trim(),
        employee_code: employee_code.trim(),
        employee_type: typeValue,
        rfid_card_id: rfid_card_id?.trim() || null,
        pin_code: pin_code?.trim() || null,
        active: active !== undefined ? active : true,
        lunch_break_start: lunch_break_start || null,
        lunch_break_end: lunch_break_end || null,
        works_on_saturday: works_on_saturday !== undefined ? works_on_saturday : false,
        shift_start_time: ss,
        shift_end_time: se,
        timezone: typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'Europe/Budapest',
        overtime_enabled: overtime_enabled === true,
        overtime_grace_minutes: Number.isFinite(Number(overtime_grace_minutes)) ? Math.max(0, Math.min(180, Number(overtime_grace_minutes))) : 10,
        overtime_rounding_minutes: Number.isFinite(Number(overtime_rounding_minutes)) ? Math.max(1, Math.min(60, Number(overtime_rounding_minutes))) : 15,
        overtime_rounding_mode: ['floor', 'nearest', 'ceil'].includes(overtime_rounding_mode) ? overtime_rounding_mode : 'floor',
        overtime_daily_cap_minutes: Number.isFinite(Number(overtime_daily_cap_minutes)) ? Math.max(0, Math.min(1440, Number(overtime_daily_cap_minutes))) : 120,
        overtime_requires_complete_day: overtime_requires_complete_day !== false,
        early_overtime_enabled: earlyEnabled,
        early_overtime_trigger_time: earlyTrig,
        early_overtime_pay_until_time: earlyPayUntil,
        early_overtime_mode: earlyMode,
        early_overtime_fixed_minutes: Number.isFinite(Number(early_overtime_fixed_minutes))
          ? Math.max(0, Math.min(720, Number(early_overtime_fixed_minutes)))
          : 30,
        early_overtime_max_minutes: Number.isFinite(Number(early_overtime_max_minutes))
          ? Math.max(0, Math.min(720, Number(early_overtime_max_minutes)))
          : 30,
        early_overtime_grace_minutes: Number.isFinite(Number(early_overtime_grace_minutes))
          ? Math.max(0, Math.min(180, Number(early_overtime_grace_minutes)))
          : 0,
        early_overtime_rounding_minutes: Number.isFinite(Number(early_overtime_rounding_minutes))
          ? Math.max(1, Math.min(60, Number(early_overtime_rounding_minutes)))
          : 15,
        early_overtime_rounding_mode: earlyRm,
        early_overtime_daily_cap_minutes: Number.isFinite(Number(early_overtime_daily_cap_minutes))
          ? Math.max(0, Math.min(1440, Number(early_overtime_daily_cap_minutes)))
          : 120,
        early_overtime_requires_complete_day: early_overtime_requires_complete_day !== false,
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedParams.id)
      .select(
        'id, name, employee_code, employee_type, rfid_card_id, pin_code, active, lunch_break_start, lunch_break_end, works_on_saturday, shift_start_time, shift_end_time, timezone, overtime_enabled, overtime_grace_minutes, overtime_rounding_minutes, overtime_rounding_mode, overtime_daily_cap_minutes, overtime_requires_complete_day, early_overtime_enabled, early_overtime_trigger_time, early_overtime_pay_until_time, early_overtime_mode, early_overtime_fixed_minutes, early_overtime_max_minutes, early_overtime_grace_minutes, early_overtime_rounding_minutes, early_overtime_rounding_mode, early_overtime_daily_cap_minutes, early_overtime_requires_complete_day, created_at, updated_at'
      )
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
