/**
 * Run: npx tsx --test src/lib/partner/auto-proforma-rules.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  autoProformaBlocker,
  normalizeAutoProformaDueDays,
  partnerAutoProformaCopy,
  partnerBillingForProformaReady,
  partnerBillingIncompleteMessage,
  shouldAutoProforma,
  shouldSyncPortalAutoProformaIssued,
  type AutoProformaQuoteFacts
} from '@/lib/partner/auto-proforma-rules'

function facts(over: Partial<AutoProformaQuoteFacts> = {}): AutoProformaQuoteFacts {
  return {
    status: 'draft',
    payment_status: 'not_paid',
    final_total_gross: 50000,
    total_gross: 50000,
    total_paid: 0,
    customer: {
      name: 'Teszt Partner',
      email: 'partner@example.com',
      billing_name: 'Teszt Partner Kft.',
      billing_postal_code: '1111',
      billing_city: 'Budapest',
      billing_street: 'Fő utca 1.'
    },
    ...over
  }
}

describe('shouldSyncPortalAutoProformaIssued', () => {
  it('csak portal beküldött + proforma', () => {
    assert.equal(
      shouldSyncPortalAutoProformaIssued({
        kind: 'proforma',
        source: 'portal',
        portalSubmittedAt: '2026-01-01'
      }),
      true
    )
    assert.equal(
      shouldSyncPortalAutoProformaIssued({
        kind: 'advance',
        source: 'portal',
        portalSubmittedAt: '2026-01-01'
      }),
      false
    )
    assert.equal(
      shouldSyncPortalAutoProformaIssued({
        kind: 'proforma',
        source: 'opti',
        portalSubmittedAt: '2026-01-01'
      }),
      false
    )
    assert.equal(
      shouldSyncPortalAutoProformaIssued({
        kind: 'proforma',
        source: 'portal',
        portalSubmittedAt: null
      }),
      false
    )
  })
})

describe('shouldAutoProforma', () => {
  it('csak átutalás + kapcsoló + Agent kulcs esetén igaz', () => {
    assert.equal(
      shouldAutoProforma({
        enabled: true,
        hasAgentKey: true,
        methodKind: 'transfer'
      }),
      true
    )
    assert.equal(
      shouldAutoProforma({
        enabled: true,
        hasAgentKey: true,
        methodKind: 'cash'
      }),
      false
    )
    assert.equal(
      shouldAutoProforma({
        enabled: false,
        hasAgentKey: true,
        methodKind: 'transfer'
      }),
      false
    )
    assert.equal(
      shouldAutoProforma({
        enabled: true,
        hasAgentKey: false,
        methodKind: 'transfer'
      }),
      false
    )
  })
})

describe('autoProformaBlocker', () => {
  it('mehet, ha minden adat megvan', () => {
    assert.equal(autoProformaBlocker(facts()), null)
  })

  it('hiányos címnél kihagyja', () => {
    const msg = autoProformaBlocker(
      facts({
        customer: {
          ...facts().customer,
          billing_street: null
        }
      })
    )
    assert.match(msg ?? '', /számlázási adat/i)
  })

  it('rossz e-mailnél kihagyja', () => {
    const msg = autoProformaBlocker(
      facts({
        customer: { ...facts().customer, email: 'nincs-cím' }
      })
    )
    assert.match(msg ?? '', /e-mail/i)
  })

  it('nulla összegnél kihagyja', () => {
    const msg = autoProformaBlocker(
      facts({ final_total_gross: 0, total_gross: 0 })
    )
    assert.match(msg ?? '', /fizetendő/i)
  })
})

describe('normalizeAutoProformaDueDays', () => {
  it('alap 8, tartomány 1–60', () => {
    assert.equal(normalizeAutoProformaDueDays(null), 8)
    assert.equal(normalizeAutoProformaDueDays(0), 1)
    assert.equal(normalizeAutoProformaDueDays(99), 60)
    assert.equal(normalizeAutoProformaDueDays(14), 14)
  })
})

describe('partnerBillingForProformaReady', () => {
  it('teljes cím + e-mail OK', () => {
    const r = partnerBillingForProformaReady({
      billing_name: 'Teszt Kft.',
      email: 'a@b.hu',
      billing_postal_code: '1111',
      billing_city: 'Budapest',
      billing_street: 'Fő utca 1.'
    })
    assert.equal(r.ok, true)
  })

  it('hiányzó mezőket listáz', () => {
    const r = partnerBillingForProformaReady({
      name: '',
      email: 'rossz',
      billing_postal_code: null,
      billing_city: 'Bp',
      billing_street: null
    })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.deepEqual(r.missing.sort(), ['email', 'name', 'postal', 'street'].sort())
    }
    assert.match(partnerBillingIncompleteMessage(r), /számlázási/i)
  })
})

describe('partnerAutoProformaCopy', () => {
  it('null státusznál nincs szöveg (átutalás önmagában nem elég)', () => {
    assert.equal(partnerAutoProformaCopy(null), null)
    assert.equal(partnerAutoProformaCopy(undefined), null)
  })

  it('pending / processing', () => {
    const p = partnerAutoProformaCopy('pending')
    assert.equal(p?.tone, 'neutral')
    assert.match(p?.text ?? '', /folyamatban/i)
  })

  it('issued: számlaszámot mutat, hibaszöveget nem', () => {
    const withNum = partnerAutoProformaCopy('issued', 'D-2026-12')
    assert.equal(withNum?.tone, 'success')
    assert.match(withNum?.text ?? '', /D-2026-12/)
    const withErrorNote = partnerAutoProformaCopy(
      'issued',
      'Hiányos számlázási adat a partnernél'
    )
    assert.equal(withErrorNote?.text, 'Díjbekérő elküldve e-mailben.')
  })

  it('skipped számlázás: partner szöveg + settings link', () => {
    const skipped = partnerAutoProformaCopy(
      'skipped',
      'Hiányos számlázási adat a partnernél (név, irányítószám, város, utca).'
    )
    assert.equal(skipped?.showSettingsLink, true)
    assert.match(skipped?.text ?? '', /Beállítások/i)
  })

  it('failed egyéb: puha szöveg', () => {
    const failed = partnerAutoProformaCopy('failed', 'Számlázz időtúllépés')
    assert.equal(failed?.text, 'A díjbekérőt a cég intézi.')
    assert.equal(failed?.showSettingsLink, undefined)
  })
})
