import type { Unit } from "@/types"

/** In-memory cache — a DB (/api/units) az egyetlen forrás, a primer tölti fel. */
let unitsCache: Unit[] = []

export function setUnitsCache(units: Unit[]): void {
  unitsCache = units
}

export function loadUnits(): Unit[] {
  return unitsCache
}

/** unitId → Unit lookup (a régi mock unitMap kiváltása) */
export function getUnitMap(): Record<string, Unit> {
  return Object.fromEntries(unitsCache.map((u) => [u.id, u]))
}

/**
 * Élő lookup a cache fölött — a régi `unitMap[id]?.code` hívóhelyek
 * változtatás nélkül működnek, de mindig az aktuális DB-cache-t látják.
 */
export const unitMap: Record<string, Unit | undefined> = new Proxy(
  {},
  {
    get: (_target, key: string) => unitsCache.find((u) => u.id === key),
  }
) as Record<string, Unit | undefined>

export function getUnitCode(unitId: string): string {
  return unitsCache.find((u) => u.id === unitId)?.code ?? ""
}

