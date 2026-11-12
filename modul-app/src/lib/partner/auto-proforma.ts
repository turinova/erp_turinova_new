import type { SupabaseClient } from '@supabase/supabase-js'

import { addDaysYmd, budapestTodayYmd } from '@/lib/home/date'
import { issueInvoiceFromQuote } from '@/lib/invoicing/issue-quote'
import { getInvoiceSettings, hasAgentKey } from '@/lib/invoicing/settings'
import {
  resolvePaymentMethodKind,
  type PaymentMethodKind
} from '@/lib/payment-methods/kinds'
import {
  AUTO_PROFORMA_PENDING_RESCUE_MINUTES,
  AUTO_PROFORMA_PROCESSING_STALE_MINUTES,
  autoProformaBlocker,
  normalizeAutoProformaDueDays,
  shouldAutoProforma,
  type AutoProformaStatus
} from '@/lib/partner/auto-proforma-rules'
import { getQuoteDetail } from '@/lib/quotes/queries'
import { createServiceClient } from '@/lib/supabase/service'

export type AutoProformaSettings = {
  enabled: boolean
  dueDays: number
}

export async function getAutoProformaSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AutoProformaSettings> {
  const { data, error } = await supabase
    .from('tenant_partner_settings')
    .select('auto_proforma_on_transfer, auto_proforma_due_days')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) {
    console.error('getAutoProformaSettings', error.message)
    return { enabled: false, dueDays: normalizeAutoProformaDueDays(null) }
  }
  return {
    enabled: Boolean(data?.auto_proforma_on_transfer),
    dueDays: normalizeAutoProformaDueDays(data?.auto_proforma_due_days)
  }
}

/** Partner beküldés: átutalás + bekapcsolt beállítás + Agent kulcs. */
export async function shouldQueueAutoProforma(
  tenantId: string,
  method: { kind?: string | null; name?: string | null }
): Promise<boolean> {
  const methodKind: PaymentMethodKind | null = resolvePaymentMethodKind(method)
  if (methodKind !== 'transfer') return false
  const admin = createServiceClient()
  if (!admin) {
    console.warn('[auto-proforma] queue=no reason=no_service_client', { tenantId })
    return false
  }
  try {
    const [settings, invoiceSettings] = await Promise.all([
      getAutoProformaSettings(admin, tenantId),
      getInvoiceSettings(admin, tenantId)
    ])
    const agent = hasAgentKey(invoiceSettings)
    const ok = shouldAutoProforma({
      enabled: settings.enabled,
      hasAgentKey: agent,
      methodKind
    })
    console.info('[auto-proforma] queue', {
      tenantId,
      enabled: settings.enabled,
      hasAgentKey: agent,
      methodKind,
      queue: ok
    })
    return ok
  } catch (err) {
    console.error('[auto-proforma] shouldQueue error', err)
    return false
  }
}

/** Beküldés után: pending jelölés (egyszer). true = a futtatás indulhat. */
export async function markAutoProformaPending(
  tenantId: string,
  quoteId: string
): Promise<boolean> {
  const admin = createServiceClient()
  if (!admin) return false
  const { data, error } = await admin
    .from('quotes')
    .update({
      auto_proforma_status: 'pending',
      auto_proforma_note: null,
      auto_proforma_at: new Date().toISOString()
    })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .is('auto_proforma_status', null)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[auto-proforma] pending fail', quoteId, error.message)
    return false
  }
  if (!data) {
    console.warn('[auto-proforma] pending no-row', { tenantId, quoteId })
    return false
  }
  console.info('[auto-proforma] pending ok', { quoteId })
  return true
}

async function setStatus(
  admin: SupabaseClient,
  tenantId: string,
  quoteId: string,
  status: AutoProformaStatus,
  note: string | null
) {
  const { error } = await admin
    .from('quotes')
    .update({
      auto_proforma_status: status,
      auto_proforma_note: note ? note.slice(0, 500) : null,
      auto_proforma_at: new Date().toISOString()
    })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
  if (error) console.error('autoProforma setStatus', status, error.message)
}

/** Atomikus foglalás — két párhuzamos futás közül csak egy kap sort. */
async function claim(
  admin: SupabaseClient,
  tenantId: string,
  quoteId: string,
  mode: 'auto' | 'retry'
): Promise<boolean> {
  let q = admin
    .from('quotes')
    .update({
      auto_proforma_status: 'processing',
      auto_proforma_at: new Date().toISOString()
    })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (mode === 'auto') {
    q = q.eq('auto_proforma_status', 'pending')
  } else {
    const staleIso = new Date(
      Date.now() - AUTO_PROFORMA_PROCESSING_STALE_MINUTES * 60_000
    ).toISOString()
    q = q.or(
      `auto_proforma_status.is.null,auto_proforma_status.in.(pending,failed,skipped),and(auto_proforma_status.eq.processing,auto_proforma_at.lt.${staleIso})`
    )
  }

  const { data, error } = await q.select('id').maybeSingle()
  if (error) {
    console.error('autoProforma claim', error.message)
    return false
  }
  return Boolean(data)
}

