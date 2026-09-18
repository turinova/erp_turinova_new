import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  MembershipWithTenant,
  TenantRole,
  TenantStatus
} from '@/lib/supabase/database.types'

export type ResolvedTenant = {
  tenantId: string
  tenantName: string
  tenantSlug: string
  role: TenantRole
  membershipId: string
}

type TenantEmbed = {
  id: string
  name: string
  slug: string
  status: TenantStatus
}

function normalizeTenantEmbed(
  value: TenantEmbed | TenantEmbed[] | null | undefined
): TenantEmbed | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export async function listMembershipsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<MembershipWithTenant[]> {
  const { data, error } = await supabase
    .from('tenant_memberships')
    .select(
      'id, tenant_id, user_id, role, status, disabled_at, created_at, tenants ( id, name, slug, status )'
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('listMembershipsForUser', error.message)
    return []
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string
    tenant_id: string
    user_id: string
    role: TenantRole
    status: 'active' | 'disabled'
    disabled_at: string | null
    created_at: string
    tenants: TenantEmbed | TenantEmbed[] | null
  }>

  return rows.map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    role: row.role,
    status: row.status ?? 'active',
    disabled_at: row.disabled_at ?? null,
    created_at: row.created_at,
    tenants: normalizeTenantEmbed(row.tenants)
  }))
}

export function resolveCurrentTenant(
  memberships: MembershipWithTenant[],
  preferredTenantId?: string | null
): ResolvedTenant | null {
  if (memberships.length === 0) return null

  const preferred = preferredTenantId
    ? memberships.find((m) => m.tenant_id === preferredTenantId)
    : null

  const chosen = preferred ?? memberships[0]
  if (!chosen?.tenants) return null

  return {
    tenantId: chosen.tenants.id,
    tenantName: chosen.tenants.name,
    tenantSlug: chosen.tenants.slug,
    role: chosen.role,
    membershipId: chosen.id
  }
}

export const TENANT_ROLE_LABELS: Record<TenantRole, string> = {
  owner: 'Tulajdonos',
  admin: 'Adminisztrátor',
  member: 'Tag',
  viewer: 'Csak megtekintés'
}
