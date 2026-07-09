import type { ClassifiedPasteItem } from "@/lib/cost-items/classify-cost-item.server"
import { buildCategoryMap, getDefaultCategoryForTrade } from "@/lib/categories/category-tree"
import { generateNextCustomIdentifier } from "@/lib/item-identifier"
import type { Category, CostItem, Unit } from "@/types"
import type { TradeRecord } from "@/types/trade"
import type { CostItemImportRow } from "@/lib/cost-items/cost-items-xlsx"

export type PastePreviewRow = {
  rowNumber: number
  rawInput: string
  text: string
  materialUnitPrice: number
  laborUnitPrice: number
  tradeId: string | null
  categoryId: string | null
  unitId: string | null
  confidence: number
  aiUsed: boolean
  source: ClassifiedPasteItem["source"]
  included: boolean
  errors: string[]
  warnings: string[]
}

export type IdentifierPoolItem = Pick<CostItem, "identifier" | "categoryId">

/** Előnézeti K-tétel számok — a meglévő katalógus + import sorok sorrendje alapján */
export function computePreviewIdentifiers(
  rows: PastePreviewRow[],
  categories: Category[],
  existingPool: IdentifierPoolItem[]
): Map<number, string> {
  const map = new Map<number, string>()
  const categoryMap = buildCategoryMap(categories)
  const pool: CostItem[] = existingPool.map((item, idx) => ({
    id: `existing-${idx}`,
    orgId: "",
    trade: "",
    identifier: item.identifier,
    isCustomItem: true,
    text: "",
    shortLabel: null,
    categoryId: item.categoryId,
    unitId: "",
    status: "active",
    tags: [],
    materialUnitPrice: 0,
    laborUnitPrice: 0,
    totalUnitPrice: 0,
    createdAt: "",
    updatedAt: "",
  }))

  for (const row of rows) {
    if (!row.categoryId) {
      map.set(row.rowNumber, "—")
      continue
    }
    const identifier = generateNextCustomIdentifier(pool, row.categoryId, categoryMap)
    map.set(row.rowNumber, identifier)
    pool.push({
      id: `preview-${row.rowNumber}`,
      orgId: "",
      trade: "",
      identifier,
      isCustomItem: true,
      text: row.text,
      shortLabel: null,
      categoryId: row.categoryId,
      unitId: row.unitId ?? "",
      status: "active",
      tags: [],
      materialUnitPrice: 0,
      laborUnitPrice: 0,
      totalUnitPrice: 0,
      createdAt: "",
      updatedAt: "",
    })
  }

  return map
}

function resolveTradeId(trades: TradeRecord[], code: string | null): string | null {
  if (!code) return null
  return trades.find((t) => t.code === code)?.id ?? null
}

function resolveCategoryId(categories: Category[], code: string | null): string | null {
  if (!code) return null
  return categories.find((c) => c.code.toUpperCase() === code.toUpperCase())?.id ?? null
}

function resolveUnitId(units: Unit[], code: string | null): string | null {
  if (!code) return null
  return units.find((u) => u.code.toLowerCase() === code.toLowerCase())?.id ?? null
}

export function classifiedToPastePreviewRows(
  classified: ClassifiedPasteItem[],
  trades: TradeRecord[],
  categories: Category[],
  units: Unit[]
): PastePreviewRow[] {
  return classified.map((item) => {
    const tradeId = resolveTradeId(trades, item.tradeCode)
    let categoryId = resolveCategoryId(categories, item.categoryCode)
    const unitId = resolveUnitId(units, item.unitCode)

    if (tradeId && !categoryId) {
      const trade = trades.find((t) => t.id === tradeId)
      if (trade) {
        categoryId = getDefaultCategoryForTrade(trade.code, categories) || null
      }
    }

    const warnings: string[] = []
    const errors: string[] = []

    if (item.confidence < 60) {
      warnings.push(`Alacsony AI biztonság (${item.confidence}%) — ellenőrizd a besorolást.`)
    }
    if (!item.text.trim()) errors.push("A tétel szövege üres.")
    if (!tradeId) errors.push("Nincs érvényes szakág.")
    if (!categoryId) errors.push("Nincs érvényes kategória.")
    if (!unitId) errors.push("Nincs érvényes mértékegység.")

    const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined
    const trade = tradeId ? trades.find((t) => t.id === tradeId) : undefined
    if (category && trade && category.trade !== trade.code) {
      errors.push("A kategória nem tartozik a kiválasztott szakághoz.")
    }

    return {
      rowNumber: item.lineNumber,
      rawInput: item.raw,
      text: item.text,
      materialUnitPrice: item.materialUnitPrice,
      laborUnitPrice: item.laborUnitPrice,
      tradeId,
      categoryId,
      unitId,
      confidence: item.confidence,
      aiUsed: item.aiUsed,
      source: item.source,
      included: errors.length === 0,
      errors,
      warnings,
    }
  })
}

