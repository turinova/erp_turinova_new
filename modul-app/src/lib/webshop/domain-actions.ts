'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { normalizeDomainInput } from '@/lib/storefront/domains/normalize'
import { DNS_PROVIDERS } from '@/lib/storefront/domains/providers'
import {
  announceDomainChange,
  checkAndStoreDomain,
  DOMAIN_SELECT,
  rowToView,
  type DomainRow
} from '@/lib/storefront/domains/service'
import type { DomainView } from '@/lib/storefront/domains/types'
import { addVercelDomain, removeVercelDomain } from '@/lib/storefront/domains/vercel'
import { createServiceClient } from '@/lib/supabase/service'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'

const PAGE = '/webshop/csatornak'
const RECHECK_MIN_MS = 5000

export type DomainActionResult =
  | { ok: true; domain: DomainView | null }
  | { ok: false; message: string }

async function requireWebshopWriter() {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false as const, message: ctx.message }
  const tenantId = ctx.user.tenantId!
  if (!(await tenantHasWebshop(ctx.supabase, tenantId))) {
    return { ok: false as const, message: 'Az Online bolt nincs bekapcsolva.' }
  }
  return { ok: true as const, ctx, tenantId }
}

async function loadRow(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<DomainRow | null> {
  const { data } = await supabase
    .from('tenant_domains')
    .select(DOMAIN_SELECT)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()
  return (data as DomainRow | null) ?? null
}

const vercelMessage: Record<string, string> = {
  domain_already_in_use:
    'Ezt a domaint már egy másik weboldal használja a tárhelyszolgáltatónknál. Ha a tiéd, írj nekünk, és segítünk átkötni.',
  forbidden: 'A tárhely-kapcsolat nem engedélyezte a domain felvételét. Írj nekünk, és megnézzük.',
  invalid_domain: 'Ezt a domaint nem lehet bekötni. Nézd meg, nincs-e elírás benne.'
}

export async function startCustomDomain(input: { domain: string }): Promise<DomainActionResult> {
  const gate = await requireWebshopWriter()
  if (!gate.ok) return gate
  const { ctx, tenantId } = gate

  const parsed = normalizeDomainInput(String(input.domain ?? ''))
  if (!parsed.ok) return { ok: false, message: parsed.message }
  const { hostname, isApex } = parsed
  const alias = isApex ? `www.${hostname}` : null

  const { data: existing } = await ctx.supabase
    .from('tenant_domains')
    .select('id, hostname')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(1)
  if (existing && existing.length > 0) {
    const current = existing[0] as { hostname: string }
    if (current.hostname === hostname) {
      const row = await loadRow(ctx.supabase, tenantId, (existing[0] as { id: string }).id)
      return { ok: true, domain: row ? rowToView(row) : null }
    }
    return {
      ok: false,
      message: `Már be van kötve egy domain (${current.hostname}). Előbb vedd le, utána köthetsz be másikat.`
    }
  }

  const admin = createServiceClient()
  if (admin) {
    const { data: taken } = await admin
      .from('tenant_domains')
      .select('id')
      .or(`hostname.eq.${hostname},alias_hostname.eq.${hostname}`)
      .is('deleted_at', null)
      .limit(1)
    if (taken && taken.length > 0) {
      return { ok: false, message: 'Ezt a domaint már egy másik bolt használja. Ha a tiéd, írj nekünk.' }
    }
  }

  const added = await addVercelDomain(hostname)
  if (!added.ok) {
    return { ok: false, message: vercelMessage[added.code] ?? `Nem sikerült felvenni a domaint (${added.message}).` }
  }
  if (alias) {
    const aliasAdded = await addVercelDomain(alias, hostname)
    if (!aliasAdded.ok) console.error('startCustomDomain alias', aliasAdded.code, aliasAdded.message)
  }

  const { data: inserted, error } = await ctx.supabase
    .from('tenant_domains')
    .insert({
      tenant_id: tenantId,
      hostname,
      alias_hostname: alias,
      status: 'pending',
      created_by: ctx.user.id
    })
    .select(DOMAIN_SELECT)
    .single()
  if (error || !inserted) {
    console.error('startCustomDomain insert', error?.message)
    return {
      ok: false,
      message:
        error?.code === '23505'
          ? 'Ezt a domaint már egy másik bolt használja. Ha a tiéd, írj nekünk.'
          : 'Nem sikerült elmenteni. Próbáld újra.'
    }
  }

  const checked = await checkAndStoreDomain(ctx.supabase, inserted as DomainRow)
  revalidatePath(PAGE)
  return { ok: true, domain: rowToView(checked) }
}

export async function checkCustomDomain(id: string): Promise<DomainActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: 'Érvénytelen domain.' }
  const gate = await requireWebshopWriter()
  if (!gate.ok) return gate
  const row = await loadRow(gate.ctx.supabase, gate.tenantId, id)
  if (!row) return { ok: false, message: 'A domain nem található.' }

  const last = row.last_checked_at ? Date.parse(row.last_checked_at) : 0
  if (Date.now() - last < RECHECK_MIN_MS) return { ok: true, domain: rowToView(row) }

  const checked = await checkAndStoreDomain(gate.ctx.supabase, row)
  if (checked.status !== row.status) revalidatePath(PAGE)
  return { ok: true, domain: rowToView(checked) }
}

