import type { SupabaseClient } from '@supabase/supabase-js'

import { getOrCreateInvoiceSettings, hasAgentKey } from '@/lib/invoicing/settings'
import { postSzamlazzSimple } from '@/lib/invoicing/szamlazz-agent'
import { buildKifizXml } from '@/lib/invoicing/szamlazz-xml'
import type { InvoicePaymentMethod } from '@/lib/invoicing/types'

const JOGCIM: Record<InvoicePaymentMethod | 'other', string> = {
  cash: 'készpénz',
  bank_transfer: 'átutalás',
  card: 'bankkártya',
  other: 'egyéb'
}

export type RegisterPaymentInput = {
  invoiceId: string
  amount: number
  paidAt: string
  method: InvoicePaymentMethod | 'other'
  note?: string
  /** false = ne hívd az Agentet (csak ERP) */
  syncAgent?: boolean
}

export async function registerInvoicePayment(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string | null,
  input: RegisterPaymentInput
): Promise<{ ok: true; paymentId: string } | { ok: false; message: string }> {
  const amount = Math.round(Number(input.amount) || 0)
  if (amount <= 0) {
    return { ok: false, message: 'Az összeg legyen pozitív.' }
  }

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .select(
      'id, invoice_type, provider_invoice_number, gross_total, paid_amount, payment_status, deleted_at'
    )
    .eq('tenant_id', tenantId)
    .eq('id', input.invoiceId)
    .maybeSingle()

  if (invErr || !inv || inv.deleted_at) {
    return { ok: false, message: 'A bizonylat nem található.' }
  }
  if (inv.invoice_type === 'sztorno') {
    return { ok: false, message: 'Sztornó bizonylatra nem rögzíthető fizetés.' }
  }
  if (inv.invoice_type === 'dijbekero') {
    return {
      ok: false,
      message:
        'Díjbekérőre a fizetést az értékesítésen / megrendelésen rögzítsd; a számla után könyveld a kiegyenlítést.'
    }
  }

  const gross = Number(inv.gross_total) || 0
  const already = Number(inv.paid_amount) || 0
  const remaining = Math.max(0, gross - already)
  if (amount > remaining + 1) {
    return {
      ok: false,
      message: `A fennmaradó összeg legfeljebb ${remaining} Ft.`
    }
  }

  let agentSynced = false
  let agentError: string | null = null
  const syncAgent = input.syncAgent !== false

  if (syncAgent && inv.provider_invoice_number) {
    const settings = await getOrCreateInvoiceSettings(supabase, tenantId)
    if (!hasAgentKey(settings)) {
      agentError = 'Nincs Agent kulcs — csak ERP-ben rögzítve.'
    } else {
      const xml = buildKifizXml({
        agentKey: settings.agent_key!.trim(),
        invoiceNumber: inv.provider_invoice_number,
        paidAt: input.paidAt,
        amount,
        jogcim: JOGCIM[input.method] ?? 'átutalás',
        additive: true,
        note: input.note
      })
      const posted = await postSzamlazzSimple({
        agentKey: settings.agent_key!.trim(),
        apiUrl: settings.api_url,
        xml,
        actionField: 'action-szamla_agent_kifiz'
      })
      if (!posted.ok) {
        agentError = posted.error
      } else {
        agentSynced = true
      }
    }
  }

  const { data: pay, error: payErr } = await supabase
    .from('invoice_payments')
    .insert({
      tenant_id: tenantId,
      invoice_id: input.invoiceId,
      paid_at: input.paidAt,
      amount,
      method: input.method,
      note: input.note?.trim() || null,
      agent_synced: agentSynced,
      agent_error: agentError,
      created_by: userId
    })
    .select('id')
    .single()

  if (payErr || !pay) {
    console.error('registerInvoicePayment', payErr?.message)
    return { ok: false, message: 'Nem sikerült menteni a fizetést.' }
  }

  const newPaid = already + amount
  const fullyPaid = gross > 0 && newPaid >= gross - 0.5
  await supabase
    .from('invoices')
    .update({
      paid_amount: newPaid,
      payment_status: fullyPaid ? 'fizetve' : 'pending',
      agent_last_error: agentError,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('id', input.invoiceId)

  return { ok: true, paymentId: pay.id as string }
}
