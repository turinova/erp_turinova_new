import type { SupabaseClient } from '@supabase/supabase-js'

export type TenantRole = 'owner' | 'admin' | 'member' | 'viewer'

export type TenantMembership = {
  id: string
  tenantId: string
  role: TenantRole
  tenantName: string
  tenantSlug: string
  tenantStatus: string
}

type TenantEmbed = {
  id: string
  name: string
  slug: string
  status: string
}

function normalizeTenant(
  value: TenantEmbed | TenantEmbed[] | null | undefined
): TenantEmbed | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export const TENANT_ROLE_LABELS: Record<TenantRole, string> = {
  owner: 'Tulajdonos',
  admin: 'Adminisztrátor',
  member: 'Tag',
  viewer: 'Csak megtekintés'
}

export async function isPartnerOnlyUser(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('partner_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  return Boolean(data)
}

export async function listActiveMemberships(
  supabase: SupabaseClient,
  userId: string
): Promise<TenantMembership[]> {
  const { data, error } = await supabase
    .from('tenant_memberships')
    .select(
      'id, tenant_id, role, status, tenants ( id, name, slug, status )'
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('listActiveMemberships', error.message)
    return []
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string
    tenant_id: string
    role: TenantRole
    tenants: TenantEmbed | TenantEmbed[] | null
  }>

  return rows
    .map((row) => {
      const t = normalizeTenant(row.tenants)
      if (!t || t.status === 'churned') return null
      return {
        id: row.id,
        tenantId: t.id,
        role: row.role,
        tenantName: t.name,
        tenantSlug: t.slug,
        tenantStatus: t.status
      } satisfies TenantMembership
    })
    .filter((m): m is TenantMembership => m != null)
}

export function pickMembership(
  memberships: TenantMembership[],
  preferredTenantId?: string | null
): TenantMembership | null {
  if (memberships.length === 0) return null
  if (preferredTenantId) {
    const preferred = memberships.find((m) => m.tenantId === preferredTenantId)
    if (preferred) return preferred
  }
  return memberships[0] ?? null
}