const providerIds = DNS_PROVIDERS.map((p) => p.id) as [string, ...string[]]

export async function setDomainProvider(id: string, provider: string): Promise<DomainActionResult> {
  if (!z.string().uuid().safeParse(id).success || !z.enum(providerIds).safeParse(provider).success) {
    return { ok: false, message: 'Érvénytelen választás.' }
  }
  const gate = await requireWebshopWriter()
  if (!gate.ok) return gate
  const { data, error } = await gate.ctx.supabase
    .from('tenant_domains')
    .update({ dns_provider: provider })
    .eq('id', id)
    .eq('tenant_id', gate.tenantId)
    .select(DOMAIN_SELECT)
    .maybeSingle()
  if (error || !data) return { ok: false, message: 'Nem sikerült menteni.' }
  return { ok: true, domain: rowToView(data as DomainRow) }
}

export async function removeCustomDomain(id: string): Promise<DomainActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: 'Érvénytelen domain.' }
  const gate = await requireWebshopWriter()
  if (!gate.ok) return gate
  const row = await loadRow(gate.ctx.supabase, gate.tenantId, id)
  if (!row) return { ok: false, message: 'A domain nem található.' }

  const { error } = await gate.ctx.supabase
    .from('tenant_domains')
    .update({ deleted_at: new Date().toISOString(), is_primary: false })
    .eq('id', id)
    .eq('tenant_id', gate.tenantId)
  if (error) return { ok: false, message: 'Nem sikerült levenni. Próbáld újra.' }

  await Promise.all([
    removeVercelDomain(row.hostname),
    row.alias_hostname ? removeVercelDomain(row.alias_hostname) : Promise.resolve()
  ])
  if (row.is_primary) await announceDomainChange(gate.ctx.supabase, gate.tenantId)
  revalidatePath(PAGE)
  return { ok: true, domain: null }
}

/** id=null → az aldomain legyen a fő cím. */
export async function setPrimaryDomain(id: string | null): Promise<DomainActionResult> {
  if (id !== null && !z.string().uuid().safeParse(id).success) {
    return { ok: false, message: 'Érvénytelen domain.' }
  }
  const gate = await requireWebshopWriter()
  if (!gate.ok) return gate
  const { supabase } = gate.ctx

  if (id) {
    const row = await loadRow(supabase, gate.tenantId, id)
    if (!row || row.status !== 'active') {
      return { ok: false, message: 'Csak működő domain lehet a fő cím.' }
    }
  }
  const { error: clearError } = await supabase
    .from('tenant_domains')
    .update({ is_primary: false })
    .eq('tenant_id', gate.tenantId)
    .eq('is_primary', true)
  if (clearError) return { ok: false, message: 'Nem sikerült menteni.' }
  if (id) {
    const { error } = await supabase
      .from('tenant_domains')
      .update({ is_primary: true })
      .eq('id', id)
      .eq('tenant_id', gate.tenantId)
    if (error) return { ok: false, message: 'Nem sikerült menteni.' }
  }
  await announceDomainChange(supabase, gate.tenantId)
  revalidatePath(PAGE)
  return { ok: true, domain: null }
}
