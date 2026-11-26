import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MAX_POSTPONES,
  REVIEW_CANCEL_REASONS,
  canPostpone,
  isPostponeDays,
  isReviewCancelReason,
  postponedSendAfter
} from './queue-rules'

const DAY = 24 * 60 * 60 * 1000

describe('review queue rules', () => {
  it('postpone only pending rows below the limit', () => {
    assert.equal(canPostpone({ status: 'pending', postponed_count: 0 }), true)
    assert.equal(canPostpone({ status: 'pending', postponed_count: MAX_POSTPONES }), false)
    assert.equal(canPostpone({ status: 'sent', postponed_count: 0 }), false)
  })

  it('accepts only 7/14/30 days', () => {
    assert.equal(isPostponeDays(14), true)
    assert.equal(isPostponeDays(5), false)
  })

  it('postpones from the later of send_after and now', () => {
    const now = new Date('2026-11-26T09:00:00Z')
    const future = '2026-11-27T09:00:00Z'
    assert.equal(postponedSendAfter(future, 7, now).getTime(), new Date(future).getTime() + 7 * DAY)
    const past = '2026-11-20T09:00:00Z'
    assert.equal(postponedSendAfter(past, 7, now).getTime(), now.getTime() + 7 * DAY)
  })

  it('has no satisfaction-based cancel reason (no review gating)', () => {
    assert.equal(isReviewCancelReason('customer_request'), true)
    assert.equal(isReviewCancelReason('unhappy'), false)
    assert.ok(!REVIEW_CANCEL_REASONS.some((r) => /unhappy|negative|bad/.test(r)))
  })
})
