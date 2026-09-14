import { createClient } from '@/lib/supabase/server'

export async function resolvePartnerCompanyLabel(
  tenantId: string | null
): Promise<string | null> {
  if (!tenantId) return null
  const supabase = await createClient()
  if (!supabase) return null

  const { data: company } = await supabase
    .from('tenant_companies')
    .select('name, city')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle()

  const name = company?.name || tenant?.name
  if (!name) return null
  return company?.city ? `${name} · ${company.city}` : name
}
