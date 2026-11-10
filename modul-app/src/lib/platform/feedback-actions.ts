'use server'

import { revalidatePath } from 'next/cache'

import { requirePlatformAdmin } from '@/lib/platform/auth'

export type PlatformFeedbackActionResult = {
  ok?: boolean
  message?: string
}

export async function markPartnerFeedbackReviewedAction(
  feedbackId: string
): Promise<PlatformFeedbackActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { message: ctx.message }

  const id = feedbackId?.trim()
  if (!id) return { message: 'Hiányzó azonosító.' }

  const { error } = await ctx.admin
    .from('partner_product_feedback')
    .update({ reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .is('reviewed_at', null)

  if (error) {
    console.error('markPartnerFeedbackReviewed', error.message)
    return { message: 'Nem sikerült megjelölni.' }
  }

  revalidatePath('/platform/visszajelzesek')
  revalidatePath('/visszajelzesek')
  return { ok: true }
}
