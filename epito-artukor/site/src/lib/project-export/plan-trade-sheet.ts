import type { Quote, QuoteLine } from "@/types/projects"
import { groupLinesByTrade } from "@/lib/quote-utils"
import {
  lineCostLaborTotal,
  lineCostMaterialTotal,
  sellLaborUnit,
  sellMaterialUnit,
} from "@/lib/quote-pricing"
import { cellRef } from "@/lib/project-export/xlsx-address"
import { COST_MARGIN_COL, tradeSheetLayout } from "@/lib/project-export/excel-layout"
import type { BuiltTradeSheet, ProjectExportKind } from "@/lib/project-export/types"

/** Szakági lap sorstruktúra — összesítő hivatkozásokhoz, renderelés nélkül. */
export function planTradeSheetBuilt(input: {
  quote: Quote
  lines: QuoteLine[]
  kind: ProjectExportKind
}): BuiltTradeSheet {
  const { quote, lines, kind } = input
  const isSell = kind === "sell"
  const useGepeszet = quote.primaryTrade === "gepeszet"

  const layout = tradeSheetLayout(kind)

  let row = layout.dataStartRow
  let appMaterial = 0
  let appLabor = 0

  if (useGepeszet) {
    for (const line of lines) {
      const matUnit = isSell ? sellMaterialUnit(line, quote) : line.costMaterialUnitPrice
      const laborUnit = isSell ? sellLaborUnit(line, quote) : line.costLaborUnitPrice
      appMaterial += isSell
        ? Math.round(matUnit * line.quantity)
        : lineCostMaterialTotal(line)
      appLabor += isSell
        ? Math.round(laborUnit * line.quantity)
        : lineCostLaborTotal(line)
      row += 1
    }
  } else {
    const grouped = groupLinesByTrade(lines)
    for (const [, group] of grouped) {
      row += 1 // szekciófejléc
      for (const line of group) {
        const matUnit = isSell
          ? sellMaterialUnit(line, quote)
          : line.costMaterialUnitPrice
        const laborUnit = isSell ? sellLaborUnit(line, quote) : line.costLaborUnitPrice
        appMaterial += isSell
          ? Math.round(matUnit * line.quantity)
          : lineCostMaterialTotal(line)
        appLabor += isSell
          ? Math.round(laborUnit * line.quantity)
          : lineCostLaborTotal(line)
        row += 1
      }
    }
  }

  const totalRow = row
  const isCostWithMargin = !isSell
  return {
    sheetName: "",
    anchors: {
      materialTotal: cellRef(8, totalRow),
      laborTotal: cellRef(9, totalRow),
      netTotal: cellRef(isCostWithMargin ? COST_MARGIN_COL.costNet : 10, totalRow),
      ...(isCostWithMargin
        ? {
            sellTotal: cellRef(COST_MARGIN_COL.sellNet, totalRow),
            marginTotal: cellRef(COST_MARGIN_COL.marginNet, totalRow),
          }
        : {}),
      totalRow,
    },
    appTotals: {
      material: appMaterial,
      labor: appLabor,
      net: appMaterial + appLabor,
    },
  }
}
