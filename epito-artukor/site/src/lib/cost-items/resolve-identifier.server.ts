import type { Category, CostItem, CostItemInput } from "@/types"
import { deriveShortLabel } from "@/lib/pricing"
import {
  generateNextCustomIdentifier,
  isCustomItemFromIdentifier,
  isLegacyPlainCustomIdentifier,
  resolveCustomIdentifier,
} from "@/lib/item-identifier"
import { buildCategoryMap } from "@/lib/categories/category-tree"

export function resolveCostItemFields(
  input: CostItemInput,
  existing: CostItem[],
  categories: Category[],
  isNew: boolean
): { identifier: string; isCustomItem: boolean; shortLabel: string | null } {
  const categoryMap = buildCategoryMap(categories)
  const pool = existing.filter((item) => item.id !== input.id)
  const { identifier, isCustomItem } = resolveCustomIdentifier(
    {
      identifier: input.identifier,
      isCustomItem: input.isCustomItem,
      categoryId: input.categoryId,
    },
    pool,
    isNew,
    categoryMap
  )

  const shortLabel = input.shortLabel?.trim()
    ? input.shortLabel.trim()
    : deriveShortLabel(input.text)

  return { identifier, isCustomItem, shortLabel }
}

export function resolveDuplicateIdentifier(
  source: CostItem,
  existing: CostItem[],
  categories: Category[]
): string {
  const categoryMap = buildCategoryMap(categories)
  if (source.isCustomItem) {
    return generateNextCustomIdentifier(existing, source.categoryId, categoryMap)
  }
  const base = `${source.identifier}-M`
  let candidate = base
  let n = 2
  while (existing.some((i) => i.identifier.toLowerCase() === candidate.toLowerCase())) {
    candidate = `${base}${n}`
    n += 1
  }
  return candidate
}

export function normalizeIncomingIdentifier(input: CostItemInput): CostItemInput {
  if (input.isCustomItem === false) return input
  if (input.identifier && !isLegacyPlainCustomIdentifier(input.identifier)) return input
  return { ...input, isCustomItem: true }
}

export function isCustomFromInput(input: CostItemInput): boolean {
  if (input.isCustomItem != null) return input.isCustomItem
  if (input.identifier) return isCustomItemFromIdentifier(input.identifier)
  return true
}
