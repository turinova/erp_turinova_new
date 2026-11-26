import { NextResponse, type NextRequest } from 'next/server'

import { normalizeTime } from '@/lib/jelenlet/hours'
import { requireJelenletDevice } from '@/lib/jelenlet/terminal-device'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Pi dolgozó cache — main-kompatibilis mezőnevek.
 * Opcionális `?card=` / `?pin=` (cache miss lekérés).
 */
export async function GET(request: NextRequest) {
  const ctx = await requireJelenletDevice(request)
  if (ctx instanceof NextResponse) return ctx

  const card = request.nextUrl.searchParams.get('card')?.trim()
  const pin = request.nextUrl.searchParams.get('pin')?.trim()

  let query = ctx.admin
    .from('hr_employees')
    .select('id, name, code, rfid_card_id, pin_code, active, lunch_start, lunch_end, works_on_saturday')
    .eq('tenant_id', ctx.tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('name')
    .limit(500)

  if (card) query = query.ilike('rfid_card_id', card.replace(/[%_\\]/g, ''))
  if (pin) query = query.eq('pin_code', pin)

  const { data, error } = await query
  if (error) {
    console.error('jelenlet terminal employees', error.message)
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 })
  }

  const employees = (data ?? []).map(e => ({
    id: e.id as string,
    name: e.name as string,
    employee_code: (e.code as string) || null,
    rfid_card_id: (e.rfid_card_id as string | null) || null,
    pin_code: (e.pin_code as string | null) || null,
    active: true,
    lunch_break_start: normalizeTime(e.lunch_start as string | null),
    lunch_break_end: normalizeTime(e.lunch_end as string | null),
    works_on_saturday: Boolean(e.works_on_saturday),
    deleted_at: null
  }))

  return NextResponse.json({ employees })
}
