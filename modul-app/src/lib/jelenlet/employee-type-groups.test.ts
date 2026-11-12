/**
 * Run: npx tsx --test src/lib/jelenlet/employee-type-groups.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  groupEmployeesByType,
  sortEmployeesByTypeThenName
} from './employee-type-groups'

function emp(
  id: string,
  name: string,
  typeId: string,
  typeName: string,
  sortOrder: number
) {
  return {
    id,
    name,
    employeeTypeId: typeId,
    employeeTypeName: typeName,
    employeeTypeSortOrder: sortOrder
  }
}

describe('sortEmployeesByTypeThenName', () => {
  it('típus sort_order, majd név', () => {
    const rows = [
      emp('1', 'Béla', 't2', 'Műhely', 20),
      emp('2', 'Anna', 't1', 'Bolt', 10),
      emp('3', 'Cecil', 't1', 'Bolt', 10),
      emp('4', 'Dani', '', '—', 9999)
    ]
    const sorted = sortEmployeesByTypeThenName(rows)
    assert.deepEqual(
      sorted.map((r) => r.id),
      ['2', '3', '1', '4']
    )
  })
})

describe('groupEmployeesByType', () => {
  it('csoportok számlálóval', () => {
    const sorted = sortEmployeesByTypeThenName([
      emp('1', 'Béla', 't2', 'Műhely', 20),
      emp('2', 'Anna', 't1', 'Bolt', 10),
      emp('3', 'Cecil', 't1', 'Bolt', 10)
    ])
    const groups = groupEmployeesByType(sorted)
    assert.equal(groups.length, 2)
    assert.equal(groups[0]!.typeName, 'Bolt')
    assert.equal(groups[0]!.employees.length, 2)
    assert.equal(groups[1]!.typeName, 'Műhely')
  })

  it('hiányzó típus címke', () => {
    const groups = groupEmployeesByType([
      emp('1', 'X', '', '—', 9999)
    ])
    assert.equal(groups[0]!.typeName, 'Nincs típus')
  })
})
