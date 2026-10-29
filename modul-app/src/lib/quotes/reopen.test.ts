/**
 * Run: npx tsx --test src/lib/quotes/reopen.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canArchiveQuote,
  canReopenFinishedQuote,
  canUnarchiveQuote,
  orderNumbersMatch,
  validateReopenNote
} from './reopen'

describe('canReopenFinishedQuote', () => {
  it('allows finished without final invoice', () => {
    assert.deepEqual(
      canReopenFinishedQuote({
        status: 'finished',
        orderNumber: 'M-1',
        hasActiveFinalInvoice: false
      }),
      { ok: true }
    )
  })

  it('blocks ready / archived / final invoice', () => {
    assert.equal(
      canReopenFinishedQuote({
        status: 'ready',
        orderNumber: 'M-1',
        hasActiveFinalInvoice: false
      }).ok,
      false
    )
    assert.equal(
      canReopenFinishedQuote({
        status: 'finished',
        orderNumber: 'M-1',
        archivedAt: '2026-01-01',
        hasActiveFinalInvoice: false
      }).ok,
      false
    )
    assert.equal(
      canReopenFinishedQuote({
        status: 'finished',
        orderNumber: 'M-1',
        hasActiveFinalInvoice: true
      }).ok,
      false
    )
  })
})

describe('canArchiveQuote / canUnarchiveQuote', () => {
  it('archives finished and cancelled only', () => {
    assert.equal(
      canArchiveQuote({
        status: 'finished',
        orderNumber: 'M-1'
      }).ok,
      true
    )
    assert.equal(
      canArchiveQuote({
        status: 'cancelled',
        orderNumber: 'M-1'
      }).ok,
      true
    )
    assert.equal(
      canArchiveQuote({
        status: 'ready',
        orderNumber: 'M-1'
      }).ok,
      false
    )
  })

  it('unarchive requires archived_at', () => {
    assert.equal(canUnarchiveQuote({ archivedAt: null }).ok, false)
    assert.equal(
      canUnarchiveQuote({ archivedAt: '2026-01-01' }).ok,
      true
    )
  })
})

describe('orderNumbersMatch', () => {
  it('trims and ignores case', () => {
    assert.equal(orderNumbersMatch(' m-1 ', 'M-1'), true)
    assert.equal(orderNumbersMatch('X', 'M-1'), false)
  })
})

describe('validateReopenNote', () => {
  it('requires note for other', () => {
    assert.ok(validateReopenNote('other', 'ab'))
    assert.equal(validateReopenNote('other', 'téves átadás'), null)
    assert.equal(validateReopenNote('accidental', ''), null)
  })
})
