/**
 * Run: npx tsx --test src/lib/opening-hours.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  draftToOpeningHours,
  groupWeek,
  normalizeOpeningHours,
  openStatus,
  openingHoursToDraft
} from './opening-hours'

const WEEKDAYS = { from: '07:00', to: '16:00' }
const hours = normalizeOpeningHours({
  mon: [WEEKDAYS],
  tue: [WEEKDAYS],
  wed: [WEEKDAYS],
  thu: [WEEKDAYS],
  fri: [WEEKDAYS],
  sat: [{ from: '08:00', to: '12:00' }],
  sun: []
})!

/** 2026-11-05 csütörtök; CET = UTC+1. */
const at = (iso: string) => new Date(iso)

describe('normalizeOpeningHours', () => {
  it('null / üres / minden nap zárva → null', () => {
    assert.equal(normalizeOpeningHours(null), null)
    assert.equal(normalizeOpeningHours([]), null)
    assert.equal(normalizeOpeningHours({ mon: [] }), null)
  })

  it('érvénytelen sávok kiesnek, rendez', () => {
    const h = normalizeOpeningHours({
      mon: [
        { from: '13:00', to: '16:00' },
        { from: '25:00', to: '26:00' },
        { from: '10:00', to: '09:00' },
        { from: '07:00', to: '12:00' }
      ]
    })!
    assert.deepEqual(h.mon, [
      { from: '07:00', to: '12:00' },
      { from: '13:00', to: '16:00' }
    ])
  })
})

describe('openStatus', () => {
  it('nyitva → zárás ideje', () => {
    const s = openStatus(hours, at('2026-11-05T09:00:00+01:00'))
    assert.equal(s.open, true)
    assert.equal(s.label, 'Most nyitva · 16:00-ig')
    assert.equal(s.today, 'thu')
  })

  it('nyitás előtt → ma nyit', () => {
    const s = openStatus(hours, at('2026-11-05T06:30:00+01:00'))
    assert.equal(s.label, 'Zárva · ma 7:00-kor nyit')
  })

  it('zárás után → holnap', () => {
    const s = openStatus(hours, at('2026-11-05T16:00:00+01:00'))
    assert.equal(s.open, false)
    assert.equal(s.label, 'Zárva · holnap 7:00-kor nyit')
  })

  it('szombat délután → hétfőn', () => {
    const s = openStatus(hours, at('2026-11-07T13:00:00+01:00'))
    assert.equal(s.label, 'Zárva · hétfőn 7:00-kor nyit')
  })

  it('péntek este → holnap (szombat 8:00)', () => {
    const s = openStatus(hours, at('2026-11-06T18:00:00+01:00'))
    assert.equal(s.label, 'Zárva · holnap 8:00-kor nyit')
  })

  it('ebédszünet', () => {
    const lunch = normalizeOpeningHours({
      thu: [
        { from: '07:00', to: '12:00' },
        { from: '13:00', to: '16:00' }
      ]
    })!
    const s = openStatus(lunch, at('2026-11-05T12:30:00+01:00'))
    assert.equal(s.label, 'Zárva · ma 13:00-kor nyit')
  })
})

describe('groupWeek', () => {
  it('összevonja az azonos egymást követő napokat', () => {
    assert.deepEqual(
      groupWeek(hours).map((r) => [r.label, r.text]),
      [
        ['Hétfő–Péntek', '7:00–16:00'],
        ['Szombat', '8:00–12:00'],
        ['Vasárnap', 'Zárva']
      ]
    )
  })
})

describe('draft', () => {
  it('oda-vissza', () => {
    const result = draftToOpeningHours(openingHoursToDraft(hours))
    assert.ok(result.ok)
    assert.deepEqual(result.value, hours)
  })

  it('minden zárva → null', () => {
    const result = draftToOpeningHours(openingHoursToDraft(null))
    assert.deepEqual(result, { ok: true, value: null })
  })

  it('hibás idő → nap szintű hiba', () => {
    const draft = openingHoursToDraft(null)
    draft.mon = { closed: false, from: '16:00', to: '07:00' }
    const result = draftToOpeningHours(draft)
    assert.equal(result.ok, false)
    if (!result.ok) assert.ok(result.errors.mon)
  })
})
