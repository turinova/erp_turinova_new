import type { CostItem, CostItemInput, CostItemStatus, Trade } from "@/types"
import { calculateTotalUnitPrice } from "@/lib/pricing"

export type CostItemRow = {
  id: string
  organization_id: string
  trade_id: string
  category_id: string
  unit_id: string
  identifier: string
  is_custom_item: boolean
  text: string
  short_label: string | null
  status: CostItemStatus
  tags: string[]
  material_unit_price: number
  labor_unit_price: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export const COST_ITEM_SELECT =
  "id, organization_id, trade_id, category_id, unit_id, identifier, is_custom_item, text, short_label, status, tags, material_unit_price, labor_unit_price, created_at, updated_at, deleted_at"

export function mapCostItemRow(row: CostItemRow, tradeCode: Trade): CostItem {
  const materialUnitPrice = row.material_unit_price
  const laborUnitPrice = row.labor_unit_price

  return {
    id: row.id,
    orgId: row.organization_id,
    trade: tradeCode,
    identifier: row.identifier,
    isCustomItem: row.is_custom_item,
    text: row.text,
    shortLabel: row.short_label,
    categoryId: row.category_id,
    unitId: row.unit_id,
    status: row.status,
    tags: row.tags ?? [],
    materialUnitPrice,
    laborUnitPrice,
    totalUnitPrice: calculateTotalUnitPrice({ materialUnitPrice, laborUnitPrice }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type CostItemWriteInput = CostItemInput & {
  tradeId?: string
}

export function costItemInputToInsertRow(
  organizationId: string,
  tradeId: string,
  input: CostItemWriteInput,
  resolved: { identifier: string; isCustomItem: boolean; shortLabel: string | null }
) {
  return {
    organization_id: organizationId,
    trade_id: tradeId,
    category_id: input.categoryId,
    unit_id: input.unitId,
    identifier: resolved.identifier,
    is_custom_item: resolved.isCustomItem,
    text: input.text.trim(),
    short_label: resolved.shortLabel,
    status: input.status,
    tags: input.tags ?? [],
    material_unit_price: Math.round(input.materialUnitPrice),
    labor_unit_price: Math.round(input.laborUnitPrice),
  }
}

export function costItemInputToUpdateRow(
  tradeId: string,
  input: CostItemWriteInput,
  resolved: { identifier: string; isCustomItem: boolean; shortLabel: string | null }
) {
  return {
    trade_id: tradeId,
    category_id: input.categoryId,
    unit_id: input.unitId,
    identifier: resolved.identifier,
    is_custom_item: resolved.isCustomItem,
    text: input.text.trim(),
    short_label: resolved.shortLabel,
    status: input.status,
    tags: input.tags ?? [],
    material_unit_price: Math.round(input.materialUnitPrice),
    labor_unit_price: Math.round(input.laborUnitPrice),
  }
}
