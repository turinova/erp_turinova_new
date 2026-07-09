import type { Category, Trade } from "@/types"
import {
  isDescendantOf,
} from "@/lib/categories/category-tree"
import type { CategoryWriteInput } from "@/lib/categories/category-map"
import {
  normalizeCategoryCode,
  normalizeCategoryName,
} from "@/lib/categories/category-map"

export type CategoryValidationResult =
  | { ok: true }
  | { ok: false; error: string }

import { TRADE_CODES } from "@/lib/trades/constants"

export function validateCategoryInput(
  input: CategoryWriteInput,
  categories: Category[],
  editingId?: string,
  validTradeCodes?: string[]
): CategoryValidationResult {
  const code = normalizeCategoryCode(input.code)
  const name = normalizeCategoryName(input.name)
  const allowed = validTradeCodes ?? [...TRADE_CODES]

  if (!input.trade?.trim() || !allowed.includes(input.trade)) {
    return { ok: false, error: "Érvénytelen szakág." }
  }
  if (!code) {
    return { ok: false, error: "Add meg a kategória kódját." }
  }
  if (!name) {
    return { ok: false, error: "Add meg a kategória nevét." }
  }

  const duplicateCode = categories.find(
    (c) => c.id !== editingId && c.code.toLowerCase() === code.toLowerCase()
  )
  if (duplicateCode) {
    return { ok: false, error: "Már létezik kategória ezzel a kóddal." }
  }

  if (input.parentId) {
    if (editingId && input.parentId === editingId) {
      return { ok: false, error: "A kategória nem lehet a saját szülője." }
    }

    const parent = categories.find((c) => c.id === input.parentId)
    if (!parent) {
      return { ok: false, error: "A szülő kategória nem található." }
    }
    if (parent.trade !== input.trade) {
      return { ok: false, error: "A szülő kategória ugyanahhoz a szakághoz kell tartozzon." }
    }
    if (editingId && isDescendantOf(input.parentId, editingId, categories)) {
      return { ok: false, error: "A szülő nem lehet alfajta a szerkesztett kategóriának." }
    }
  }

  return { ok: true }
}
