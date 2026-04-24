import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

type MachineRow = {
  id: string
  name: string
  machine_type: string
}

type ReadingRow = {
  id: string
  machine_id: string
  reading_date: string
  reading_value: number
  lock_at: string
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
}

function isIsoDate(s: string) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)
}

function budapestDateKey(d: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

function budapestToday() {
  return budapestDateKey(new Date())
}

function budapestYesterday() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)
  const y = Number(parts.find(p => p.type === 'year')?.value ?? '1970')
  const m = Number(parts.find(p => p.type === 'month')?.value ?? '01')
  const day = Number(parts.find(p => p.type === 'day')?.value ?? '01')

  // Treat these parts as a calendar date in Budapest, then subtract 1 day in UTC.
  const utc = new Date(Date.UTC(y, m - 1, day))
  utc.setUTCDate(utc.getUTCDate() - 1)
  return utc.toISOString().slice(0, 10)
}

function computeLockAtIso(dateKey: string) {
  // dateKey: YYYY-MM-DD
  const y = Number(dateKey.slice(0, 4))
  const m = Number(dateKey.slice(5, 7))
  const d = Number(dateKey.slice(8, 10))
  const lockLocal = new Date(Date.UTC(y, m - 1, d))
  lockLocal.setUTCDate(lockLocal.getUTCDate() + 1)

  // Build a timestamp representing next day 10:00 in Europe/Budapest.
  // We can approximate by formatting a local-time string and letting Date parse UTC? Avoid.
  // Instead, use Intl to get the epoch of that local time by searching offset via Date objects.
  // For UI gating we only need "is locked now", so we compute using current time in Budapest.
  // We'll compute lock moment as: next-day at 10:00 Budapest, expressed as ISO via toISOString()
  // by constructing a Date from its components in Budapest using a locale trick.
  const lockKey = lockLocal.toISOString().slice(0, 10)
  const lockString = `${lockKey}T10:00:00`
  // Interpret lockString in Europe/Budapest by using a formatter roundtrip.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  // Start from the same instant as if the string were UTC, then adjust until formatted matches.
  let guess = new Date(`${lockString}Z`)
  for (let i = 0; i < 6; i++) {
    const parts = fmt.formatToParts(guess)
    const got =
      `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}` +
      `T${parts.find(p => p.type === 'hour')?.value}:${parts.find(p => p.type === 'minute')?.value}:${parts.find(p => p.type === 'second')?.value}`
    if (got === lockString) break
    // Adjust by the difference between desired local time and current formatted local time
    const gotDate = new Date(`${got}Z`)
    const wantDate = new Date(`${lockString}Z`)
    guess = new Date(guess.getTime() + (wantDate.getTime() - gotDate.getTime()))
  }
  return guess.toISOString()
}

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      }
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabase()

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dateRaw = request.nextUrl.searchParams.get('date')?.trim() || budapestToday()
    if (!isIsoDate(dateRaw)) return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 })

    const today = budapestToday()
    const yesterday = budapestYesterday()
    const allowedDates = new Set([today, yesterday])
    if (!allowedDates.has(dateRaw)) {
      return NextResponse.json(
        { error: 'Only today and yesterday are supported on this entry page', today, yesterday },
        { status: 400 }
      )
    }

    const dateLockAt = computeLockAtIso(dateRaw)
    const dateLocked = Date.now() >= new Date(dateLockAt).getTime()

    const { data: machines, error: mErr } = await supabase
      .from('workshop_machines')
      .select('id, name, machine_type')
      .eq('is_active', true)
      .order('machine_type', { ascending: true })
      .order('name', { ascending: true })

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

    const { data: readings, error: rErr } = await supabase
      .from('production_machine_daily_readings')
      .select('id, machine_id, reading_date, reading_value, lock_at, created_at, created_by, updated_at, updated_by')
      .eq('reading_date', dateRaw)

    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

    // Previous reading lookup (for delta preview): for each machine, find max reading_date < dateRaw.
    // With only 4 machines this is fine as N+1 queries; keeps SQL simple and reliable with RLS.
    const prevByMachine = new Map<string, { reading_date: string; reading_value: number } | null>()
    for (const machine of (machines ?? []) as MachineRow[]) {
      const { data: prev, error: pErr } = await supabase
        .from('production_machine_daily_readings')
        .select('reading_date, reading_value')
        .eq('machine_id', machine.id)
        .lt('reading_date', dateRaw)
        .order('reading_date', { ascending: false })
        .limit(1)

      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
      const row = (prev && prev[0]) ? { reading_date: prev[0].reading_date as string, reading_value: prev[0].reading_value as number } : null
      prevByMachine.set(machine.id, row)
    }

    const readingsByMachine = new Map<string, ReadingRow>()
    for (const r of (readings ?? []) as any[]) {
      readingsByMachine.set(r.machine_id, r as ReadingRow)
    }

    const nowIso = new Date().toISOString()
    const response = (machines ?? []).map((m: any) => {
      const reading = readingsByMachine.get(m.id) ?? null
      const prev = prevByMachine.get(m.id) ?? null
      const locked = dateLocked || (reading ? new Date(nowIso).getTime() >= new Date(reading.lock_at).getTime() : false)
      const delta =
        reading && prev && typeof prev.reading_value === 'number'
          ? Number(reading.reading_value) - Number(prev.reading_value)
          : null

      return {
        machine: m,
        reading,
        previous: prev,
        locked,
        delta
      }
    })

    return NextResponse.json({ date: dateRaw, today, yesterday, dateLocked, dateLockAt, rows: response })
  } catch (e) {
    console.error('production meters GET:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabase()

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const machineId = String(body?.machineId ?? '').trim()
    const dateRaw = String(body?.readingDate ?? '').trim()
    const valueRaw = body?.readingValue

    if (!machineId) return NextResponse.json({ error: 'machineId is required' }, { status: 400 })
    if (!isIsoDate(dateRaw)) return NextResponse.json({ error: 'Invalid readingDate (YYYY-MM-DD)' }, { status: 400 })

    const today = budapestToday()
    const yesterday = budapestYesterday()
    const allowedDates = new Set([today, yesterday])
    if (!allowedDates.has(dateRaw)) {
      return NextResponse.json(
        { error: 'Only today and yesterday are supported on this entry page', today, yesterday },
        { status: 400 }
      )
    }

    const readingValue = Number(valueRaw)
    if (!Number.isFinite(readingValue) || !Number.isInteger(readingValue) || readingValue < 0) {
      return NextResponse.json({ error: 'readingValue must be a non-negative integer' }, { status: 400 })
    }

    // Upsert by (machine_id, reading_date). Trigger enforces lock + monotonic rules.
    const { data, error } = await supabase
      .from('production_machine_daily_readings')
      .upsert(
        {
          machine_id: machineId,
          reading_date: dateRaw,
          reading_value: readingValue,
          created_by: userData.user.id,
          updated_by: userData.user.id
        },
        { onConflict: 'machine_id,reading_date' }
      )
      .select('id, machine_id, reading_date, reading_value, lock_at, created_at, created_by, updated_at, updated_by')
      .single()

    if (error) {
      // Pass through constraint/trigger errors in a user-friendly way
      const msg = error.message || 'Failed to save reading'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({ success: true, reading: data })
  } catch (e) {
    console.error('production meters PUT:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

