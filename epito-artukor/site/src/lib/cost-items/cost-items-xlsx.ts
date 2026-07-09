import type { Category, CostItem, CostItemStatus, Trade, Unit } from "@/types"
import {
  isCustomItemFromIdentifier,
  isLegacyPlainCustomIdentifier,
} from "@/lib/item-identifier"

export const COST_ITEM_XLSX_COLUMNS = [
  "szakag",
  "kategoria",
  "tetelszam",
  "tetel_szovege",
  "mertekegyseg",
  "anyag_egysegar",
  "dij_egysegre",
  "statusz",
  "cimkek",
] as const

export type CostItemXlsxColumn = (typeof COST_ITEM_XLSX_COLUMNS)[number]

export type CostItemImportAction = "CREATE" | "UPDATE" | "SKIP"

export type CostItemImportRow = {
  rowNumber: number
  values: Record<CostItemXlsxColumn, string>
  normalized: {
    trade: string | null
    category: string | null
    identifier: string | null
    text: string | null
    unit: string | null
    materialUnitPrice: number
    laborUnitPrice: number
    status: CostItemStatus
    tags: string[]
    isCustomItem: boolean
  }
  resolved: {
    tradeId: string | null
    categoryId: string | null
    unitId: string | null
    existingItemId: string | null
  }
  action: CostItemImportAction
  errors: string[]
  warnings: string[]
}

const ALLOWED_STATUS = new Set<CostItemStatus>(["draft", "active", "archived"])

const STATUS_ALIASES: Record<string, CostItemStatus> = {
  draft: "draft",
  piszkozat: "draft",
  active: "active",
  aktiv: "active",
  archived: "archived",
  archivált: "archived",
  archivalt: "archived",
}

