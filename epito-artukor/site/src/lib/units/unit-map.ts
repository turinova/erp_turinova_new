import type { Unit } from "@/types"

export type UnitRow = {
  id: string
  organization_id: string
  code: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function mapUnitRow(row: UnitRow): Unit {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
  }
}

export function normalizeUnitCode(code: string): string {
  return code.trim()
}

export function normalizeUnitName(name: string): string {
  return name.trim()
}
