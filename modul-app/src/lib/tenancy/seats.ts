import type { SupabaseClient } from '@supabase/supabase-js'

export type TenantSeatInfo = {
  maxSeats: number | null
  usedSeats: number
  atLimit: boolean
}

export async function getTenantSeatInfo(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantSeatInfo> {
  const [{ data: tenant }, { count }] = await Promise.all([
    supabase.from('tenants').select('max_seats').eq('id', tenantId).maybeSingle(),
    supabase
      .from('tenant_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
  ])

  const maxSeats =
    tenant?.max_seats === null || tenant?.max_seats === undefined
      ? null
      : Number(tenant.max_seats)
  const usedSeats = count ?? 0
  const atLimit = maxSeats !== null && usedSeats >= maxSeats

  return { maxSeats, usedSeats, atLimit }
}
