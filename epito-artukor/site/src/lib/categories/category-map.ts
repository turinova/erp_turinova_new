import type { Category, Trade } from "@/types"

export type CategoryRow = {
  id: string
  organization_id: string
  parent_id: string | null
  trade: Trade
  code: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export const CATEGORY_SELECT =
  "id, organization_id, parent_id, trade, code, name, sort_order, created_at, updated_at, deleted_at"

export function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    orgId: row.organization_id,
    parentId: row.parent_id,
    trade: row.trade,
    code: row.code,
    name: row.name,
    sortOrder: row.sort_order,
  }
}

export function normalizeCategoryCode(code: string): string {
  return code.trim().toUpperCase()
}

export function normalizeCategoryName(name: string): string {
  return name.trim()
}

export type CategoryWriteInput = {
  trade: Trade
  code: string
  name: string
  parentId: string | null
  sortOrder?: number
}

export function categoryInputToInsertRow(
  organizationId: string,
  input: CategoryWriteInput
) {
  return {
    organization_id: organizationId,
    parent_id: input.parentId,
    trade: input.trade,
    code: normalizeCategoryCode(input.code),
    name: normalizeCategoryName(input.name),
    sort_order: input.sortOrder ?? 0,
  }
}

export function categoryInputToUpdateRow(input: CategoryWriteInput) {
  return {
    parent_id: input.parentId,
    trade: input.trade,
    code: normalizeCategoryCode(input.code),
    name: normalizeCategoryName(input.name),
    sort_order: input.sortOrder ?? 0,
  }
}
