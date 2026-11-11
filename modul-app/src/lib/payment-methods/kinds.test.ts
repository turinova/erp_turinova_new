/**
 * Run: npx tsx --test src/lib/payment-methods/kinds.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isTransferPaymentMethod,
  resolvePaymentMethodKind
} from '@/lib/payment-methods/kinds'

describe('resolvePaymentMethodKind', () => {
  it('a kind mező elsőbbséget élvez', () => {
    assert.equal(
      resolvePaymentMethodKind({ kind: 'transfer', name: 'Készpénz' }),
      'transfer'
    )
  })

  it('névből felismeri a fajtát (régi sor / snapshot)', () => {
    assert.equal(resolvePaymentMethodKind({ name: 'Átutalás' }), 'transfer')
    assert.equal(resolvePaymentMethodKind({ name: 'Utalás' }), 'transfer')
    assert.equal(resolvePaymentMethodKind({ name: 'Készpénz' }), 'cash')
    assert.equal(resolvePaymentMethodKind({ name: 'Bankkártya' }), 'card')
    assert.equal(resolvePaymentMethodKind({ name: 'SZÉP kártya' }), 'szep_card')
    assert.equal(resolvePaymentMethodKind({ name: 'Utánvét' }), 'cod')
  })
})

describe('isTransferPaymentMethod', () => {
  it('átutalás true', () => {
    assert.equal(isTransferPaymentMethod({ kind: 'transfer' }), true)
    assert.equal(isTransferPaymentMethod({ name: 'Átutalás' }), true)
    assert.equal(isTransferPaymentMethod({ kind: 'cash' }), false)
  })
})
