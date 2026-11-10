'use client'

import { useState } from 'react'

import { PartnerNpsCard } from '@/components/partner/home/partner-nps-card'
import { PartnerReviewCard } from '@/components/partner/home/partner-review-card'
import { PartnerSuggestionBox } from '@/components/partner/home/partner-suggestion-box'
import type { PartnerReviewPrompt } from '@/lib/partner/review-prompt'

/**
 * Egyszerre egy kérés: ha esedékes a Google-értékelés (friss átadott rendelés), az látszik,
 * különben az NPS (benne szöveg is írható); utána / egyébként a mindig elérhető javaslat-bedobó.
 */
export function PartnerFeedbackArea({
  showNps,
  showSuggestion,
  reviewPrompt
}: {
  showNps: boolean
  showSuggestion: boolean
  reviewPrompt: PartnerReviewPrompt | null
}) {
  const [reviewActive, setReviewActive] = useState(Boolean(reviewPrompt))
  const [npsActive, setNpsActive] = useState(showNps)

  if (reviewActive && reviewPrompt) {
    return <PartnerReviewCard prompt={reviewPrompt} onDone={() => setReviewActive(false)} />
  }
  if (npsActive) {
    return <PartnerNpsCard onDone={() => setNpsActive(false)} />
  }
  if (showSuggestion) return <PartnerSuggestionBox />
  return null
}
