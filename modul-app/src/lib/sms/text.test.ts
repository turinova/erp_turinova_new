/**
 * Run: npx tsx --test src/lib/sms/text.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { renderSmsTemplate, smsSegments, toAsciiSmsText } from './text'

describe('renderSmsTemplate', () => {
  it('keeps Hungarian accents folded to ASCII', () => {
    const out = renderSmsTemplate(
      'Kedves {customer_name}! A rendelése elkészült, átvehető.',
      { customer_name: 'Kovács József' }
    )
    assert.match(out, /elkeszult/)
    assert.match(out, /atveheto/)
    assert.match(out, /Kovacs Jozsef/)
  })
})

describe('toAsciiSmsText', () => {
  it('folds Hungarian accents', () => {
    assert.equal(toAsciiSmsText('átvehető'), 'atveheto')
  })
})

describe('smsSegments', () => {
  it('counts segments by length', () => {
    assert.equal(smsSegments('atveheto'), 1)
    assert.equal(smsSegments('x'.repeat(160)), 1)
    assert.equal(smsSegments('x'.repeat(161)), 2)
    const long = 'A'.repeat(71)
    assert.equal(smsSegments(long), 1)
  })
})
