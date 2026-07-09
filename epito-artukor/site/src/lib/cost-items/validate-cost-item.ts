import type { Category, CostItem, CostItemInput, Unit } from "@/types"

type TradeRef = { id: string; code: string }

export function validateCostItemInput(
  input: CostItemInput,
  context: {
    existing: CostItem[]
    categories: Category[]
    units: Unit[]
    trades: TradeRef[]
    editingId?: string
  }
): { ok: true } | { ok: false; error: string } {
  const text = input.text?.trim()
  if (!text) {
    return { ok: false, error: "A tétel szövege kötelező." }
  }

  const trade = context.trades.find((t) => t.code === input.trade)
  if (!trade) {
    return { ok: false, error: "Érvénytelen szakág." }
  }

  const category = context.categories.find((c) => c.id === input.categoryId)
  if (!category) {
    return { ok: false, error: "Érvénytelen kategória." }
  }
  if (category.trade !== input.trade) {
    return { ok: false, error: "A kategória nem tartozik ehhez a szakághoz." }
  }

  const unit = context.units.find((u) => u.id === input.unitId)
  if (!unit) {
    return { ok: false, error: "Érvénytelen mértékegység." }
  }

  if (!input.isCustomItem) {
    const identifier = input.identifier?.trim()
    if (!identifier) {
      return { ok: false, error: "A tételszám megadása kötelező (nem K-tétel esetén)." }
    }
  }

  const duplicate = context.existing.find(
    (item) =>
      item.id !== context.editingId &&
      item.identifier.toLowerCase() === (input.identifier?.trim().toLowerCase() ?? "")
  )
  if (duplicate && !input.isCustomItem) {
    return { ok: false, error: "Már létezik tétel ezzel a tételszámmal." }
  }

  return { ok: true }
}
