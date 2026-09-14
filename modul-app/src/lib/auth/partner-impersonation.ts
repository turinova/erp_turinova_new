import { cookies } from 'next/headers'
import { cache } from 'react'

import { IMPERSONATION_SESSION_COOKIE } from '@/lib/auth/config'
import type { ImpersonationInfo } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

async function loadPartnerImpersonation(
  userId: string,
  email: string
): Promise<ImpersonationInfo | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(IMPERSONATION_SESSION_COOKIE)?.value
  if (!sessionId) return null

  const supabase = await createClient()
  if (!supabase) return null

  const { data: imp } = await supabase
    .from('platform_impersonation_sessions')
    .select(
      'id, operator_user_id, target_user_id, tenant_id, subject_kind, expires_at, ended_at'
    )
    .eq('id', sessionId)
    .maybeSingle()

  if (
    !imp ||
    imp.ended_at ||
    imp.target_user_id !== userId ||
    new Date(imp.expires_at).getTime() <= Date.now()
  ) {
    return null
  }

  let operatorEmail: string | null = null
  try {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const admin = createServiceClient()
    if (admin) {
      const { data } = await admin.auth.admin.getUserById(imp.operator_user_id)
      operatorEmail = data.user?.email ?? null
    }
  } catch {
    operatorEmail = null
  }

  return {
    sessionId: imp.id,
    operatorUserId: imp.operator_user_id,
    operatorEmail,
    targetEmail: email,
    tenantId: imp.tenant_id,
    tenantName: 'Partner portál',
    expiresAt: imp.expires_at,
    subjectKind: 'partner'
  }
}

export const getPartnerImpersonation = cache(loadPartnerImpersonation)