function toCellString(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function normalizeNullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseIntegerPrice(value: string): number {
  if (!value.trim()) return 0
  const cleaned = value.replace(/\s/g, "").replace(",", ".")
  const parsed = Number.parseFloat(cleaned)
  if (!Number.isFinite(parsed)) return Number.NaN
  return Math.round(parsed)
}

function parseStatus(value: string): CostItemStatus | null {
  const raw = value.trim().toLowerCase()
  if (!raw) return "active"
  return STATUS_ALIASES[raw] ?? null
}

function parseTags(value: string): string[] {
  if (!value.trim()) return []
  return value
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function isCustomTetelszam(value: string | null): boolean {
  if (!value) return true
  if (isLegacyPlainCustomIdentifier(value)) return true
  return isCustomItemFromIdentifier(value)
}

export function validateHeaderColumns(columns: string[]): string[] {
  const missing = COST_ITEM_XLSX_COLUMNS.filter((col) => !columns.includes(col))
  return missing.map((col) => `Hiányzó oszlop: ${col}`)
}

export function normalizeCostItemImportRows(
  rows: Array<Record<string, unknown>>
): CostItemImportRow[] {
  return rows.map((row, idx) => {
    const values = Object.fromEntries(
      COST_ITEM_XLSX_COLUMNS.map((column) => [column, toCellString(row[column])])
    ) as Record<CostItemXlsxColumn, string>

    const identifierRaw = normalizeNullableText(values.tetelszam)
    const isCustomItem = isCustomTetelszam(identifierRaw)
    const materialUnitPrice = parseIntegerPrice(values.anyag_egysegar)
    const laborUnitPrice = parseIntegerPrice(values.dij_egysegre)
    const status = parseStatus(values.statusz)

    const normalized = {
      trade: normalizeNullableText(values.szakag)?.toLowerCase() ?? null,
      category: normalizeNullableText(values.kategoria)?.toUpperCase() ?? null,
      identifier: isCustomItem ? null : identifierRaw,
      text: normalizeNullableText(values.tetel_szovege),
      unit: normalizeNullableText(values.mertekegyseg)?.toLowerCase() ?? null,
      materialUnitPrice,
      laborUnitPrice,
      status: status ?? "active",
      tags: parseTags(values.cimkek),
      isCustomItem,
    }

    const errors: string[] = []
    const warnings: string[] = []

    if (!normalized.trade) errors.push("A szakag mező kötelező.")
    if (!normalized.category) errors.push("A kategoria mező kötelező.")
    if (!normalized.text) errors.push("A tetel_szovege mező kötelező.")
    if (!normalized.unit) errors.push("A mertekegyseg mező kötelező.")

    if (Number.isNaN(materialUnitPrice)) {
      errors.push("Az anyag_egysegar mezőnek számnak kell lennie.")
    }
    if (Number.isNaN(laborUnitPrice)) {
      errors.push("A dij_egysegre mezőnek számnak kell lennie.")
    }
    if (values.statusz.trim() && !status) {
      errors.push("Érvénytelen statusz. Használd: active, draft vagy archived.")
    }
    if (isCustomItem) {
      warnings.push("K-tétel — a tételszám importkor automatikusan generálódik.")
    }

    return {
      rowNumber: idx + 2,
      values,
      normalized,
      resolved: {
        tradeId: null,
        categoryId: null,
        unitId: null,
        existingItemId: null,
      },
      action: "CREATE",
      errors,
      warnings,
    }
  })
}

export type CostItemImportContext = {
  trades: TradeRef[]
  categories: Category[]
  units: Unit[]
  existingByIdentifier: Map<string, CostItem>
}

type TradeRef = { id: string; code: Trade }

export function enrichCostItemImportRows(
  rows: CostItemImportRow[],
  context: CostItemImportContext,
  mode: "upsert" | "create_only" = "upsert"
): CostItemImportRow[] {
  const tradesByCode = new Map(context.trades.map((t) => [t.code.toLowerCase(), t]))
  const categoriesByCode = new Map(
    context.categories.map((c) => [c.code.toUpperCase(), c])
  )
  const unitsByCode = new Map(context.units.map((u) => [u.code.toLowerCase(), u]))

  const seenIdentifiers = new Map<string, number>()

  return rows.map((row) => {
    const errors = [...row.errors]
    const warnings = [...row.warnings]
    const resolved = { ...row.resolved }

    const trade = row.normalized.trade
      ? tradesByCode.get(row.normalized.trade)
      : undefined
    if (row.normalized.trade && !trade) {
      errors.push(`Ismeretlen szakág: „${row.values.szakag}”.`)
    } else if (trade) {
      resolved.tradeId = trade.id
    }

    const category = row.normalized.category
      ? categoriesByCode.get(row.normalized.category)
      : undefined
    if (row.normalized.category && !category) {
      errors.push(`Ismeretlen kategória: „${row.values.kategoria}”.`)
    } else if (category) {
      resolved.categoryId = category.id
      if (trade && category.trade !== trade.code) {
        errors.push(
          `A kategória (${category.code}) nem tartozik ehhez a szakághoz (${trade.code}).`
        )
      }
    }

    const unit = row.normalized.unit ? unitsByCode.get(row.normalized.unit) : undefined
    if (row.normalized.unit && !unit) {
      errors.push(`Ismeretlen mértékegység: „${row.values.mertekegyseg}”.`)
    } else if (unit) {
      resolved.unitId = unit.id
    }

    let action: CostItemImportAction = "CREATE"

    if (!row.normalized.isCustomItem && row.normalized.identifier) {
      const key = row.normalized.identifier.toLowerCase()
      if (seenIdentifiers.has(key)) {
        errors.push(
          `Duplikált tételszám a fájlban (első előfordulás: sor ${seenIdentifiers.get(key)}).`
        )
      } else {
        seenIdentifiers.set(key, row.rowNumber)
      }

      const existing = context.existingByIdentifier.get(key)
      if (existing) {
        resolved.existingItemId = existing.id
        action = "UPDATE"
      }
    }

    if (errors.length > 0) {
      action = "SKIP"
    } else if (action === "UPDATE" && mode === "create_only") {
      warnings.push("Létező tételszám — csak új módban kihagyva.")
      action = "SKIP"
    }

    return { ...row, resolved, action, errors, warnings }
  })
}

export function costItemToExportRow(
  item: CostItem,
  categories: Category[],
  units: Unit[]
): Record<CostItemXlsxColumn, string> {
  const category = categories.find((c) => c.id === item.categoryId)
  const unit = units.find((u) => u.id === item.unitId)

  return {
    szakag: item.trade,
    kategoria: category?.code ?? "",
    tetelszam: item.isCustomItem ? "K-tétel" : item.identifier,
    tetel_szovege: item.text,
    mertekegyseg: unit?.code ?? "",
    anyag_egysegar: String(item.materialUnitPrice),
    dij_egysegre: String(item.laborUnitPrice),
    statusz: item.status,
    cimkek: item.tags.join(", "),
  }
}

export function getCostItemTemplateRows(): Array<Record<CostItemXlsxColumn, string>> {
  return [
    {
      szakag: "epitomester",
      kategoria: "EP-BON",
      tetelszam: "81-000-1.1.1",
      tetel_szovege: "Meglévő nyílászárók bontása",
      mertekegyseg: "m2",
      anyag_egysegar: "0",
      dij_egysegre: "7500",
      statusz: "active",
      cimkek: "",
    },
    {
      szakag: "epitomester",
      kategoria: "EP-BON",
      tetelszam: "K-tétel",
      tetel_szovege: "Egyedi tétel példa (K-tétel kód generálódik)",
      mertekegyseg: "klt",
      anyag_egysegar: "2500",
      dij_egysegre: "6500",
      statusz: "active",
      cimkek: "importált",
    },
  ]
}

export function getCostItemInstructionRows(): Array<{ mezo: string; leiras: string }> {
  return [
    { mezo: "FONTOS", leiras: "Az export és import ugyanazt az oszlopsémát használja." },
    { mezo: "szakag", leiras: "Szakág kód (pl. epitomester) — trades.code" },
    { mezo: "kategoria", leiras: "Kategória kód (pl. EP-BON) — categories.code, egyezzen a szakággal" },
    { mezo: "tetelszam", leiras: "Egyedi tételszám, vagy üres / K-tétel → automatikus K-tétel kód" },
    { mezo: "tetel_szovege", leiras: "Kötelező — a tétel teljes szövege" },
    { mezo: "mertekegyseg", leiras: "ME kód (pl. m2, db, klt) — units.code" },
    { mezo: "statusz", leiras: "active, draft vagy archived" },
    { mezo: "cimkek", leiras: "Opcionális, vesszővel elválasztva" },
    { mezo: "Import mód", leiras: "Upsert: létező tételszám frissül. Csak új: duplikátum kihagyva." },
    { mezo: "Fájl típus", leiras: "Csak .xlsx támogatott." },
  ]
}
