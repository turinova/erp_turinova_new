import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeReviewSettings } from './settings'
import { resolveStatusReviewMode } from './status-cta'
import {
  budapestLocalToDate,
  computeThankSmsSendAfter,
  evaluateThankSms,
  isWithinSendWindow
} from './thank-sms'

const base = {
  enabled: true,
  hasReviewUrl: true,
  tone: 'success' as const,
  clickedFromThisLink: false,
  clickedRecently: false,
  isRepeatCustomer: false
}

describe('resolveStatusReviewMode', () => {
  it('ready page: first vs repeat customer', () => {
    assert.equal(resolveStatusReviewMode(base), 'first')
    assert.equal(resolveStatusReviewMode({ ...base, isRepeatCustomer: true }), 'repeat')
  })

  it('handed over → primary', () => {
    assert.equal(resolveStatusReviewMode({ ...base, tone: 'neutral' }), 'primary')
  })

  it('in progress / partial → nothing', () => {
    assert.equal(resolveStatusReviewMode({ ...base, tone: 'info' }), null)
    assert.equal(resolveStatusReviewMode({ ...base, tone: 'warning' }), null)
  })

  it('disabled or no link → nothing', () => {
    assert.equal(resolveStatusReviewMode({ ...base, enabled: false }), null)
    assert.equal(resolveStatusReviewMode({ ...base, hasReviewUrl: false }), null)
  })

  it('clicked on this link → thanks; clicked elsewhere recently → hidden', () => {
    assert.equal(resolveStatusReviewMode({ ...base, clickedFromThisLink: true }), 'thanks')
    assert.equal(resolveStatusReviewMode({ ...base, clickedRecently: true }), null)
    assert.equal(
      resolveStatusReviewMode({ ...base, tone: 'neutral', clickedRecently: true }),
      null
    )
  })
})

describe('thank SMS timing (Budapest)', () => {
  it('next_morning → next day 10:00 local, also across DST', () => {
    const winter = computeThankSmsSendAfter(new Date('2026-11-10T15:00:00Z'), 'next_morning')
    assert.equal(winter.toISOString(), '2026-11-11T09:00:00.000Z')
    const summer = computeThankSmsSendAfter(new Date('2026-07-01T15:00:00Z'), 'next_morning')
    assert.equal(summer.toISOString(), '2026-07-02T08:00:00.000Z')
  })

  it('after_2h inside window stays +2h', () => {
    const at = computeThankSmsSendAfter(new Date('2026-11-10T10:00:00Z'), 'after_2h')
    assert.equal(at.toISOString(), '2026-11-10T12:00:00.000Z')
  })

  it('after_2h in the evening → next morning 10:00', () => {
    // 17:30 UTC + 2h = 20:30 Budapest (CET)
    const at = computeThankSmsSendAfter(new Date('2026-11-10T17:30:00Z'), 'after_2h')
    assert.equal(at.toISOString(), '2026-11-11T09:00:00.000Z')
  })

  it('after_2h before opening → same day 9:00', () => {
    // 04:00 UTC + 2h = 07:00 Budapest
    const at = computeThankSmsSendAfter(new Date('2026-11-10T04:00:00Z'), 'after_2h')
    assert.equal(at.toISOString(), budapestLocalToDate('2026-11-10', 9).toISOString())
  })

  it('send window 9–19 Budapest', () => {
    assert.equal(isWithinSendWindow(new Date('2026-11-10T08:00:00Z')), true) // 09:00
    assert.equal(isWithinSendWindow(new Date('2026-11-10T18:00:00Z')), false) // 19:00
    assert.equal(isWithinSendWindow(new Date('2026-11-10T07:59:00Z')), false) // 08:59
  })
})

describe('evaluateThankSms', () => {
  const now = new Date('2026-11-11T09:00:00Z')
  const ok = {
    settingsEnabled: true,
    hasReviewUrl: true,
    hasSmsAddon: true,
    customerExists: true,
    consent: true,
    phoneOk: true,
    lastRequestAt: null,
    lastClickAt: null,
    frequencyDays: 180,
    handedOverAt: '2026-11-10T15:00:00Z',
    now
  }

  it('eligible', () => {
    assert.deepEqual(evaluateThankSms(ok), { ok: true })
  })

  it('consent and phone are required', () => {
    assert.deepEqual(evaluateThankSms({ ...ok, consent: false }), {
      ok: false,
      reason: 'no_review_consent'
    })
    assert.deepEqual(evaluateThankSms({ ...ok, phoneOk: false }), { ok: false, reason: 'bad_phone' })
  })

  it('frequency cap applies to previous SMS and previous click', () => {
    assert.deepEqual(evaluateThankSms({ ...ok, lastRequestAt: '2026-09-01T00:00:00Z' }), {
      ok: false,
      reason: 'review_capped'
    })
    assert.deepEqual(evaluateThankSms({ ...ok, lastClickAt: '2026-10-01T00:00:00Z' }), {
      ok: false,
      reason: 'review_capped'
    })
    assert.deepEqual(
      evaluateThankSms({ ...ok, frequencyDays: 90, lastRequestAt: '2026-07-01T00:00:00Z' }),
      { ok: true }
    )
  })

  it('stale handover is skipped', () => {
    assert.deepEqual(evaluateThankSms({ ...ok, handedOverAt: '2026-11-05T10:00:00Z' }), {
      ok: false,
      reason: 'stale'
    })
  })
})

describe('normalizeReviewSettings', () => {
  it('defaults without row and coerces bad values', () => {
    assert.equal(normalizeReviewSettings(null).statusPageEnabled, true)
    assert.equal(normalizeReviewSettings(null).thankSmsEnabled, false)
    const s = normalizeReviewSettings({ frequency_days: 7, thank_sms_timing: 'x', handover_qr_text: ' ' })
    assert.equal(s.frequencyDays, 180)
    assert.equal(s.thankSmsTiming, 'next_morning')
    assert.ok(s.handoverQrText.length > 0)
  })
})
