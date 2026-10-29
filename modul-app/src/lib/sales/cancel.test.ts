/**
 * Run: npx tsx --test src/lib/sales/cancel.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canArchiveSale, canUnarchiveSale } from './archive'
import { canCancelSale, validateSaleCancelNote } from './cancel'

describe('canCancelSale', () => {
  it('allows confirmed without final invoice', () => {
    assert.deepEqual(
      canCancelSale({
        status: 'confirmed',
        hasActiveFinalInvoice: false
      }),
      { ok: true }
    )
  })

  it('blocks fulfilled / archived / final invoice', () => {
    assert.equal(
      canCancelSale({
        status: 'fulfilled',
        hasActiveFinalInvoice: false
      }).ok,
      false
    )
    assert.equal(
      canCancelSale({
        status: 'confirmed',
        archivedAt: '2026-01-01',
        hasActiveFinalInvoice: false
      }).ok,
      false
    )
    assert.equal(
      canCancelSale({
        status: 'confirmed',
        hasActiveFinalInvoice: true
      }).ok,
      false
    )
  })
})

describe('canArchiveSale', () => {
  it('archives fulfilled and cancelled', () => {
    assert.equal(
      canArchiveSale({ status: 'fulfilled' }).ok,
      true
    )
    assert.equal(
      canArchiveSale({ status: 'cancelled' }).ok,
      true
    )
    assert.equal(
      canArchiveSale({ status: 'confirmed' }).ok,
      false
    )
  })

  it('unarchive requires archived_at', () => {
    assert.equal(canUnarchiveSale({ archivedAt: null }).ok, false)
    assert.equal(
      canUnarchiveSale({ archivedAt: '2026-01-01' }).ok,
      true
    )
  })
})

describe('validateSaleCancelNote', () => {
  it('requires note for other', () => {
    assert.ok(validateSaleCancelNote('other', 'ab'))
    assert.equal(validateSaleCancelNote('other', 'teszt adat'), null)
    assert.equal(validateSaleCancelNote('test', ''), null)
  })
})
