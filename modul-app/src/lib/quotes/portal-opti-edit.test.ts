/**
 * Run: npx tsx --test src/lib/quotes/portal-opti-edit.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isOptiLockedByPortalSubmit,
  isPortalSubmittedQuote,
  portalOptiSaveInvoiceGate
} from './portal-opti-edit'

describe('isPortalSubmittedQuote', () => {
  it('true only for portal + submitted_at', () => {
    assert.equal(
      isPortalSubmittedQuote({
        source: 'portal',
        portalSubmittedAt: '2026-01-01'
      }),
      true
    )
    assert.equal(
      isPortalSubmittedQuote({ source: 'portal', portalSubmittedAt: null }),
      false
    )
    assert.equal(
      isPortalSubmittedQuote({
        source: 'opti',
        portalSubmittedAt: '2026-01-01'
      }),
      false
    )
  })
})

describe('isOptiLockedByPortalSubmit', () => {
  it('locks partner after submit', () => {
    assert.equal(
      isOptiLockedByPortalSubmit({
        partnerMode: true,
        source: 'portal',
        portalSubmittedAt: '2026-01-01'
      }),
      true
    )
  })

  it('does not lock staff after submit', () => {
    assert.equal(
      isOptiLockedByPortalSubmit({
        partnerMode: false,
        source: 'portal',
        portalSubmittedAt: '2026-01-01'
      }),
      false
    )
  })

  it('does not lock partner draft', () => {
    assert.equal(
      isOptiLockedByPortalSubmit({
        partnerMode: true,
        source: 'portal',
        portalSubmittedAt: null
      }),
      false
    )
  })
})

describe('portalOptiSaveInvoiceGate', () => {
  const base = {
    isPortalSubmitted: true,
    hasActiveAdvance: false,
    hasActiveFinal: false,
    hasActiveProforma: false,
    previousGross: 100_000,
    nextGross: 100_000,
    confirmStaleProforma: false
  }

  it('allows non-portal', () => {
    assert.deepEqual(
      portalOptiSaveInvoiceGate({ ...base, isPortalSubmitted: false }),
      { ok: true }
    )
  })

  it('blocks advance / final', () => {
    const adv = portalOptiSaveInvoiceGate({
      ...base,
      hasActiveAdvance: true
    })
    assert.equal(adv.ok, false)
    if (!adv.ok) assert.equal(adv.code, 'advance_or_final')

    const fin = portalOptiSaveInvoiceGate({
      ...base,
      hasActiveFinal: true
    })
    assert.equal(fin.ok, false)
    if (!fin.ok) assert.equal(fin.code, 'advance_or_final')
  })

  it('requires confirm on proforma drift', () => {
    const gate = portalOptiSaveInvoiceGate({
      ...base,
      hasActiveProforma: true,
      nextGross: 120_000
    })
    assert.equal(gate.ok, false)
    if (!gate.ok) assert.equal(gate.code, 'proforma_drift')
  })

  it('allows proforma drift after confirm', () => {
    assert.deepEqual(
      portalOptiSaveInvoiceGate({
        ...base,
        hasActiveProforma: true,
        nextGross: 120_000,
        confirmStaleProforma: true
      }),
      { ok: true }
    )
  })

  it('allows same gross with proforma without confirm', () => {
    assert.deepEqual(
      portalOptiSaveInvoiceGate({
        ...base,
        hasActiveProforma: true,
        nextGross: 100_000
      }),
      { ok: true }
    )
  })
})
