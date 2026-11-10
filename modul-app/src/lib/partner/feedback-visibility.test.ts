/**
 * Run: npx tsx --test src/lib/partner/feedback-visibility.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { computeNpsSummary } from '../platform/feedback-queries'
import {
  FEEDBACK_DISMISS_SNOOZE_FIRST_DAYS,
  FEEDBACK_DISMISS_SNOOZE_NEXT_DAYS,
  FEEDBACK_RESUBMIT_DAYS,
  NPS_MIN_ACCOUNT_AGE_DAYS,
  shouldShowPartnerFeedbackCard,
  shouldShowPartnerSuggestionBox
} from './feedback-visibility'

const MS_DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-11-10T10:00:00.000Z')
const daysAgo = (d: number) => new Date(NOW - d * MS_DAY).toISOString()

const eligible = {
  hasTenant: true,
  mustSetPassword: false,
  submittedOrderCount: 3,
  accountCreatedAt: daysAgo(60),
  lastFeedbackAt: null,
  dismissedAt: null,
  dismissCount: 0,
  nowMs: NOW
}

describe('shouldShowPartnerFeedbackCard (NPS)', () => {
  it('shows for an eligible partner', () => {
    assert.equal(shouldShowPartnerFeedbackCard(eligible), true)
  })

  it('hides without tenant or during password claim', () => {
    assert.equal(shouldShowPartnerFeedbackCard({ ...eligible, hasTenant: false }), false)
    assert.equal(
      shouldShowPartnerFeedbackCard({ ...eligible, mustSetPassword: true }),
      false
    )
  })

  it('needs at least one submitted order', () => {
    assert.equal(
      shouldShowPartnerFeedbackCard({ ...eligible, submittedOrderCount: 0 }),
      false
    )
  })

  it('needs a minimum account age', () => {
    assert.equal(
      shouldShowPartnerFeedbackCard({
        ...eligible,
        accountCreatedAt: daysAgo(NPS_MIN_ACCOUNT_AGE_DAYS - 1)
      }),
      false
    )
  })

  it('hides within the 90-day wave after an answer', () => {
    assert.equal(
      shouldShowPartnerFeedbackCard({ ...eligible, lastFeedbackAt: daysAgo(10) }),
      false
    )
    assert.equal(
      shouldShowPartnerFeedbackCard({
        ...eligible,
        lastFeedbackAt: daysAgo(FEEDBACK_RESUBMIT_DAYS + 1)
      }),
      true
    )
  })

  it('applies dismiss snooze 14 then 30 days', () => {
    assert.equal(
      shouldShowPartnerFeedbackCard({ ...eligible, dismissedAt: daysAgo(13), dismissCount: 1 }),
      false
    )
    assert.equal(
      shouldShowPartnerFeedbackCard({
        ...eligible,
        dismissedAt: daysAgo(FEEDBACK_DISMISS_SNOOZE_FIRST_DAYS + 1),
        dismissCount: 1
      }),
      true
    )
    assert.equal(
      shouldShowPartnerFeedbackCard({ ...eligible, dismissedAt: daysAgo(29), dismissCount: 2 }),
      false
    )
    assert.equal(
      shouldShowPartnerFeedbackCard({
        ...eligible,
        dismissedAt: daysAgo(FEEDBACK_DISMISS_SNOOZE_NEXT_DAYS + 1),
        dismissCount: 2
      }),
      true
    )
  })
})

describe('shouldShowPartnerSuggestionBox', () => {
  it('is always on with a tenant, outside the claim flow', () => {
    assert.equal(shouldShowPartnerSuggestionBox({ hasTenant: true, mustSetPassword: false }), true)
    assert.equal(shouldShowPartnerSuggestionBox({ hasTenant: false, mustSetPassword: false }), false)
    assert.equal(shouldShowPartnerSuggestionBox({ hasTenant: true, mustSetPassword: true }), false)
  })
})

describe('computeNpsSummary', () => {
  it('counts only the latest answer per partner', () => {
    const s = computeNpsSummary(
      [
        { partnerUserId: 'a', score: 3, createdAt: daysAgo(20) },
        { partnerUserId: 'a', score: 10, createdAt: daysAgo(5) },
        { partnerUserId: 'b', score: 8, createdAt: daysAgo(5) },
        { partnerUserId: 'c', score: 2, createdAt: daysAgo(5) },
        { partnerUserId: 'd', score: 9, createdAt: daysAgo(5) }
      ],
      90
    )
    assert.equal(s.n, 4)
    assert.equal(s.promoters, 2)
    assert.equal(s.passives, 1)
    assert.equal(s.detractors, 1)
    assert.equal(s.nps, 25)
  })

  it('returns null NPS without answers', () => {
    assert.equal(computeNpsSummary([], 90).nps, null)
  })
})
