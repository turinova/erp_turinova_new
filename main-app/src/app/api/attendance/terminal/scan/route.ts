import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { createClient } from '@supabase/supabase-js'

const TZ = 'Europe/Budapest'

function formatDateInTz(isoOrDate: string | Date, timeZone: string): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate

  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

const ARRIVAL_TYPES = new Set(['arrival', 'arrival_pin'])

/**
 * POST /api/attendance/terminal/scan
 * Raspberry Pi terminal: record scan after RFID or PIN success.
 *
 * Headers: X-Terminal-Secret (must match ATTENDANCE_TERMINAL_SECRET on server)
 * Body: { locationId: string, cardId?: string, pin?: string }
 * Exactly one of cardId or pin is required.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-terminal-secret') || request.headers.get('X-Terminal-Secret')
    const expected = process.env.ATTENDANCE_TERMINAL_SECRET

    if (!expected || secret !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = await request.json()
    const locationId = typeof body.locationId === 'string' ? body.locationId.trim() : ''
    const cardId = typeof body.cardId === 'string' ? body.cardId.trim() : ''
    const pin = typeof body.pin === 'string' ? body.pin.trim() : ''

    if (!locationId) {
      return NextResponse.json({ error: 'locationId kötelező' }, { status: 400 })
    }

    if ((cardId && pin) || (!cardId && !pin)) {
      return NextResponse.json({ error: 'Pontosan egy: cardId vagy pin' }, { status: 400 })
    }

    if (pin && !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'A PIN 4 számjegy' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: location, error: locErr } = await supabase
      .from('locations')
      .select('id, active')
      .eq('id', locationId)
      .maybeSingle()

    if (locErr || !location?.active) {
      return NextResponse.json({ error: 'Érvénytelen vagy inaktív helyszín' }, { status: 400 })
    }

    let query = supabase.from('employees').select('id, name, rfid_card_id, pin_code').eq('active', true).is('deleted_at', null)

    if (cardId) {
      query = query.eq('rfid_card_id', cardId)
    } else {
      query = query.eq('pin_code', pin)
    }

    const { data: employees, error: empErr } = await query

    if (empErr) {
      console.error('[terminal/scan] employee query', empErr)
      
return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 })
    }

    if (!employees?.length) {
      return NextResponse.json({ error: 'Ismeretlen kártya vagy PIN' }, { status: 404 })
    }

    if (employees.length > 1) {
      return NextResponse.json({ error: 'Több találat — ellenőrizze az adatbázist' }, { status: 409 })
    }

    const employee = employees[0]
    const pinUsed = Boolean(pin)
    const now = new Date()
    const todayStr = formatDateInTz(now, TZ)

    const windowStart = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()

    const { data: recentLogs, error: logErr } = await supabase
      .from('attendance_logs')
      .select('id, scan_time, scan_type')
      .eq('employee_id', employee.id)
      .eq('location_id', locationId)
      .gte('scan_time', windowStart)
      .order('scan_time', { ascending: false })
      .limit(50)

    if (logErr) {
      console.error('[terminal/scan] logs query', logErr)
      
return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 })
    }

    const logsToday =
      recentLogs?.filter(row => formatDateInTz(row.scan_time, TZ) === todayStr) ?? []

    const lastToday = logsToday[0]

    let scanType: 'arrival' | 'departure' | 'arrival_pin' | 'departure_pin'

    if (!lastToday) {
      scanType = pinUsed ? 'arrival_pin' : 'arrival'
    } else if (ARRIVAL_TYPES.has(lastToday.scan_type)) {
      scanType = pinUsed ? 'departure_pin' : 'departure'
    } else {
      scanType = pinUsed ? 'arrival_pin' : 'arrival'
    }

    const scanTimeIso = now.toISOString()

    const { data: inserted, error: insErr } = await supabase
      .from('attendance_logs')
      .insert({
        employee_id: employee.id,
        location_id: locationId,
        scan_time: scanTimeIso,
        scan_type: scanType,
        card_id: cardId || null,
        pin_used: pinUsed,
        manually_edited: false,
        sync_status: 'synced'
      })
      .select('id')
      .single()

    if (insErr) {
      console.error('[terminal/scan] insert', insErr)
      
return NextResponse.json({ error: insErr.message || 'Mentés sikertelen' }, { status: 500 })
    }

    return NextResponse.json(
      {
        ok: true,
        logId: inserted.id,
        employeeId: employee.id,
        employeeName: employee.name,
        scanType,
        scanTime: scanTimeIso
      },
      { status: 201 }
    )
  } catch (e) {
    console.error('[terminal/scan]', e)
    
return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
