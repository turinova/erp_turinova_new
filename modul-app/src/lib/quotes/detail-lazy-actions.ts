'use server'

import { getSessionUser } from '@/lib/auth/session'
import { listActivePaymentMethods } from '@/lib/payment-methods/queries'
import { listActiveProductionMachines } from '@/lib/production-machines/queries'
import { loadQuoteExportData } from '@/lib/quotes/export/load-panels'
import type { QuoteExportTarget } from '@/lib/quotes/export/types'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import type { ProductionMachineOption } from '@/lib/production-machines/queries'
import { createClient } from '@/lib/supabase/server'

export async function loadQuoteExportTargetsAction(
  quoteId: string
): Promise<
  { ok: true; targets: QuoteExportTarget[] } | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs bejelentkezve.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Adatbázis nem elérhető.' }

  try {
    const loaded = await loadQuoteExportData(supabase, user.tenantId, quoteId)
    return { ok: true, targets: loaded?.targets ?? [] }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'Export célok betöltése sikertelen.'
    }
  }
}

export async function loadPaymentMethodsAction(): Promise<
  | { ok: true; methods: PaymentMethodOption[] }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs bejelentkezve.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Adatbázis nem elérhető.' }

  try {
    const methods = await listActivePaymentMethods(supabase, user.tenantId)
    return { ok: true, methods }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Fizetési módok betöltése sikertelen.'
    }
  }
}

export async function loadProductionMachinesAction(): Promise<
  | { ok: true; machines: ProductionMachineOption[] }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs bejelentkezve.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Adatbázis nem elérhető.' }

  try {
    const machines = await listActiveProductionMachines(supabase, user.tenantId)
    return { ok: true, machines }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'Gépek betöltése sikertelen.'
    }
  }
}
