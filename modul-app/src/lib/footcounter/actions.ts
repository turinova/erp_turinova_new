'use server'

import { revalidatePath } from 'next/cache'

import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type FootcounterSettingsActionResult =
  | { ok: true }
  | { ok: false; message: string }

function parseHour(raw: unknown, label: string): number | { error: string } {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 23) {
    return { error: `${label}: 0–23 közötti egész óra kell.` }
  }
  return n
}

export async function saveFootcounterOpenHoursAction(input: {
  weekdayOpen: number
  weekdayClose: number
  saturdayOpen: boolean
  saturdayOpenHour: number
  saturdayCloseHour: number
}): Promise<FootcounterSettingsActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const open = parseHour(input.weekdayOpen, 'Hétköznap nyitás')
  if (typeof open === 'object') return { ok: false, message: open.error }
  const close = parseHour(input.weekdayClose, 'Hétköznap zárás')
  if (typeof close === 'object') return { ok: false, message: close.error }
  if (open > close) {
    return { ok: false, message: 'A nyitás nem lehet később, mint a zárás.' }
  }

  let saturday_open_hour: number | null = null
  let saturday_close_hour: number | null = null
  if (input.saturdayOpen) {
    const sOpen = parseHour(input.saturdayOpenHour, 'Szombat nyitás')
    if (typeof sOpen === 'object') return { ok: false, message: sOpen.error }
    const sClose = parseHour(input.saturdayCloseHour, 'Szombat zárás')
    if (typeof sClose === 'object') return { ok: false, message: sClose.error }
    if (sOpen > sClose) {
      return {
        ok: false,
        message: 'Szombat: a nyitás nem lehet később, mint a zárás.'
      }
    }
    saturday_open_hour = sOpen
    saturday_close_hour = sClose
  }

  const row = {
    tenant_id: ctx.user.tenantId!,
    weekday_open_hour: open,
    weekday_close_hour: close,
    saturday_open_hour,
    saturday_close_hour,
    updated_at: new Date().toISOString()
  }

  const { error } = await ctx.supabase
    .from('footcounter_settings')
    .upsert(row, { onConflict: 'tenant_id' })

  if (error) {
    console.error('saveFootcounterOpenHoursAction', error.message)
    return {
      ok: false,
      message:
        error.message.includes('footcounter_settings') ||
        error.code === '42P01'
          ? 'A beállítások tábla hiányzik. Futtasd a 20260558 migrációt.'
          : 'Nem sikerült menteni a nyitvatartást.'
    }
  }

  revalidatePath('/belepok')
  revalidatePath('/home')
  return { ok: true }
}
