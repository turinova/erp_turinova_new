import { createClient } from '@/lib/supabase/server'
import type { PartnerProfile } from '@/lib/supabase/database.types'

export type PartnerSession = {
  id: string
  email: string
  name: string
  mobile: string | null
  selectedTenantId: string | null
  profile: PartnerProfile
}

export async function getPartnerSession(): Promise<PartnerSession | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  const { data: profile, error } = await supabase
    .from('partner_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('getPartnerSession', error.message)
    return null
  }

  if (!profile) return null

  return {
    id: user.id,
    email: user.email,
    name: profile.name,
    mobile: profile.mobile,
    selectedTenantId: profile.selected_tenant_id,
    profile
  }
}

export async function userHasTenantMembership(
  userId: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { data, error } = await supabase
    .from('tenant_memberships')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (error) {
    console.error('userHasTenantMembership', error.message)
    return false
  }

  return (data?.length ?? 0) > 0
}

export async function userHasPartnerProfile(userId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { data, error } = await supabase
    .from('partner_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('userHasPartnerProfile', error.message)
    return false
  }

  return Boolean(data)
}
