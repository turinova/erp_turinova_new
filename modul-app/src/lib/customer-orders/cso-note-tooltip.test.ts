/**
 * Ügyfélrendelés megjegyzés tooltip — várólista.
 * Run: npx tsx --test src/lib/customer-orders/cso-note-tooltip.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatCsoNoteTooltip, hasCsoWaitingNote } from './types'

describe('hasCsoWaitingNote / formatCsoNoteTooltip', () => {
  it('empty / whitespace → false / null', () => {
    assert.equal(hasCsoWaitingNote({ orderNote: '  ', note: null }), false)
    assert.equal(formatCsoNoteTooltip({ orderNote: ' ', itemNote: '' }), null)
  })

  it('item only', () => {
    assert.equal(hasCsoWaitingNote({ note: 'antracit' }), true)
    assert.equal(
      formatCsoNoteTooltip({ itemNote: 'antracit' }),
      'antracit'
    )
  })

  it('order only', () => {
    assert.equal(
      formatCsoNoteTooltip({ orderNote: 'csak délután' }),
      'Rendelés: csak délután'
    )
  })

  it('both → two lines', () => {
    assert.equal(
      formatCsoNoteTooltip({
        orderNote: 'hívni',
        itemNote: 'szín: kék'
      }),
      'Rendelés: hívni\nTétel: szín: kék'
    )
  })

  it('long text truncates with hint', () => {
    const long = 'x'.repeat(400)
    const tip = formatCsoNoteTooltip({ orderNote: long, maxLen: 100 })
    assert.ok(tip)
    assert.ok(tip!.length <= 100)
    assert.match(tip!, /teljes a rendelésen/)
  })
})