/**
 * Partner profil számlázási adatai → linked customer (+ quote billing snapshot).
 * Service role: ensure_partner_customer auth.uid()-ot vár, ezért közvetlen update.
 */
async function syncPartnerCustomerBillingFromProfile(
  admin: SupabaseClient,
  tenantId: string,
  quoteId: string
): Promise<void> {
  const { data: quote, error: qErr } = await admin
    .from('quotes')
    .select('id, customer_id, partner_profile_id, source')
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (qErr || !quote || quote.source !== 'portal' || !quote.partner_profile_id) {
    return
  }

  const { data: profile, error: pErr } = await admin
    .from('partner_profiles')
    .select(
      'email, name, mobile, billing_name, billing_country, billing_city, billing_postal_code, billing_street, billing_house_number, billing_tax_number, billing_company_reg_number'
    )
    .eq('user_id', quote.partner_profile_id)
    .maybeSingle()
  if (pErr || !profile) return

  let email = (profile.email ?? '').trim().toLowerCase() || null
  if (!email) {
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(
        quote.partner_profile_id as string
      )
      email = (authUser.user?.email ?? '').trim().toLowerCase() || null
    } catch {
      // auth admin opcionális
    }
  }
  const name = (profile.name ?? '').trim() || 'Online ügyfél'
  const billingName = (profile.billing_name ?? '').trim() || name

  if (quote.customer_id) {
    const customerPatch: Record<string, unknown> = {
      name,
      mobile: profile.mobile ?? null,
      billing_name: billingName,
      billing_country: profile.billing_country || 'Magyarország',
      billing_city: profile.billing_city ?? null,
      billing_postal_code: profile.billing_postal_code ?? null,
      billing_street: profile.billing_street ?? null,
      billing_house_number: profile.billing_house_number ?? null,
      billing_tax_number: profile.billing_tax_number ?? null,
      billing_company_reg_number: profile.billing_company_reg_number ?? null,
      updated_at: new Date().toISOString()
    }
    // Üres e-mail ne törölje a meglévő customer.email-t.
    if (email) customerPatch.email = email

    const { error: cErr } = await admin
      .from('customers')
      .update(customerPatch)
      .eq('id', quote.customer_id)
      .eq('tenant_id', tenantId)
    if (cErr) {
      console.error('syncPartnerCustomerBilling customers', cErr.message)
    }
  }

  // Snapshot felülírás: getQuoteDetail a snapshotot részesíti előnyben.
  const { error: snapErr } = await admin
    .from('quotes')
    .update({
      billing_name_snapshot: billingName,
      billing_country_snapshot: profile.billing_country || 'Magyarország',
      billing_city_snapshot: profile.billing_city ?? null,
      billing_postal_code_snapshot: profile.billing_postal_code ?? null,
      billing_street_snapshot: profile.billing_street ?? null,
      billing_house_number_snapshot: profile.billing_house_number ?? null,
      billing_tax_number_snapshot: profile.billing_tax_number ?? null,
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
  if (snapErr) {
    console.error('syncPartnerCustomerBilling snapshot', snapErr.message)
  }
}

async function findActiveProformaNumber(
  admin: SupabaseClient,
  tenantId: string,
  quoteId: string
): Promise<string | null> {
  const { data } = await admin
    .from('invoices')
    .select('id, invoice_type, provider_invoice_number, is_storno_of_invoice_id')
    .eq('tenant_id', tenantId)
    .eq('related_source_type', 'opti_order')
    .eq('related_source_id', quoteId)
    .is('deleted_at', null)
  const rows = data ?? []
  const stornoOf = new Set(
    rows
      .filter((r) => r.is_storno_of_invoice_id)
      .map((r) => r.is_storno_of_invoice_id as string)
  )
  const active = rows.find(
    (r) =>
      r.invoice_type === 'dijbekero' &&
      r.provider_invoice_number &&
      !stornoOf.has(r.id as string)
  )
  return (active?.provider_invoice_number as string | undefined) ?? null
}

export type RunAutoProformaResult = {
  status: AutoProformaStatus | 'busy'
  note: string | null
}

/**
 * Díjbekérő kiállítás service klienssel (a partnernek nincs számlázási joga).
 * mode=auto: beküldés után / cron; mode=retry: staff „Díjbekérő küldése”.
 */
export async function runAutoProforma(params: {
  tenantId: string
  quoteId: string
  mode: 'auto' | 'retry'
  userId?: string | null
}): Promise<RunAutoProformaResult> {
  const admin = createServiceClient()
  if (!admin) return { status: 'failed', note: 'Szerver beállítási hiba.' }
  const { tenantId, quoteId } = params

  console.info('[auto-proforma] run start', {
    quoteId,
    mode: params.mode
  })

  if (!(await claim(admin, tenantId, quoteId, params.mode))) {
    console.info('[auto-proforma] busy', { quoteId })
    return { status: 'busy', note: null }
  }

  const finish = async (status: AutoProformaStatus, note: string | null) => {
    await setStatus(admin, tenantId, quoteId, status, note)
    console.info('[auto-proforma] finish', { quoteId, status, note })
    return { status, note }
  }

  try {
    const existing = await findActiveProformaNumber(admin, tenantId, quoteId)
    if (existing) return finish('issued', existing)

    const invoiceSettings = await getInvoiceSettings(admin, tenantId)
    if (!hasAgentKey(invoiceSettings)) {
      return finish('skipped', 'Nincs összekapcsolt Számlázz.hu fiók.')
    }

    // Profil → ügyfélkarton sync (service role), mielőtt a blocker a customer sort nézi.
    await syncPartnerCustomerBillingFromProfile(admin, tenantId, quoteId)

    let detail = await getQuoteDetail(admin, tenantId, quoteId)
    if (!detail) return finish('failed', 'Az ajánlat nem található.')

    let blocker = autoProformaBlocker(detail)
    if (blocker) {
      // Még egyszer sync + reload (ritka race / elavult snapshot).
      await syncPartnerCustomerBillingFromProfile(admin, tenantId, quoteId)
      detail = (await getQuoteDetail(admin, tenantId, quoteId)) ?? detail
      blocker = autoProformaBlocker(detail)
    }
    if (blocker) return finish('skipped', blocker)

    const settings = await getAutoProformaSettings(admin, tenantId)
    const today = budapestTodayYmd()
    const result = await issueInvoiceFromQuote(
      admin,
      tenantId,
      params.userId ?? null,
      {
        quoteId,
        kind: 'proforma',
        paymentMethod: 'bank_transfer',
        dueDate: addDaysYmd(today, settings.dueDays),
        fulfillmentDate: today,
        sendEmail: true,
        detailLevel: 'summary'
      }
    )
    if (!result.ok) return finish('failed', result.message)
    return finish('issued', result.providerNumber)
  } catch (err) {
    console.error('runAutoProforma', quoteId, err)
    return finish(
      'failed',
      err instanceof Error ? err.message : 'Váratlan hiba a díjbekérő küldésekor.'
    )
  }
}

/**
 * Cron: elakadt pending (az after() nem futott le) → indítás;
 * régóta processing → failed, mert nem tudjuk, kiment-e.
 */
export async function rescueAutoProformaQueue(
  admin: SupabaseClient
): Promise<{ started: number; stale: number }> {
  const pendingIso = new Date(
    Date.now() - AUTO_PROFORMA_PENDING_RESCUE_MINUTES * 60_000
  ).toISOString()
  const staleIso = new Date(
    Date.now() - AUTO_PROFORMA_PROCESSING_STALE_MINUTES * 60_000
  ).toISOString()

  const { data: stale } = await admin
    .from('quotes')
    .update({
      auto_proforma_status: 'failed',
      auto_proforma_note:
        'Megszakadt a küldés. Nézd meg a Számlázz.hu fiókban, mielőtt újraküldöd.',
      auto_proforma_at: new Date().toISOString()
    })
    .eq('auto_proforma_status', 'processing')
    .lt('auto_proforma_at', staleIso)
    .is('deleted_at', null)
    .select('id')

  const { data: pending } = await admin
    .from('quotes')
    .select('id, tenant_id')
    .eq('auto_proforma_status', 'pending')
    .lt('auto_proforma_at', pendingIso)
    .is('deleted_at', null)
    .limit(20)

  let started = 0
  for (const row of pending ?? []) {
    const r = await runAutoProforma({
      tenantId: row.tenant_id as string,
      quoteId: row.id as string,
      mode: 'auto'
    })
    if (r.status !== 'busy') started += 1
  }
  return { started, stale: stale?.length ?? 0 }
}
