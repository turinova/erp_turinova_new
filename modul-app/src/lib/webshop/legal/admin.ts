import type { SupabaseClient } from '@supabase/supabase-js'

import { resolveStorefrontTenant } from '@/lib/storefront/resolve-tenant'
import { siteUrl } from '@/lib/storefront/url'
import { legalPath } from '@/lib/webshop/legal/constants'
import { derivedCounty, legalMissing, loadLegalContext } from '@/lib/webshop/legal/context'
import { countyFromPostalCode, countyFromRegistration } from '@/lib/webshop/legal/derive'
import type { LegalDocKind } from '@/lib/webshop/legal/types'

/** Admin nézet: jogi kontextus + hiányzó adatok + a bolt jogi oldalainak címe. */
export async function loadAdminLegal(supabase: SupabaseClient, tenantId: string) {
  const { data } = await supabase.from('tenants').select('slug, name').eq('id', tenantId).maybeSingle()
  const slug = (data?.slug as string | undefined) ?? ''
  const tenant = slug ? await resolveStorefrontTenant(supabase, slug) : null
  const origin = tenant?.base.origin ?? ''
  const loaded = await loadLegalContext(supabase, tenantId, {
    name: tenant?.name ?? String(data?.name ?? ''),
    url: origin
  })
  const autoCounty =
    countyFromRegistration(loaded.legal.registrationNumber ?? loaded.defaults.registrationNumber) ??
    countyFromPostalCode(loaded.legal.postalCode ?? loaded.defaults.postalCode)
  return {
    ...loaded,
    missing: legalMissing(loaded.ctx),
    county: derivedCounty(loaded.legal, loaded.ctx.seller.registrationNumber, loaded.ctx.seller.postalCode),
    autoCounty,
    docUrl: (kind: LegalDocKind) => (tenant ? siteUrl(tenant.base, legalPath(kind)) : null)
  }
}

export async function latestLegalVersions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Map<string, { version: number; createdAt: string }>> {
  const { data, error } = await supabase
    .from('webshop_legal_versions')
    .select('kind, version, created_at')
    .eq('tenant_id', tenantId)
    .order('version', { ascending: false })
    .limit(200)
  const out = new Map<string, { version: number; createdAt: string }>()
  if (error) return out
  for (const r of data ?? []) {
    const kind = String(r.kind)
    if (!out.has(kind)) out.set(kind, { version: Number(r.version), createdAt: String(r.created_at) })
  }
  return out
}

export async function openWithdrawalCount(supabase: SupabaseClient, tenantId: string): Promise<number> {
  const { count, error } = await supabase
    .from('webshop_withdrawals')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('handled_at', null)
  return error ? 0 : (count ?? 0)
}
