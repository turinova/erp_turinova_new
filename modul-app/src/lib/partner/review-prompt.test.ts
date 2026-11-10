import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  partnerReviewCopy,
  partnerReviewVariant,
  shouldShowPartnerReviewCard,
  withHuArticle
} from './review-prompt'

const NOW = Date.parse('2026-11-10T10:00:00Z')
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString()

const ok = {
  hasTenant: true,
  mustSetPassword: false,
  enabled: true,
  hasReviewUrl: true,
  finishedCount: 1,
  lastFinishedAt: daysAgo(3),
  clickedAt: null,
  selfReportedAt: null,
  dismissedAt: null,
  dismissCount: 0,
  frequencyDays: 180,
  requireRecentOrder: true,
  nowMs: NOW
}

describe('shouldShowPartnerReviewCard', () => {
  it('friss átadott rendelés után megjelenik', () => {
    assert.equal(shouldShowPartnerReviewCard(ok), true)
  })

  it('nincs cég / jelszó beállítás / kikapcsolva / nincs link', () => {
    assert.equal(shouldShowPartnerReviewCard({ ...ok, hasTenant: false }), false)
    assert.equal(shouldShowPartnerReviewCard({ ...ok, mustSetPassword: true }), false)
    assert.equal(shouldShowPartnerReviewCard({ ...ok, enabled: false }), false)
    assert.equal(shouldShowPartnerReviewCard({ ...ok, hasReviewUrl: false }), false)
  })

  it('átadott rendelés nélkül vagy 30 napnál régebbivel nem', () => {
    assert.equal(
      shouldShowPartnerReviewCard({ ...ok, finishedCount: 0, lastFinishedAt: null }),
      false
    )
    assert.equal(shouldShowPartnerReviewCard({ ...ok, lastFinishedAt: daysAgo(31) }), false)
    assert.equal(shouldShowPartnerReviewCard({ ...ok, lastFinishedAt: daysAgo(30) }), true)
  })

  it('rendelés-feltétel kikapcsolva: rendelés nélkül is megjelenik', () => {
    assert.equal(
      shouldShowPartnerReviewCard({
        ...ok,
        requireRecentOrder: false,
        finishedCount: 0,
        lastFinishedAt: null
      }),
      true
    )
  })

  it('„Már írtam” után soha', () => {
    assert.equal(shouldShowPartnerReviewCard({ ...ok, selfReportedAt: daysAgo(400) }), false)
  })

  it('kattintás után a gyakorisági keretig nem', () => {
    assert.equal(shouldShowPartnerReviewCard({ ...ok, clickedAt: daysAgo(100) }), false)
    assert.equal(shouldShowPartnerReviewCard({ ...ok, clickedAt: daysAgo(181) }), true)
    assert.equal(
      shouldShowPartnerReviewCard({ ...ok, clickedAt: daysAgo(100), frequencyDays: 90 }),
      true
    )
  })

  it('„Most nem”: 30 nap, majd 90 nap, harmadszorra soha', () => {
    assert.equal(
      shouldShowPartnerReviewCard({ ...ok, dismissedAt: daysAgo(20), dismissCount: 1 }),
      false
    )
    assert.equal(
      shouldShowPartnerReviewCard({ ...ok, dismissedAt: daysAgo(31), dismissCount: 1 }),
      true
    )
    assert.equal(
      shouldShowPartnerReviewCard({ ...ok, dismissedAt: daysAgo(60), dismissCount: 2 }),
      false
    )
    assert.equal(
      shouldShowPartnerReviewCard({ ...ok, dismissedAt: daysAgo(91), dismissCount: 2 }),
      true
    )
    assert.equal(
      shouldShowPartnerReviewCard({ ...ok, dismissedAt: daysAgo(400), dismissCount: 3 }),
      false
    )
  })
})

describe('partnerReviewCopy', () => {
  it('5 rendeléstől törzspartner szöveg', () => {
    assert.equal(partnerReviewVariant(4), 'first')
    assert.equal(partnerReviewVariant(5), 'regular')
    assert.match(partnerReviewCopy('regular', 'Bútor Kft.', 12).title, /^12 rendelésen/)
  })

  it('névelő a cégnév szerint', () => {
    assert.equal(withHuArticle('Alfa Kft.'), 'az Alfa Kft.')
    assert.equal(withHuArticle('Élzáró Bt.'), 'az Élzáró Bt.')
    assert.equal(withHuArticle('Bútor Kft.'), 'a Bútor Kft.')
    assert.equal(withHuArticle('5 Lap Kft.'), 'az 5 Lap Kft.')
    assert.match(partnerReviewCopy('first', 'Ödön Lapszabászat', 1).title, /az Ödön Lapszabászat munkájáról/)
  })

  it('nincs gondolatjel a szövegekben', () => {
    const all = [
      partnerReviewCopy('first', 'X', 1),
      partnerReviewCopy('regular', 'X', 9)
    ].flatMap((c) => [c.title, c.body])
    for (const s of all) assert.doesNotMatch(s, /[—–]/)
  })
})
