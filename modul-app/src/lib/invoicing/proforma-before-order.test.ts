/**
 * Run: npx tsx --test src/lib/invoicing/proforma-before-order.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canProformaBeforeOrder } from './issue-quote'
import { resolveQuoteInvoiceKindOptions } from './invoice-rules'
import type { InvoiceListItem } from './types'

describe('canProformaBeforeOrder', () => {
  it('allows proforma on draft without order', () => {
    assert.equal(
      canProformaBeforeOrder(
        { order_number: null, status: 'draft' },
        'proforma'
      ),
      true
    )
  })

  it('blocks advance/normal before order', () => {
    assert.equal(
      canProformaBeforeOrder({ order_number: null, status: 'draft' }, 'advance'),
      false
    )
    assert.equal(
      canProformaBeforeOrder({ order_number: null, status: 'draft' }, 'normal'),
      false
    )
  })

  it('blocks cancelled and already-ordered', () => {
    assert.equal(
      canProformaBeforeOrder(
        { order_number: null, status: 'cancelled' },
        'proforma'
      ),
      false
    )
    assert.equal(
      canProformaBeforeOrder(
        { order_number: 'O-1', status: 'ordered' },
        'proforma'
      ),
      false
    )
  })
})

describe('resolveQuoteInvoiceKindOptions without order', () => {
  it('only offers díjbekérő', () => {
    const res = resolveQuoteInvoiceKindOptions('unpaid', [], {
      hasOrderNumber: false
    })
    assert.deepEqual(res.options, [{ value: 'proforma', label: 'Díjbekérő' }])
    assert.equal(res.defaultKind, 'proforma')
  })

  it('offers nothing if proforma already exists on quote', () => {
    const invoices = [
      {
        id: '1',
        invoice_type: 'dijbekero',
        provider_invoice_number: 'D-1',
        is_storno_of_invoice_id: null
      }
    ] as InvoiceListItem[]
    const res = resolveQuoteInvoiceKindOptions('unpaid', invoices, {
      hasOrderNumber: false
    })
    assert.equal(res.options.length, 0)
  })
})
