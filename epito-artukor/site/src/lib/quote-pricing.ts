import type { Quote, QuoteLine } from "@/types/projects"
import type { Trade } from "@/types"
import { calculateTotalUnitPrice } from "@/lib/pricing"
import { STATIC_DEFAULT_TRADE_MARKUPS } from "@/lib/app-settings/default-app-settings"
import { getDefaultTradeMarkups, getDefaultTradeMarkupsStatic } from "@/lib/app-settings"

/** Statikus seed — mock adatokhoz; futásidőben getDefaultTradeMarkups() */
export const DEFAULT_TRADE_MARKUPS: Record<Trade, number> = {
  ...STATIC_DEFAULT_TRADE_MARKUPS,
}

function resolveDefaultMarkups(): Record<Trade, number> {
  if (typeof window !== "undefined") return getDefaultTradeMarkups()
  return getDefaultTradeMarkupsStatic()
}

export const PRICING_STATUS_LABELS = {
  unpriced: "Nincs árazva",
  estimated: "Becsült",
  rfq_pending: "Várakozik alvállalkozóra",
  costed: "Bekerülés kész",
} as const

export const COST_SOURCE_LABELS = {
  unpriced: "—",
  catalog: "Ártükör",
  manual: "Kézi",
  subcontractor: "Alvállalkozó",
} as const

export function getLineMarkupPercent(line: QuoteLine, quote: Quote): number {
  if (line.markupPercent != null) return line.markupPercent
  const defaults = resolveDefaultMarkups()
  return quote.tradeMarkups?.[line.trade] ?? defaults[line.trade]
}

export function hasCustomMarkup(line: QuoteLine): boolean {
  return line.markupPercent != null
}

export function sellMaterialUnit(line: QuoteLine, quote: Quote): number {
  const m = getLineMarkupPercent(line, quote)
  return Math.round(line.costMaterialUnitPrice * (1 + m / 100))
}

export function sellLaborUnit(line: QuoteLine, quote: Quote): number {
  const m = getLineMarkupPercent(line, quote)
  return Math.round(line.costLaborUnitPrice * (1 + m / 100))
}

export function lineCostTotal(line: QuoteLine): number {
  return Math.round(
    (line.costMaterialUnitPrice + line.costLaborUnitPrice) * line.quantity
  )
}

export function lineCostMaterialTotal(line: QuoteLine): number {
  return Math.round(line.costMaterialUnitPrice * line.quantity)
}

export function lineCostLaborTotal(line: QuoteLine): number {
  return Math.round(line.costLaborUnitPrice * line.quantity)
}

export function lineSellTotal(line: QuoteLine, quote: Quote): number {
  const unit = calculateTotalUnitPrice({
    materialUnitPrice: sellMaterialUnit(line, quote),
    laborUnitPrice: sellLaborUnit(line, quote),
  })
  return Math.round(unit * line.quantity)
}

export function lineSellMaterialTotal(line: QuoteLine, quote: Quote): number {
  return Math.round(sellMaterialUnit(line, quote) * line.quantity)
}

export function lineSellLaborTotal(line: QuoteLine, quote: Quote): number {
  return Math.round(sellLaborUnit(line, quote) * line.quantity)
}

export function isLineCosted(line: QuoteLine): boolean {
  return line.costMaterialUnitPrice > 0 || line.costLaborUnitPrice > 0
}

export function quoteCostTotals(lines: QuoteLine[]) {
  let material = 0
  let labor = 0
  for (const line of lines) {
    material += line.costMaterialUnitPrice * line.quantity
    labor += line.costLaborUnitPrice * line.quantity
  }
  return {
    material: Math.round(material),
    labor: Math.round(labor),
    total: Math.round(material + labor),
  }
}

export function quoteSellTotals(lines: QuoteLine[], quote: Quote) {
  let material = 0
  let labor = 0
  for (const line of lines) {
    material += sellMaterialUnit(line, quote) * line.quantity
    labor += sellLaborUnit(line, quote) * line.quantity
  }
  return {
    material: Math.round(material),
    labor: Math.round(labor),
    total: Math.round(material + labor),
  }
}

export function countUnpricedLines(lines: QuoteLine[]): number {
  return lines.filter((l) => !isLineCosted(l)).length
}
