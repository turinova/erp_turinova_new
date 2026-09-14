import type { SupabaseClient } from '@supabase/supabase-js'

import type { TenantRole } from '@/lib/supabase/database.types'
import {
  ALL_PAGE_KEYS,
  ALWAYS_ALLOWED_PAGE_KEYS,
  mergeAlwaysAllowed
} from '@/lib/permissions/pages'

export async function listAllowedPageKeys(
  supabase: SupabaseClient,
  membershipId: string,
  role: TenantRole | null
): Promise<string[]> {
  const { data, error } = await supabase
    .from('tenant_membership_page_access')
    .select('page_key, can_access')
    .eq('membership_id', membershipId)
    .eq('can_access', true)

  if (error) {
    console.error('listAllowedPageKeys', error.message)
    // Bootstrap: owner/admin full access if table missing / empty error
    if (role === 'owner' || role === 'admin') {
      return [...ALL_PAGE_KEYS]
    }
    return [...ALWAYS_ALLOWED_PAGE_KEYS]
  }

  const keys = (data ?? []).map((row) => row.page_key as string)

  if (keys.length === 0 && (role === 'owner' || role === 'admin')) {
    return [...ALL_PAGE_KEYS]
  }

  return mergeAlwaysAllowed(keys)
}

export async function listPageAccessMap(
  supabase: SupabaseClient,
  membershipId: string
): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from('tenant_membership_page_access')
    .select('page_key, can_access')
    .eq('membership_id', membershipId)

  if (error) {
    console.error('listPageAccessMap', error.message)
    return Object.fromEntries(ALWAYS_ALLOWED_PAGE_KEYS.map((k) => [k, true]))
  }

  const map: Record<string, boolean> = {}
  for (const key of ALL_PAGE_KEYS) {
    map[key] = ALWAYS_ALLOWED_PAGE_KEYS.includes(key)
  }
  for (const row of data ?? []) {
    map[row.page_key] = Boolean(row.can_access)
  }
  for (const key of ALWAYS_ALLOWED_PAGE_KEYS) {
    map[key] = true
  }
  return map
}
