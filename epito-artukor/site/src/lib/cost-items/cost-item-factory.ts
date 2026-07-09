import type { CostItem, CostItemInput } from "@/types"
import { calculateTotalUnitPrice, deriveShortLabel } from "@/lib/pricing"
import { resolveCustomIdentifier } from "@/lib/item-identifier"

/** CostItem összeállítása űrlap-inputból (kliens-oldali optimista létrehozás). */
export function createCostItemFromInput(
  input: CostItemInput,
  existing: CostItem[] = []
): CostItem {
  const timestamp = new Date().toISOString()
  const isNew = !input.id
  const pool = existing.filter((item) => item.id !== input.id)
  const { identifier, isCustomItem } = resolveCustomIdentifier(
    { identifier: input.identifier, isCustomItem: input.isCustomItem },
    pool,
    isNew
  )
  const totalUnitPrice = calculateTotalUnitPrice({
    materialUnitPrice: input.materialUnitPrice,
    laborUnitPrice: input.laborUnitPrice,
  })

  return {
    ...input,
    identifier,
    id: input.id ?? crypto.randomUUID(),
    orgId: existing[0]?.orgId ?? "",
    isCustomItem,
    shortLabel: input.shortLabel ?? deriveShortLabel(input.text),
    totalUnitPrice,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
