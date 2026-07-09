import type { QuoteLine } from "@/types/projects"
import type { Trade } from "@/types"
import { getTradeOrder } from "@/lib/trades"
import {
  lineCostTotal,
  lineCostMaterialTotal,
  lineCostLaborTotal,
  quoteCostTotals,
} from "@/lib/quote-pricing"

export {
  lineCostTotal,
  lineCostMaterialTotal,
  lineCostLaborTotal,
  lineSellTotal,
  lineSellMaterialTotal,
  lineSellLaborTotal,
  quoteCostTotals,
  quoteSellTotals,
  isLineCosted,
  countUnpricedLines,
} from "@/lib/quote-pricing"

export function groupLinesByTrade(lines: QuoteLine[]): Map<Trade, QuoteLine[]> {
  const sorted = [...lines].sort((a, b) => a.sortOrder - b.sortOrder)
  const map = new Map<Trade, QuoteLine[]>()
  for (const trade of getTradeOrder()) {
    const group = sorted.filter((l) => l.trade === trade)
    if (group.length) map.set(trade, group)
  }
  return map
}

/** Sorszámok: 1.1, 1.2 (építőmester), 2.1 (gépészet)… */
export function assignSectionNumbers(lines: QuoteLine[]): Map<string, string> {
  const result = new Map<string, string>()
  const grouped = groupLinesByTrade(lines)
  let section = 0
  for (const trade of getTradeOrder()) {
    const group = grouped.get(trade)
    if (!group?.length) continue
    section += 1
    group.forEach((line, i) => {
      result.set(line.id, `${section}.${i + 1}`)
    })
  }
  return result
}

export function generateAccessToken(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function generateAccessCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/** Visszafelé kompatibilitás */
export const lineTotal = lineCostTotal
export const lineMaterialTotal = lineCostMaterialTotal
export const lineLaborTotal = lineCostLaborTotal
export const quoteTotals = quoteCostTotals
