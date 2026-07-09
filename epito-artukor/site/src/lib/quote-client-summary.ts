import type { Quote, QuoteLine } from "@/types/projects"
import type { QuoteVatMode } from "@/types/projects"
import type { Trade } from "@/types"
import { getDefaultVatMode, getDefaultVatModeStatic } from "@/lib/organization-profile"
import { getTradesListSync } from "@/lib/trades/trades-cache"
import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"
import {
  countUnpricedLines,
  isLineCosted,
  quoteCostTotals,
  quoteSellTotals,
} from "@/lib/quote-pricing"

export const QUOTE_VAT_OPTIONS: {
  id: QuoteVatMode
  label: string
  rate: number
}[] = [
  { id: "standard", label: "Általános (27%)", rate: 27 },
  { id: "reduced", label: "Csökkentett (5%)", rate: 5 },
  { id: "aam", label: "ÁFA mentes (AAM)", rate: 0 },
  { id: "reverse_charge", label: "Fordított adózás (EU)", rate: 0 },
]

export function resolveQuoteVatMode(quote: Quote): QuoteVatMode {
  if (quote.vatMode) return quote.vatMode
  if (typeof window !== "undefined") return getDefaultVatMode()
  return getDefaultVatModeStatic()
}

/** Rövid címke táblázat cellában (pl. „27% ÁFA”, „AAM”) */
export function quoteVatChipLabel(quote: Quote): string {
  const mode = resolveQuoteVatMode(quote)
  if (mode === "aam") return "AAM"
  if (mode === "reverse_charge") return "Fordított adózás"
  const opt = QUOTE_VAT_OPTIONS.find((o) => o.id === mode) ?? QUOTE_VAT_OPTIONS[0]
  return opt.rate > 0 ? `${opt.rate}% ÁFA` : "ÁFA mentes"
}

export type QuoteVatTotals = {
  netTotal: number
  vatAmount: number
  grossTotal: number
  vatLabel: string
  vatNote: string | null
  showVatAmount: boolean
}

export function calcQuoteVatTotals(netTotal: number, vatMode: QuoteVatMode): QuoteVatTotals {
  if (vatMode === "reverse_charge") {
    return {
      netTotal,
      vatAmount: 0,
      grossTotal: netTotal,
      vatLabel: "Fordított adózás",
      vatNote: "Az ÁFát a vevő fizeti meg (fordított adózás). A bruttó összeg megegyezik a nettóval.",
      showVatAmount: false,
    }
  }
  if (vatMode === "aam") {
    return {
      netTotal,
      vatAmount: 0,
      grossTotal: netTotal,
      vatLabel: "ÁFA mentes (AAM)",
      vatNote: "Alanyi adómentes — ÁFA nem kerül felszámításra.",
      showVatAmount: true,
    }
  }
  const opt = QUOTE_VAT_OPTIONS.find((o) => o.id === vatMode) ?? QUOTE_VAT_OPTIONS[0]
  const vatAmount = Math.round((netTotal * opt.rate) / 100)
  return {
    netTotal,
    vatAmount,
    grossTotal: netTotal + vatAmount,
    vatLabel: `ÁFA (${opt.rate}%)`,
    vatNote: null,
    showVatAmount: true,
  }
}

export type TradeBreakdownRow = {
  trade: Trade
  label: string
  lineCount: number
  pricedCount: number
  unpricedCount: number
  costTotal: number
  sellMaterialTotal: number
  sellLaborTotal: number
  sellNetTotal: number
  marginTotal: number
  marginPercent: number | null
  sharePercent: number | null
  marginLow: boolean
}

export type QuoteTradeBreakdown = {
  rows: TradeBreakdownRow[]
  totals: {
    lineCount: number
    pricedCount: number
    unpricedCount: number
    costTotal: number
    sellMaterialTotal: number
    sellLaborTotal: number
    sellNetTotal: number
    marginTotal: number
    marginPercent: number | null
  }
}

export function buildQuoteTradeBreakdown(quote: Quote, lines: QuoteLine[]): QuoteTradeBreakdown {
  const pricedLines = lines.filter((l) => isLineCosted(l))
  const totalNet = pricedLines.length > 0 ? quoteSellTotals(pricedLines, quote).total : 0

  const rows: TradeBreakdownRow[] = []

  for (const t of getTradesListSync()) {
    const tradeLines = lines.filter((l) => l.trade === t.code)
    if (tradeLines.length === 0) continue

    const priced = tradeLines.filter((l) => isLineCosted(l))
    if (priced.length === 0) continue

    const cost = quoteCostTotals(priced)
    const sell = quoteSellTotals(priced, quote)
    const margin = sell.total - cost.total
    const marginPercent =
      cost.total > 0 ? Math.round((margin / cost.total) * 100) : null
    const sharePercent =
      totalNet > 0 ? Math.round((sell.total / totalNet) * 100) : null

    rows.push({
      trade: t.code,
      label: t.name,
      lineCount: tradeLines.length,
      pricedCount: priced.length,
      unpricedCount: tradeLines.length - priced.length,
      costTotal: cost.total,
      sellMaterialTotal: sell.material,
      sellLaborTotal: sell.labor,
      sellNetTotal: sell.total,
      marginTotal: margin,
      marginPercent,
      sharePercent,
      marginLow:
        marginPercent != null && marginPercent < getMinAcceptableMarginPercent(),
    })
  }

  const costAll = quoteCostTotals(pricedLines)
  const sellAll = quoteSellTotals(pricedLines, quote)
  const marginAll = sellAll.total - costAll.total

  return {
    rows,
    totals: {
      lineCount: lines.length,
      pricedCount: pricedLines.length,
      unpricedCount: countUnpricedLines(lines),
      costTotal: costAll.total,
      sellMaterialTotal: sellAll.material,
      sellLaborTotal: sellAll.labor,
      sellNetTotal: sellAll.total,
      marginTotal: marginAll,
      marginPercent:
        costAll.total > 0 ? Math.round((marginAll / costAll.total) * 100) : null,
    },
  }
}

export type ClientQuoteReadiness = {
  canSend: boolean
  blockers: string[]
}

export function buildClientQuoteReadiness(
  lineCount: number,
  unpricedCount: number,
  isPartialTotal: boolean,
  marginPercent: number | null
): ClientQuoteReadiness {
  const blockers: string[] = []
  if (lineCount === 0) blockers.push("Nincs tétel az árajánlatban")
  if (unpricedCount > 0) blockers.push(`${unpricedCount} tétel még árazatlan`)
  if (!isPartialTotal && marginPercent != null && marginPercent < getMinAcceptableMarginPercent()) {
    blockers.push(
      `Fedezet alacsony (${marginPercent}% — minimum ${getMinAcceptableMarginPercent()}%)`
    )
  }
  return { canSend: blockers.length === 0, blockers }
}
