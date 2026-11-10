'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { getPartnerSession, type PartnerSession } from '@/lib/auth/partner-session'
import { PARTNER_HOME_PATH } from '@/lib/auth/surface'
import {
  feedbackPromptVariant,
  isFeedbackTagId
} from '@/lib/partner/feedback-copy'
import { createClient } from '@/lib/supabase/server'

export type PartnerFeedbackActionResult = {
  ok?: boolean
  message?: string
}

const SUGGESTION_DAILY_LIMIT = 10
const MS_DAY = 24 * 60 * 60 * 1000

function parseNpsScore(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 10) return null
  return n
}

function cleanComment(raw: string | undefined): string | null {
  return (raw ?? '').trim().slice(0, 2000) || null
}

function cleanTags(raw: string[] | undefined): string[] {
  return [...new Set((raw ?? []).filter(isFeedbackTagId))]
}

function guardSession(session: PartnerSession | null): string | null {
  if (!session) return 'Nincs bejelentkezés.'
  if (session.profile.must_set_password) return 'Előbb állíts be jelszót.'
  if (!session.selectedTenantId) return 'Válassz előbb céget.'
  return null
}

async function userAgent(): Promise<string | null> {
  const hdrs = await headers()
  return hdrs.get('user-agent')?.slice(0, 500) ?? null
}

/**
 * NPS pontszám mentése kattintásra. Első hívás beszúr, a további hívások
 * (feedbackId-vel) ugyanazt a sort frissítik — így a véletlen tap javítható,
 * és Küldés nélkül sem vész el a pontszám.
 */
export async function saveNpsScoreAction(input: {
  feedbackId?: string | null
  score: number
}): Promise<PartnerFeedbackActionResult & { feedbackId?: string }> {
  const session = await getPartnerSession()
  const guard = guardSession(session)
  if (guard || !session) return { message: guard ?? 'Nincs bejelentkezés.' }

  const score = parseNpsScore(input.score)
  if (score === null) return { message: 'Válassz 0 és 10 közötti értéket.' }

  const supabase = await createClient()
  if (!supabase) return { message: 'Mentés most nem elérhető.' }

  const now = new Date().toISOString()

  if (input.feedbackId) {
    const { error } = await supabase
      .from('partner_product_feedback')
      .update({
        score,
        prompt_variant: feedbackPromptVariant(score),
        updated_at: now
      })
      .eq('id', input.feedbackId)
      .eq('partner_user_id', session.id)
      .eq('kind', 'nps')
    if (error) {
      console.error('saveNpsScore update', error.message)
      return { message: 'Nem sikerült menteni. Próbáld újra.' }
    }
    return { ok: true, feedbackId: input.feedbackId }
  }

  const { data, error } = await supabase
    .from('partner_product_feedback')
    .insert({
      partner_user_id: session.id,
      tenant_id: session.selectedTenantId,
      kind: 'nps',
      score,
      prompt_variant: feedbackPromptVariant(score),
      source: 'partner_home_nps_v1',
      user_agent: await userAgent()
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('saveNpsScore insert', error?.message)
    return { message: 'Nem sikerült menteni. Próbáld újra.' }
  }

  // A 90 napos ablak innentől a feedback sorból jön
  await supabase
    .from('partner_profiles')
    .update({
      product_feedback_dismissed_at: null,
      product_feedback_dismiss_count: 0
    })
    .eq('user_id', session.id)

  return { ok: true, feedbackId: data.id as string }
}

/** Címkék + szöveg hozzáadása a már mentett NPS sorhoz. */
export async function saveNpsDetailAction(input: {
  feedbackId: string
  comment?: string
  tags?: string[]
}): Promise<PartnerFeedbackActionResult> {
  const session = await getPartnerSession()
  const guard = guardSession(session)
  if (guard || !session) return { message: guard ?? 'Nincs bejelentkezés.' }
  if (!input.feedbackId) return { message: 'Előbb válassz értéket.' }

  const supabase = await createClient()
  if (!supabase) return { message: 'Mentés most nem elérhető.' }

  const { error } = await supabase
    .from('partner_product_feedback')
    .update({
      comment: cleanComment(input.comment),
      tags: cleanTags(input.tags),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.feedbackId)
    .eq('partner_user_id', session.id)
    .eq('kind', 'nps')

  if (error) {
    console.error('saveNpsDetail', error.message)
    return { message: 'Nem sikerült elküldeni. Próbáld újra.' }
  }
  return { ok: true }
}

/** Szabad javaslat — bármikor, pontszám nélkül. */
export async function submitPartnerSuggestionAction(input: {
  comment?: string
  tags?: string[]
}): Promise<PartnerFeedbackActionResult> {
  const session = await getPartnerSession()
  const guard = guardSession(session)
  if (guard || !session) return { message: guard ?? 'Nincs bejelentkezés.' }

  const comment = cleanComment(input.comment)
  const tags = cleanTags(input.tags)
  if (!comment && tags.length === 0) {
    return { message: 'Írj pár szót, vagy válassz egy címkét.' }
  }

  const supabase = await createClient()
  if (!supabase) return { message: 'Mentés most nem elérhető.' }

  const since = new Date(Date.now() - MS_DAY).toISOString()
  const { count, error: countError } = await supabase
    .from('partner_product_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('partner_user_id', session.id)
    .eq('kind', 'suggestion')
    .gte('created_at', since)

  if (countError) {
    console.error('submitPartnerSuggestion count', countError.message)
    return { message: 'Nem sikerült elküldeni. Próbáld újra.' }
  }
  if ((count ?? 0) >= SUGGESTION_DAILY_LIMIT) {
    return { message: 'Mára elég sok javaslatot küldtél — holnap folytathatod. Köszönjük!' }
  }

  const { error } = await supabase.from('partner_product_feedback').insert({
    partner_user_id: session.id,
    tenant_id: session.selectedTenantId,
    kind: 'suggestion',
    score: null,
    comment,
    tags,
    source: 'partner_home_suggestion_v1',
    user_agent: await userAgent()
  })

  if (error) {
    console.error('submitPartnerSuggestion', error.message)
    return { message: 'Nem sikerült elküldeni. Próbáld újra.' }
  }
  return { ok: true }
}

export async function dismissPartnerProductFeedbackAction(): Promise<PartnerFeedbackActionResult> {
  const session = await getPartnerSession()
  if (!session) return { message: 'Nincs bejelentkezés.' }

  const supabase = await createClient()
  if (!supabase) return { message: 'Mentés most nem elérhető.' }

  const nextCount = (session.profile.product_feedback_dismiss_count ?? 0) + 1
  const { error } = await supabase
    .from('partner_profiles')
    .update({
      product_feedback_dismissed_at: new Date().toISOString(),
      product_feedback_dismiss_count: nextCount
    })
    .eq('user_id', session.id)

  if (error) {
    console.error('dismissPartnerProductFeedback', error.message)
    return { message: 'Nem sikerült elrejteni. Próbáld újra.' }
  }

  revalidatePath(PARTNER_HOME_PATH)
  revalidatePath('/partner/home')
  return { ok: true }
}
