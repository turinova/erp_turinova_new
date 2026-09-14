import { createServiceClient } from '@/lib/supabase/service'

export type PartnerCompanyOption = {
  id: string
  name: string
  city: string | null
}

/**
 * Nyilvános lista: active tenant + partner_orders entitlement.
 * Service role — regisztráció előtt is hívható.
 */
export async function listPartnerAcceptingCompanies(): Promise<
  PartnerCompanyOption[]
> {
  const admin = createServiceClient()
  if (!admin) return []

  const { data: entitled, error: entError } = await admin
    .from('tenant_entitlements')
    .select('tenant_id')
    .eq('feature_key', 'partner_orders')

  if (entError) {
    console.error('listPartnerAcceptingCompanies entitlements', entError.message)
    return []
  }

  const tenantIds = [
    ...new Set((entitled ?? []).map((r) => r.tenant_id as string))
  ]
  if (tenantIds.length === 0) return []

  const { data: tenants, error: tenantError } = await admin
    .from('tenants')
    .select('id, name')
    .eq('status', 'active')
    .in('id', tenantIds)
    .order('name', { ascending: true })

  if (tenantError) {
    console.error('listPartnerAcceptingCompanies tenants', tenantError.message)
    return []
  }

  const { data: companies } = await admin
    .from('tenant_companies')
    .select('tenant_id, name, city')
    .in('tenant_id', tenantIds)

  const companyByTenant = new Map(
    (companies ?? []).map((c) => [
      c.tenant_id as string,
      { name: c.name as string, city: (c.city as string | null) ?? null }
    ])
  )

  return (tenants ?? []).map((t) => {
    const co = companyByTenant.get(t.id as string)
    return {
      id: t.id as string,
      name: co?.name || (t.name as string),
      city: co?.city ?? null
    }
  })
}

export async function partnerTenantIsAccepting(
  tenantId: string
): Promise<boolean> {
  const admin = createServiceClient()
  if (!admin) return false

  const { data, error } = await admin.rpc('tenant_accepts_partner_orders', {
    p_tenant_id: tenantId
  })

  if (error) {
    // Fallback without RPC grant for service role edge cases
    const { data: row } = await admin
      .from('tenants')
      .select('id, status')
      .eq('id', tenantId)
      .eq('status', 'active')
      .maybeSingle()
    if (!row) return false
    const { data: ent } = await admin
      .from('tenant_entitlements')
      .select('feature_key')
      .eq('tenant_id', tenantId)
      .eq('feature_key', 'partner_orders')
      .maybeSingle()
    return Boolean(ent)
  }

  return Boolean(data)
}
