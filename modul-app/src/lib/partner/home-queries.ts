import type { SupabaseClient } from '@supabase/supabase-js'

import { getTenantOpeningHours } from '@/lib/company/queries'
import type { OpeningHours } from '@/lib/opening-hours'
import { resolvePartnerCompanyLabel } from '@/lib/partner/company-label'
import {
  shouldShowPartnerFeedbackCard,
  shouldShowPartnerSuggestionBox
} from '@/lib/partner/feedback-visibility'
import {
  listPartnerSubmittedQuotes,
  type PartnerQuoteListItem
} from '@/lib/partner/quotes-queries'
import type { PartnerReviewPrompt } from '@/lib/partner/review-prompt'
import { loadPartnerReviewPrompt } from '@/lib/partner/review-prompt-queries'
import { createClient } from '@/lib/supabase/server'

export type PartnerHomeContact = {
  phone: string | null
  email: string | null
  website: string | null
  addressLine: string | null
}

export type PartnerHomeData = {
  companyLabel: string | null
  companyName: string | null
  contact: PartnerHomeContact | null
  openingHours: OpeningHours | null
  openingHoursNote: string | null
  draftCount: number
  openOrderCount: number
  submittedCount: number
  /** null = betöltési hiba (a kártya hibasort mutat). */
  recentOrders: PartnerQuoteListItem[] | null
  /** null = nincs kapcsolt cég / nem ellenőrizhető. */
  acceptsOrders: boolean | null
  /** NPS kártya (0–10, 90 naponta) — docs/54. */
  showProductFeedback: boolean
  /** Mindig elérhető javaslat-bedobó — docs/54. */
  showSuggestionBox: boolean
  /** Google értékelés kártya a kapcsolt boltnak — docs/55. Ha van, az NPS vár. */
  reviewPrompt: PartnerReviewPrompt | null
}

function buildAddressLine(row: {
  postal_code: string | null
  city: string | null
  address: string | null
}): string | null {
  const cityLine = [row.postal_code, row.city].filter(Boolean).join(' ').trim()
  const parts = [cityLine || null, row.address]
    .map((p) => p?.trim())
    .filter(Boolean) as string[]
  return parts.length > 0 ? parts.join(', ') : null
}

function contactFromRow(row: {
  phone_number: string | null
  email: string | null
  website: string | null
  postal_code: string | null
  city: string | null
  address: string | null
}): PartnerHomeContact | null {
  const phone = row.phone_number?.trim() || null
  const email = row.email?.trim() || null
  const website = row.website?.trim() || null
  const addressLine = buildAddressLine(row)
  if (!phone && !email && !website && !addressLine) return null
  return { phone, email, website, addressLine }
}

async function countPartnerQuotes(
  supabase: SupabaseClient,
  partnerId: string,
  kind: 'draft' | 'submitted' | 'open'
): Promise<number> {
  let query = supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('partner_profile_id', partnerId)
    .eq('source', 'portal')
    .is('deleted_at', null)

  if (kind === 'draft') {
    query = query.is('portal_submitted_at', null).eq('status', 'draft')
  } else {
    query = query.not('portal_submitted_at', 'is', null)
    if (kind === 'open') {
      query = query.in('status', ['draft', 'ordered', 'in_production', 'ready'])
    }
  }

  const { count, error } = await query
  if (error) {
    console.error('countPartnerQuotes', kind, error.message)
    return 0
  }
  return count ?? 0
}

async function tenantAcceptsOrders(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('partner_can_read_tenant_catalog', {
    p_tenant_id: tenantId
  })
  if (error) {
    console.error('tenantAcceptsOrders', error.message)
    return null
  }
  return Boolean(data)
}

