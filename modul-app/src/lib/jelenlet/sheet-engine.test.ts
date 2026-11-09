/**
 * Run: npx tsx --test src/lib/jelenlet/sheet-engine.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  computeRotation,
  computeSheet,
  monthDates,
  paidMinutesWithGrace,
  type SheetAttendance,
  type SheetEmployee,
  type SheetInput
} from './sheet-engine'
import {
  INTERNAL_SHEET_RULES,
  OFFICIAL_SHEET_RULES,
  type SheetRules
} from './sheet-rules'
import type { AbsenceType } from './types'

const EMP: SheetEmployee = {
  id: 'e1',
  name: 'Teszt Elek',
  code: 'T1',
  typeId: 't1',
  typeName: 'Műhely',
  shiftStart: '07:30',
  shiftEnd: '17:00',
  lunchStart: '12:00',
  lunchEnd: '12:30',
  overtime: {
    enabled: true,
    graceMinutes: 10,
    roundingMinutes: 15,
    roundingMode: 'floor',
    dailyCapMinutes: 120
  },
  earlyOvertime: {
    enabled: false,
    triggerTime: null,
    payUntilTime: null,
    maxMinutes: 30,
    graceMinutes: 0,
    roundingMinutes: 15,
    roundingMode: 'floor',
    dailyCapMinutes: 120
  }
}

function att(arrival: string | null, departure: string | null): SheetAttendance {
  return { arrival, departure, lunchStart: null, lunchEnd: null }
}

function input(
  year: number,
  month: number,
  rules: SheetRules,
  days: Record<string, SheetAttendance>,
  absences: Record<string, AbsenceType> = {}
): SheetInput {
  return {
    employee: EMP,
    year,
    month,
    attendance: new Map(Object.entries(days)),
    absences: new Map(Object.entries(absences)),
    calendar: new Map(),
    rotation: new Map(),
    rules
  }
}

function row(res: ReturnType<typeof computeSheet>, ymd: string) {
  const r = res.rows.find((x) => x.date === ymd)
  assert.ok(r, ymd)
  return r
}

describe('paidMinutesWithGrace', () => {
  it('±10 perc a műszak széleihez igazít, ebéd átfedés levonva', () => {
    assert.equal(
      paidMinutesWithGrace({
        arrival: '07:35',
        departure: '16:55',
        lunchStart: '12:00',
        lunchEnd: '12:30',
        shiftStart: '07:30',
        shiftEnd: '17:00',
        graceMinutes: 10
      }),
      540
    )
  })
})

describe('belső (papír) sablon', () => {
  it('9 órás műszak: 8 óra + 1 óra, plusz műszak utáni túlóra', () => {
    const res = computeSheet(
      input(2026, 9, INTERNAL_SHEET_RULES, { '2026-09-14': att('07:24', '17:40') })
    )
    const r = row(res, '2026-09-14')
    assert.equal(r.normalMinutes, 480)
    assert.equal(r.plusMinutes, 90)
    assert.equal(r.hoursText, '8.00 óra + 1.50 óra')
    assert.equal(res.summary.totalMinutes, 480)
    assert.equal(res.summary.overtimeMinutes, 90)
  })

  it('szabadság + munka = szabadság (0 óra), a munka csak megjegyzés', () => {
    const res = computeSheet(
      input(
        2026,
        9,
        INTERNAL_SHEET_RULES,
        { '2026-09-15': att('07:30', '16:00') },
        { '2026-09-15': 'vacation' }
      )
    )
    const r = row(res, '2026-09-15')
    assert.equal(r.status, 'SZABADSÁG')
    assert.equal(r.normalMinutes, 0)
    assert.match(r.note ?? '', /bent volt/)
    assert.equal(res.summary.daysWorked, 0)
    assert.equal(res.summary.absentDays, 1)
    assert.equal(res.summary.leaveWorkDays, 1)
  })

  it('szombat látszik, de az összesbe nem számít', () => {
    const res = computeSheet(
      input(2026, 9, INTERNAL_SHEET_RULES, { '2026-09-12': att('07:30', '11:30') })
    )
    const r = row(res, '2026-09-12')
    assert.equal(r.status, 'SZOMBATI MUNKA')
    assert.equal(res.summary.totalMinutes, 0)
    assert.equal(res.summary.saturdayDays, 1)
  })

  it('hiányos nap HIÁNYOS felirattal, óra nélkül', () => {
    const res = computeSheet(
      input(2026, 9, INTERNAL_SHEET_RULES, { '2026-09-16': att('07:30', null) })
    )
    assert.equal(row(res, '2026-09-16').status, 'HIÁNYOS')
    assert.equal(res.summary.incompleteDays, 1)
  })
})

describe('hivatalos sablon', () => {
  it('generált 8 órás nap ebéddel', () => {
    const res = computeSheet(
      input(2026, 9, OFFICIAL_SHEET_RULES, { '2026-09-15': att('07:20', '17:45') })
    )
    const r = row(res, '2026-09-15')
    // 15. nap → idx 14 páros → nyitó kezdés
    assert.equal(r.arrival, '08:00')
    assert.equal(r.departure, '16:30')
    assert.equal(r.lunchStart, '12:00')
    assert.equal(r.normalMinutes, 480)
  })

  it('szombat (Ádám L. 09-12) levonva hétfőből, összesen pontosan 8 óra', () => {
    const res = computeSheet(
      input(2026, 9, OFFICIAL_SHEET_RULES, {
        '2026-09-12': att('07:48', '12:01'),
        '2026-09-14': att('07:30', '17:00')
      })
    )
    const sat = row(res, '2026-09-12')
    const mon = row(res, '2026-09-14')
    assert.equal(sat.arrival, '08:00')
    assert.equal(sat.departure, '12:00')
    assert.equal(mon.normalMinutes, 240)
    assert.equal(mon.departure, '17:00')
    assert.equal(mon.arrival, '13:00')
    assert.equal(mon.lunchStart, null)
    assert.equal(res.summary.totalMinutes, 240)
    assert.equal(res.summary.saturdayMinutes, 240)
  })

  it('rövid szombat: ebéd marad, a hétfő pontosan 8 − szombat', () => {
    const res = computeSheet(
      input(2026, 9, OFFICIAL_SHEET_RULES, {
        '2026-09-12': att('08:00', '09:30'),
        '2026-09-14': att('07:30', '17:00')
      })
    )
    const mon = row(res, '2026-09-14')
    assert.equal(mon.normalMinutes, 390)
    assert.equal(mon.lunchStart, '12:00')
  })

  it('előző havi utolsó szombat levonása átjön (május 30 → június 1)', () => {
    const res = computeSheet(
      input(2026, 6, OFFICIAL_SHEET_RULES, {
        '2026-05-30': att('08:00', '10:00'),
        '2026-06-01': att('07:30', '17:00')
      })
    )
    assert.equal(row(res, '2026-06-01').normalMinutes, 360)
  })

  it('fordított idő: nincs generált nap, figyelmeztetés', () => {
    const res = computeSheet(
      input(2026, 9, OFFICIAL_SHEET_RULES, { '2026-09-15': att('10:58', '10:58') })
    )
    assert.equal(row(res, '2026-09-15').normalMinutes, 0)
    assert.ok(res.warnings.some((w) => w.date === '2026-09-15'))
  })

  it('szabadság felülír: 0 óra, nincs idő', () => {
    const res = computeSheet(
      input(
        2026,
        9,
        OFFICIAL_SHEET_RULES,
        { '2026-09-15': att('07:30', '16:00') },
        { '2026-09-15': 'sick' }
      )
    )
    const r = row(res, '2026-09-15')
    assert.equal(r.status, 'BETEGSZABADSÁG')
    assert.equal(r.arrival, null)
  })
})

describe('computeRotation', () => {
  it('nyitó / záró a pool sorrendjében, pihenőnap kimarad', () => {
    const dates = monthDates(2026, 9)
    const rot = computeRotation(dates, ['a', 'b', 'c'], (ymd) => ymd !== '2026-09-01')
    assert.equal(rot.has('2026-09-01'), false)
    assert.deepEqual(rot.get('2026-09-02'), { openId: 'b', closeId: 'c' })
  })
})
