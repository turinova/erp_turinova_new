/**
 * Run: npx tsx --test src/lib/quotes/cancel.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canCancelQuote,
  needsStrongCancelConfirm,
  validateCancelNote
} from './cancel'

describe('canCancelQuote', () => {
  it('allows ordered without final invoice', () => {
    assert.deepEqual(
      canCancelQuote({
        status: 'ordered',
        orderNumber: 'M-1',
        hasActiveFinalInvoice: false
      }),
      { ok: true }
    )
  })

  it('blocks draft / finished / cancelled / final invoice', () => {
    assert.equal(
      canCancelQuote({
        status: 'draft',
        orderNumber: null,
        hasActiveFinalInvoice: false
      }).ok,
      false
    )
    assert.equal(
      canCancelQuote({
        status: 'finished',
        orderNumber: 'M-1',
        hasActiveFinalInvoice: false
      }).ok,
      false
    )
    assert.equal(
      canCancelQuote({
        status: 'cancelled',
        orderNumber: 'M-1',
        hasActiveFinalInvoice: false
      }).ok,
      false
    )
    assert.equal(
      canCancelQuote({
        status: 'ready',
        orderNumber: 'M-1',
        hasActiveFinalInvoice: true
      }).ok,
      false
    )
  })
})

describe('needsStrongCancelConfirm', () => {
  it('requires typed order number in production or ready', () => {
    assert.equal(needsStrongCancelConfirm('ordered'), false)
    assert.equal(needsStrongCancelConfirm('in_production'), true)
    assert.equal(needsStrongCancelConfirm('ready'), true)
  })
})

describe('validateCancelNote', () => {
  it('requires note for other', () => {
    assert.ok(validateCancelNote('other', 'ab'))
    assert.equal(validateCancelNote('other', 'ügyfél kérése'), null)
    assert.equal(validateCancelNote('customer', ''), null)
  })
})