export async function loadPartnerHomeData(
  partnerId: string,
  selectedTenantId: string | null,
  feedbackPrompt?: {
    mustSetPassword: boolean
    accountCreatedAt: string | null
    dismissedAt: string | null
    dismissCount: number
  }
): Promise<PartnerHomeData> {
  const companyLabel = await resolvePartnerCompanyLabel(selectedTenantId)

  const empty: PartnerHomeData = {
    companyLabel,
    companyName: null,
    contact: null,
    openingHours: null,
    openingHoursNote: null,
    draftCount: 0,
    openOrderCount: 0,
    submittedCount: 0,
    recentOrders: null,
    acceptsOrders: null,
    showProductFeedback: false,
    showSuggestionBox: false,
    reviewPrompt: null
  }

  const supabase = await createClient()
  if (!supabase || !partnerId) return empty

  const [
    draftCount,
    submittedCount,
    openOrderCount,
    recentOrders,
    companyRow,
    opening,
    acceptsOrders,
    lastFeedback,
    reviewPromptBase
  ] = await Promise.all([
    countPartnerQuotes(supabase, partnerId, 'draft'),
    countPartnerQuotes(supabase, partnerId, 'submitted'),
    countPartnerQuotes(supabase, partnerId, 'open'),
    listPartnerSubmittedQuotes(supabase, {
      partnerId,
      filter: 'all',
      page: 1,
      limit: 5
    })
      .then((r) => r.rows)
      .catch(() => null),
    selectedTenantId
      ? supabase
          .from('tenant_companies')
          .select('name, phone_number, email, website, postal_code, city, address')
          .eq('tenant_id', selectedTenantId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              console.error('loadPartnerHomeData company', error.message)
              return null
            }
            return data
          })
      : Promise.resolve(null),
    selectedTenantId
      ? getTenantOpeningHours(supabase, selectedTenantId)
      : Promise.resolve(null),
    selectedTenantId
      ? tenantAcceptsOrders(supabase, selectedTenantId)
      : Promise.resolve(null),
    supabase
      .from('partner_product_feedback')
      .select('created_at')
      .eq('partner_user_id', partnerId)
      .eq('kind', 'nps')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          // Migráció előtt — ne törje a home-ot, és ne mutassunk működésképtelen kártyát
          console.error('loadPartnerHomeData feedback', error.message)
          return { failed: true as const, lastAt: null }
        }
        return { failed: false as const, lastAt: data?.created_at ?? null }
      }),
    selectedTenantId && feedbackPrompt
      ? loadPartnerReviewPrompt(supabase, {
          partnerId,
          tenantId: selectedTenantId,
          mustSetPassword: feedbackPrompt.mustSetPassword
        })
      : Promise.resolve(null)
  ])

  const hasTenant = Boolean(selectedTenantId)
  const feedbackReady = Boolean(feedbackPrompt) && !lastFeedback.failed
  const companyName = companyRow?.name?.trim() || null

  const reviewPrompt: PartnerReviewPrompt | null =
    reviewPromptBase && companyName ? { ...reviewPromptBase, companyName } : null

  const showProductFeedback =
    !reviewPrompt && feedbackPrompt && feedbackReady
      ? shouldShowPartnerFeedbackCard({
          hasTenant,
          mustSetPassword: feedbackPrompt.mustSetPassword,
          submittedOrderCount: submittedCount,
          accountCreatedAt: feedbackPrompt.accountCreatedAt,
          lastFeedbackAt: lastFeedback.lastAt,
          dismissedAt: feedbackPrompt.dismissedAt,
          dismissCount: feedbackPrompt.dismissCount
        })
      : false

  const showSuggestionBox =
    feedbackPrompt && feedbackReady
      ? shouldShowPartnerSuggestionBox({
          hasTenant,
          mustSetPassword: feedbackPrompt.mustSetPassword
        })
      : false

  return {
    companyLabel,
    companyName,
    contact: companyRow ? contactFromRow(companyRow) : null,
    openingHours: opening?.hours ?? null,
    openingHoursNote: opening?.note ?? null,
    draftCount,
    openOrderCount,
    submittedCount,
    recentOrders,
    acceptsOrders,
    showProductFeedback,
    showSuggestionBox,
    reviewPrompt
  }
}
