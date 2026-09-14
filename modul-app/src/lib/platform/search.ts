import type { SupabaseClient } from '@supabase/supabase-js'

export type PlatformSearchHit =
  | {
      kind: 'tenant'
      id: string
      title: string
      subtitle: string
      href: string
    }
  | {
      kind: 'member'
      id: string
      title: string
      subtitle: string
      href: string
      tenantId: string
    }
  | {
      kind: 'partner'
      id: string
      title: string
      subtitle: string
      href: string
    }

export async function searchPlatform(
  admin: SupabaseClient,
  rawQuery: string
): Promise<PlatformSearchHit[]> {
  const q = rawQuery.trim()
  if (q.length < 2) return []

  const hits: PlatformSearchHit[] = []
  const pattern = `%${q}%`

  if (isUuid(q)) {
    const { data: byId } = await admin
      .from('tenants')
      .select('id, name, slug, status')
      .eq('id', q)
      .maybeSingle()
    if (byId) {
      hits.push({
        kind: 'tenant',
        id: byId.id,
        title: byId.name,
        subtitle: `${byId.slug} · ${byId.status}`,
        href: `/tenants/${byId.id}`
      })
    }
  }

  const { data: tenants } = await admin
    .from('tenants')
    .select('id, name, slug, status')
    .or(`name.ilike.${quoteFilter(pattern)},slug.ilike.${quoteFilter(pattern)}`)
    .order('name')
    .limit(10)

  for (const t of tenants ?? []) {
    if (hits.some((h) => h.kind === 'tenant' && h.id === t.id)) continue
    hits.push({
      kind: 'tenant',
      id: t.id,
      title: t.name,
      subtitle: `${t.slug} · ${t.status}`,
      href: `/tenants/${t.id}`
    })
  }

  const { listAllAuthUsersCached } = await import('@/lib/platform/auth-users')
  const users = await listAllAuthUsersCached(admin)
  const qLower = q.toLowerCase()
  const matchedUsers = users
    .filter(
      (u) =>
        u.email?.toLowerCase().includes(qLower) ||
        (isUuid(q) && u.id === q)
    )
    .slice(0, 15)

  if (matchedUsers.length > 0) {
    const userIds = matchedUsers.map((u) => u.id)
    const { data: memberships } = await admin
      .from('tenant_memberships')
      .select('user_id, tenant_id, role, tenants(id, name, slug)')
      .in('user_id', userIds)

    const { data: partners } = await admin
      .from('partner_profiles')
      .select('user_id, name, email')
      .in('user_id', userIds)

    const partnerByUser = new Map(
      (partners ?? []).map((p) => [p.user_id, p] as const)
    )

    for (const u of matchedUsers) {
      const mems = (memberships ?? []).filter((m) => m.user_id === u.id)
      for (const m of mems) {
        const tenant = Array.isArray(m.tenants) ? m.tenants[0] : m.tenants
        const t = tenant as { id: string; name: string; slug: string } | null
        if (!t) continue
        hits.push({
          kind: 'member',
          id: `${u.id}:${t.id}`,
          title: u.email ?? u.id,
          subtitle: `${t.name} · ${m.role}`,
          href: `/tenants/${t.id}`,
          tenantId: t.id
        })
      }
      const p = partnerByUser.get(u.id)
      if (p) {
        hits.push({
          kind: 'partner',
          id: u.id,
          title: p.name || u.email || u.id,
          subtitle: p.email || u.email || 'Partner',
          href: `/partnerek/${u.id}`
        })
      }
    }
  }

  const { data: partnerRows } = await admin
    .from('partner_profiles')
    .select('user_id, name, email')
    .or(
      `name.ilike.${quoteFilter(pattern)},email.ilike.${quoteFilter(pattern)}`
    )
    .limit(10)

  for (const p of partnerRows ?? []) {
    if (hits.some((h) => h.kind === 'partner' && h.id === p.user_id)) continue
    hits.push({
      kind: 'partner',
      id: p.user_id,
      title: p.name || p.email,
      subtitle: p.email,
      href: `/partnerek/${p.user_id}`
    })
  }

  return hits.slice(0, 40)
}

function quoteFilter(value: string): string {
  // PostgREST or() érték — idézőjel ha speciális
  return `"${value.replace(/"/g, '')}"`
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}
