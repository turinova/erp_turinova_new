import { createServiceClient } from '@/lib/supabase/service'

/**
 * Partner draft Q-szám — service role (RLS bypass), mert a partner
 * nem látja a tenant összes quote-ját a max()-hoz, és a
 * `generate_quote_number` staff `can_write_tenant` checkje migráció
 * nélkül elutasítja.
 *
 * Előfeltétel: hívó már ellenőrizte a partner sessiont + selected tenantet.
 */
export async function allocatePartnerQuoteNumber(
  tenantId: string
): Promise<{ ok: true; quoteNumber: string } | { ok: false; message: string }> {
  const admin = createServiceClient()
  if (!admin) {
    return {
      ok: false,
      message:
        'Hiányzik a SUPABASE_SERVICE_ROLE_KEY — ajánlatszám generáláshoz kell.'
    }
  }

  const year = new Date().getFullYear()
  const prefix = `Q-${year}-`

  const { data, error } = await admin
    .from('quotes')
    .select('quote_number')
    .eq('tenant_id', tenantId)
    .like('quote_number', `${prefix}%`)
    .is('deleted_at', null)

  if (error) {
    console.error('allocatePartnerQuoteNumber', error.message)
    return { ok: false, message: 'Nem sikerült ajánlatszámot generálni.' }
  }

  let max = 0
  for (const row of data ?? []) {
    const raw = row.quote_number
    if (typeof raw !== 'string' || !raw.startsWith(prefix)) continue
    const n = Number.parseInt(raw.slice(prefix.length), 10)
    if (Number.isFinite(n) && n > max) max = n
  }

  const next = max + 1
  const quoteNumber = `${prefix}${String(next).padStart(3, '0')}`
  return { ok: true, quoteNumber }
}
