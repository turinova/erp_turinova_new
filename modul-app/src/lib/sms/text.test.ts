/**
 * Run: npx tsx --test src/lib/sms/text.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isGsm7SmsText,
  renderSmsTemplate,
  smsSegments
} from './text'

describe('renderSmsTemplate', () => {
  it('keeps Hungarian accents', () => {
    const out = renderSmsTemplate(
      'Kedves {customer_name}! A rendelése elkészült, átvehető.',
      { customer_name: 'Kovács József' }
    )
    assert.match(out, /elkészült/)
    assert.match(out, /átvehető/)
    assert.match(out, /Kovács József/)
  })
})

describe('smsSegments', () => {
  it('counts UCS-2 for accented text', () => {
    assert.equal(isGsm7SmsText('átvehető'), false)
    assert.equal(smsSegments('átvehető'), 1)
    const long = 'Á'.repeat(71)
    assert.equal(smsSegments(long), 2)
  })

  it('counts GSM-7 for plain ASCII', () => {
    assert.equal(isGsm7SmsText('Hello 123'), true)
    assert.equal(smsSegments('x'.repeat(160)), 1)
    assert.equal(smsSegments('x'.repeat(161)), 2)
  })
})
