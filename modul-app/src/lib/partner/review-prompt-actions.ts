'use server'

import { getPartnerSession } from '@/lib/auth/partner-session'
import { createClient } from '@/lib/supabase/server'

export type PartnerReviewActionResult = { ok: boolean; message?: string }

type PromptEvent = 'clicked' | 'self_reported' | 'dismissed'

async function recordPromptEvent(
  tenantId: string,
  event: PromptEvent
): Promise<PartnerReviewActionResult> {
  const session = await getPartnerSession()
  if (!session) return { ok: false, message: 'Nincs bejelentkezés.' }
  if (session.profile.must_set_password) return { ok: false, message: 'Előbb állíts be jelszót.' }
  if (!tenantId || session.selectedTenantId !== tenantId) {
    return { ok: false, message: 'Válassz előbb céget.' }
  }

  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Mentés most nem elérhető.' }

  const { data: current, error: readError } = await supabase
    .from('partner_review_prompts')
    .select('dismiss_count')
    .eq('partner_user_id', session.id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (readError) {
    console.error('recordPromptEvent read', readError.message)
    return { ok: false, message: 'Nem sikerült menteni.' }
  }

  const now = new Date().toISOString()
  const patch =
    event === 'clicked'
      ? { clicked_at: now }
      : event === 'self_reported'
        ? { self_reported_at: now }
        : { dismissed_at: now, dismiss_count: (current?.dismiss_count ?? 0) + 1 }

  const { error } = await supabase.from('partner_review_prompts').upsert(
    {
      partner_user_id: session.id,
      tenant_id: tenantId,
      ...patch,
      updated_at: now
    },
    { onConflict: 'partner_user_id,tenant_id' }
  )
  if (error) {
    console.error('recordPromptEvent', event, error.message)
    return { ok: false, message: 'Nem sikerült menteni.' }
  }
  return { ok: true }
}

export async function markPartnerReviewClickedAction(tenantId: string) {
  return recordPromptEvent(tenantId, 'clicked')
}

export async function markPartnerReviewWrittenAction(tenantId: string) {
  return recordPromptEvent(tenantId, 'self_reported')
}

export async function dismissPartnerReviewAction(tenantId: string) {
  return recordPromptEvent(tenantId, 'dismissed')
}
