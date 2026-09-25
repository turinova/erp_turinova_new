import type { SupabaseClient } from '@supabase/supabase-js'

import { runDomainCheck } from '@/lib/storefront/domains/check'
import type { DnsProviderId } from '@/lib/storefront/domains/providers'
import type { DomainCheckResult, DomainStatus, DomainView } from '@/lib/storefront/domains/types'
import { pingIndexNow } from '@/lib/storefront/indexnow'
import { resolveStorefrontTenant } from '@/lib/storefront/resolve-tenant'
import { revalidateStorefrontTenant } from '@/lib/storefront/revalidate'
import { STOREFRONT_HOME } from '@/lib/storefront/url'

export const DOMAIN_SELECT =
  'id, tenant_id, hostname, alias_hostname, status, is_primary, dns_provider, check_result, last_error, last_checked_at, activated_at'

export type DomainRow = {
  id: string
  tenant_id: string
  hostname: string
  alias_hostname: string | null
  status: DomainStatus
  is_primary: boolean
  dns_provider: string | null
  check_result: DomainCheckResult | Record<string, never> | null
  last_error: string | null
  last_checked_at: string | null
  activated_at: string | null
}

export function rowToView(row: DomainRow): DomainView {
  const result =
    row.check_result && 'checkedAt' in row.check_result ? (row.check_result as DomainCheckResult) : null
  return {
    id: row.id,
    hostname: row.hostname,
    aliasHostname: row.alias_hostname,
    status: row.status,
    isPrimary: row.is_primary,
    provider: (row.dns_provider as DnsProviderId | null) ?? result?.detectedProvider ?? null,
    result,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error
  }
}

export async function listTenantDomains(
  supabase: SupabaseClient,
  tenantId: string
): Promise<DomainView[]> {
  const { data, error } = await supabase
    .from('tenant_domains')
    .select(DOMAIN_SELECT)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(5)
  if (error) {
    if (error.code !== '42P01' && error.code !== 'PGRST205') console.error('listTenantDomains', error.message)
    return []
  }
  return ((data ?? []) as DomainRow[]).map(rowToView)
}

/** Ellenőrzés és mentés. Élesedéskor: elsődleges (ha nincs más), bolt cache + IndexNow. */
export async function checkAndStoreDomain(
  supabase: SupabaseClient,
  row: DomainRow
): Promise<DomainRow> {
  const outcome = await runDomainCheck({
    hostname: row.hostname,
    aliasHostname: row.alias_hostname,
    provider: (row.dns_provider as DnsProviderId | null) ?? null
  })

  const becameActive = outcome.status === 'active' && row.status !== 'active'
  let makePrimary = row.is_primary
  if (becameActive && !row.is_primary) {
    const { count } = await supabase
      .from('tenant_domains')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', row.tenant_id)
      .eq('is_primary', true)
      .is('deleted_at', null)
    makePrimary = (count ?? 0) === 0
  }

  const patch = {
    status: outcome.status,
    check_result: outcome.result,
    last_error: outcome.lastError,
    last_checked_at: outcome.result.checkedAt,
    dns_provider: row.dns_provider ?? outcome.detectedProvider,
    is_primary: makePrimary,
    ...(becameActive ? { activated_at: outcome.result.checkedAt } : {})
  }

  const { data, error } = await supabase
    .from('tenant_domains')
    .update(patch)
    .eq('id', row.id)
    .select(DOMAIN_SELECT)
    .maybeSingle()
  if (error || !data) {
    console.error('checkAndStoreDomain', error?.message)
    return { ...row, ...patch, check_result: outcome.result }
  }

  if (becameActive) await announceDomainChange(supabase, row.tenant_id)
  return data as DomainRow
}

export async function announceDomainChange(supabase: SupabaseClient, tenantId: string): Promise<void> {
  await revalidateStorefrontTenant(tenantId)
  const { data } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  const slug = data?.slug as string | undefined
  if (!slug) return
  const tenant = await resolveStorefrontTenant(supabase, slug)
  if (tenant) await pingIndexNow(tenant, [STOREFRONT_HOME])
}
