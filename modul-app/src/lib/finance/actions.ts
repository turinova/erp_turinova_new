'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/auth/session'
import { registerInvoicePayment } from '@/lib/finance/payments'
import {
  lockFinancePeriod,
  unlockFinancePeriod
} from '@/lib/finance/period-lock'
import { createClient } from '@/lib/supabase/server'
import type { InvoicePaymentMethod } from '@/lib/invoicing/types'

export type FinanceActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }

async function requireWriter() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false as const, message: 'Nincs aktív munkamenet.' }
  }
  if (user.role === 'viewer') {
    return { ok: false as const, message: 'Nincs írási jogod.' }
  }
  const supabase = await createClient()
  if (!supabase) {
    return { ok: false as const, message: 'Nincs adatbázis kapcsolat.' }
  }
  return { ok: true as const, user, supabase }
}

export async function registerInvoicePaymentAction(input: {
  invoiceId: string
  amount: number
  paidAt: string
  method: InvoicePaymentMethod | 'other'
  note?: string
  syncAgent?: boolean
}): Promise<FinanceActionResult> {
  const ctx = await requireWriter()
  if (!ctx.ok) return ctx
  const result = await registerInvoicePayment(
    ctx.supabase,
    ctx.user.tenantId!,
    ctx.user.id ?? null,
    input
  )
  if (!result.ok) return result
  revalidatePath('/szamlak')
  revalidatePath('/penzugy')
  revalidatePath('/penzugy/kintlevoseg')
  return { ok: true, message: 'Fizetés rögzítve.' }
}

export async function lockFinancePeriodAction(input: {
  periodYm: string
  note?: string
}): Promise<FinanceActionResult> {
  const ctx = await requireWriter()
  if (!ctx.ok) return ctx
  const result = await lockFinancePeriod(
    ctx.supabase,
    ctx.user.tenantId!,
    input.periodYm,
    ctx.user.id ?? null,
    input.note
  )
  if (!result.ok) return result
  revalidatePath('/penzugy/exportok')
  revalidatePath('/penzugy')
  return { ok: true, message: `${input.periodYm} lezárva.` }
}

export async function unlockFinancePeriodAction(input: {
  periodYm: string
}): Promise<FinanceActionResult> {
  const ctx = await requireWriter()
  if (!ctx.ok) return ctx
  if (ctx.user.role !== 'owner' && ctx.user.role !== 'admin') {
    return { ok: false, message: 'Csak owner/admin oldhatja fel.' }
  }
  const result = await unlockFinancePeriod(
    ctx.supabase,
    ctx.user.tenantId!,
    input.periodYm
  )
  if (!result.ok) return result
  revalidatePath('/penzugy/exportok')
  revalidatePath('/penzugy')
  return { ok: true, message: `${input.periodYm} feloldva.` }
}