export function validatePastePreviewRow(
  row: PastePreviewRow,
  trades: Array<Pick<TradeRecord, "id" | "code">>,
  categories: Category[]
): PastePreviewRow {
  const errors: string[] = []
  const warnings = [...row.warnings.filter((w) => !w.startsWith("Alacsony AI"))]

  if (!row.text.trim()) errors.push("A tétel szövege üres.")
  if (!row.tradeId) errors.push("Nincs érvényes szakág.")
  if (!row.categoryId) errors.push("Nincs érvényes kategória.")
  if (!row.unitId) errors.push("Nincs érvényes mértékegység.")

  const trade = row.tradeId ? trades.find((t) => t.id === row.tradeId) : undefined
  const category = row.categoryId ? categories.find((c) => c.id === row.categoryId) : undefined
  if (category && trade && category.trade !== trade.code) {
    errors.push("A kategória nem tartozik a kiválasztott szakághoz.")
  }

  if (row.confidence < 60) {
    warnings.push(`Alacsony AI biztonság (${row.confidence}%) — ellenőrizd a besorolást.`)
  }

  return { ...row, errors, warnings }
}

export function pastePreviewToImportRows(
  rows: PastePreviewRow[],
  trades: Array<Pick<TradeRecord, "id" | "code">>,
  categories: Category[],
  units: Unit[]
): CostItemImportRow[] {
  const tradeCodeById = new Map(trades.map((t) => [t.id, t.code]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const unitById = new Map(units.map((u) => [u.id, u]))

  return rows
    .filter((row) => row.included)
    .map((row, idx) => {
      const tradeCode = row.tradeId ? tradeCodeById.get(row.tradeId) : undefined
      const category = row.categoryId ? categoryById.get(row.categoryId) : undefined
      const unit = row.unitId ? unitById.get(row.unitId) : undefined

      const errors = [...row.errors]
      if (!tradeCode) errors.push("Hiányzó szakág.")
      if (!category) errors.push("Hiányzó kategória.")
      if (!unit) errors.push("Hiányzó mértékegység.")

      return {
        rowNumber: row.rowNumber || idx + 2,
        values: {
          szakag: tradeCode ?? "",
          kategoria: category?.code ?? "",
          tetelszam: "K-tétel",
          tetel_szovege: row.text,
          mertekegyseg: unit?.code ?? "",
          anyag_egysegar: String(row.materialUnitPrice),
          dij_egysegre: String(row.laborUnitPrice),
          statusz: "active",
          cimkek: "beillesztett",
        },
        normalized: {
          trade: tradeCode ?? null,
          category: category?.code ?? null,
          identifier: null,
          text: row.text,
          unit: unit?.code ?? null,
          materialUnitPrice: row.materialUnitPrice,
          laborUnitPrice: row.laborUnitPrice,
          status: "active",
          tags: ["beillesztett"],
          isCustomItem: true,
        },
        resolved: {
          tradeId: row.tradeId,
          categoryId: row.categoryId,
          unitId: row.unitId,
          existingItemId: null,
        },
        action: errors.length > 0 ? "SKIP" : "CREATE",
        errors,
        warnings: row.warnings,
      } satisfies CostItemImportRow
    })
}
