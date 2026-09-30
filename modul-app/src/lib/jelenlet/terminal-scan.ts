import type { SupabaseClient } from '@supabase/supabase-js'

import { budapestTodayYmd } from '@/lib/jelenlet/hours'
import {
  hashJelenletToken,
  tenantHasJelenlet
} from '@/lib/jelenlet/entitlement'

const TZ = 'Europe/Budapest'

export type TerminalScanType = 'arrival' | 'departure'

export type TerminalScanResult =
  | {
      ok: true
      employeeId: string
      employeeName: string
      scanType: TerminalScanType
      workDate: string
      arrivalTime: string | null
      departureTime: string | null
    }
  | {
      ok: false
      status: number
      message: string
    }

function budapestTimeHm(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now)
}

function normalizePin(raw: string): string | null {
  const t = raw.trim()
  if (!/^\d{4}$/.test(t)) return null
  return t
}

function normalizeCard(raw: string): string | null {
  const t = raw.trim()
  if (!t || t.length > 64) return null
  return t
}

/**
 * Service-role: token → tenant device → employee PIN/RFID → napi upsert.
 */
export async function processJelenletTerminalScan(
  admin: SupabaseClient,
  input: {
    token: string
    cardId?: string
    pin?: string
  }
): Promise<TerminalScanResult> {
  const tokenHash = hashJelenletToken(input.token)
  const { data: device, error: devErr } = await admin
    .from('jelenlet_devices')
    .select('id, tenant_id, slug')
    .eq('sync_token_hash', tokenHash)
    .maybeSingle()

  if (devErr || !device?.id) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }

  const tenantId = device.tenant_id as string

  if (!(await tenantHasJelenlet(admin, tenantId))) {
    return {
      ok: false,
      status: 403,
      message: 'Jelenlét add-on nincs bekapcsolva.'
    }
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('status')
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenant || tenant.status !== 'active') {
    return { ok: false, status: 403, message: 'Tenant inactive' }
  }

  const pin = input.pin != null ? normalizePin(input.pin) : null
  const cardId =
    input.cardId != null ? normalizeCard(input.cardId) : null

  if ((pin && cardId) || (!pin && !cardId)) {
    return {
      ok: false,
      status: 400,
      message: 'Pontosan egy: cardId vagy pin (4 számjegy).'
    }
  }
  if (input.pin != null && !pin) {
    return { ok: false, status: 400, message: 'A PIN 4 számjegy.' }
  }

  let empQuery = admin
    .from('hr_employees')
    .select('id, name, lunch_start, lunch_end')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)

  if (pin) {
    empQuery = empQuery.eq('pin_code', pin)
  } else {
    empQuery = empQuery.ilike('rfid_card_id', cardId!)
  }

  const { data: employees, error: empErr } = await empQuery

  if (empErr) {
    console.error('jelenlet terminal employee', empErr.message)
    return { ok: false, status: 500, message: 'Adatbázis hiba' }
  }

  if (!employees?.length) {
    return {
      ok: false,
      status: 404,
      message: 'Ismeretlen kártya vagy PIN'
    }
  }
  if (employees.length > 1) {
    return {
      ok: false,
      status: 409,
      message: 'Több találat — ellenőrizd a PIN/RFID egyediséget.'
    }
  }

  const employee = employees[0]!
  const employeeId = employee.id as string
  const workDate = budapestTodayYmd()
  const nowHm = budapestTimeHm()

  const { data: absence } = await admin
    .from('hr_absences')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .lte('start_date', workDate)
    .gte('end_date', workDate)
    .limit(1)
    .maybeSingle()

  if (absence?.id) {
    return {
      ok: false,
      status: 409,
      message: 'Ma távollét van rögzítve — terminál nem ír.'
    }
  }

  const { data: day } = await admin
    .from('hr_attendance_days')
    .select(
      'id, arrival_time, departure_time, manually_edited, lunch_start, lunch_end'
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('work_date', workDate)
    .maybeSingle()

  if (day?.manually_edited) {
    return {
      ok: false,
      status: 409,
      message: 'A nap manuálisan szerkesztve — terminál nem írja felül.'
    }
  }

  const arrivalExisting = day?.arrival_time
    ? String(day.arrival_time).slice(0, 5)
    : null
  const departureExisting = day?.departure_time
    ? String(day.departure_time).slice(0, 5)
    : null

  let scanType: TerminalScanType
  let arrivalTime = arrivalExisting
  let departureTime = departureExisting

  if (!arrivalExisting) {
    scanType = 'arrival'
    arrivalTime = nowHm
  } else if (!departureExisting) {
    scanType = 'departure'
    departureTime = nowHm
    if (departureTime <= arrivalExisting) {
      return {
        ok: false,
        status: 409,
        message: 'A távozás legyen későbbi, mint az érkezés.'
      }
    }
  } else {
    return {
      ok: false,
      status: 409,
      message: 'A mai nap már teljes (érkezés + távozás).'
    }
  }

  const lunchStart =
    day?.lunch_start != null
      ? String(day.lunch_start).slice(0, 5)
      : employee.lunch_start
        ? String(employee.lunch_start).slice(0, 5)
        : null
  const lunchEnd =
    day?.lunch_end != null
      ? String(day.lunch_end).slice(0, 5)
      : employee.lunch_end
        ? String(employee.lunch_end).slice(0, 5)
        : null

  const { error: upErr } = await admin.from('hr_attendance_days').upsert(
    {
      tenant_id: tenantId,
      employee_id: employeeId,
      work_date: workDate,
      arrival_time: arrivalTime,
      departure_time: departureTime,
      lunch_start: lunchStart,
      lunch_end: lunchEnd,
      source: 'terminal',
      manually_edited: false,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'employee_id,work_date' }
  )

  if (upErr) {
    console.error('jelenlet terminal upsert', upErr.message)
    return { ok: false, status: 500, message: upErr.message }
  }

  await admin
    .from('jelenlet_devices')
    .update({
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', device.id)

  return {
    ok: true,
    employeeId,
    employeeName: employee.name as string,
    scanType,
    workDate,
    arrivalTime,
    departureTime
  }
}
