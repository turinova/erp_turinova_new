/** Pure: jelenlét naptár dolgozó sorrend / típus csoportok. */

export type EmployeeTypeSortable = {
  id: string
  name: string
  employeeTypeId: string
  employeeTypeName: string
  employeeTypeSortOrder: number
}

export type EmployeeTypeGroup<T extends EmployeeTypeSortable> = {
  typeId: string
  typeName: string
  sortOrder: number
  employees: T[]
}

const MISSING_TYPE_SORT = 9999
const MISSING_TYPE_LABEL = 'Nincs típus'

export function normalizeEmployeeTypeSortOrder(raw: unknown): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : MISSING_TYPE_SORT
}

/** Típus sort_order → típusnév → dolgozónév (hu). */
export function sortEmployeesByTypeThenName<T extends EmployeeTypeSortable>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    const so = a.employeeTypeSortOrder - b.employeeTypeSortOrder
    if (so !== 0) return so
    const tn = a.employeeTypeName.localeCompare(b.employeeTypeName, 'hu')
    if (tn !== 0) return tn
    return a.name.localeCompare(b.name, 'hu')
  })
}

/** Egymás utáni azonos típusú sorokból csoportok (előtte rendezd). */
export function groupEmployeesByType<T extends EmployeeTypeSortable>(
  sorted: T[]
): EmployeeTypeGroup<T>[] {
  const groups: EmployeeTypeGroup<T>[] = []
  for (const emp of sorted) {
    const typeId = emp.employeeTypeId || '__none__'
    const typeName =
      emp.employeeTypeId && emp.employeeTypeName && emp.employeeTypeName !== '—'
        ? emp.employeeTypeName
        : MISSING_TYPE_LABEL
    const last = groups[groups.length - 1]
    if (last && last.typeId === typeId) {
      last.employees.push(emp)
    } else {
      groups.push({
        typeId,
        typeName,
        sortOrder: emp.employeeTypeSortOrder,
        employees: [emp]
      })
    }
  }
  return groups
}
