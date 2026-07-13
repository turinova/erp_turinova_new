import ExcelJS from "exceljs"
import { loadCostItems } from "@/lib/data/cost-items-store"
import { getUnitMap } from "@/lib/data/units-store"
import { buildCostItemMap } from "@/lib/quote-line-display"
import { buildProjectExportModel } from "@/lib/project-export/build-export-model"
import type { BuildExportModelInput } from "@/lib/project-export/build-export-model"
import { buildSummarySheet } from "@/lib/project-export/build-summary-sheet"
import { buildTradeSheet } from "@/lib/project-export/build-trade-sheet"
import { planTradeSheetBuilt } from "@/lib/project-export/plan-trade-sheet"
import {
  lineCostLaborTotal,
  lineCostMaterialTotal,
  lineSellLaborTotal,
  lineSellMaterialTotal,
} from "@/lib/quote-pricing"
import type { BuiltTradeSheet, ProjectExportModel, ProjectExportQuoteSlice } from "@/lib/project-export/types"

export type BuildWorkbookResult = {
  buffer: ArrayBuffer
  filename: string
  model: ProjectExportModel
}

type TradeSheetBundle = {
  slice: ProjectExportQuoteSlice
  built: BuiltTradeSheet
}

function buildFilename(projectName: string, kind: string): string {
  const safe = projectName
    .replace(/[^\w\s-áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40)
  const date = new Date().toISOString().split("T")[0]
  const suffix = kind === "sell" ? "ajanlat" : "bekerules"
  return `${safe || "projekt"}_${suffix}_${date}.xlsx`
}

export async function buildProjectExportWorkbook(
  input: BuildExportModelInput
): Promise<BuildWorkbookResult> {
  const model = buildProjectExportModel(input)
  const costItemById = buildCostItemMap(loadCostItems())
  const unitMap = getUnitMap()
  const unitCodeById: Record<string, string> = {}
  for (const [id, unit] of Object.entries(unitMap)) {
    if (unit) unitCodeById[id] = unit.code
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Építőártükör"
  workbook.created = new Date(model.exportedAt)

  const bundles: TradeSheetBundle[] = model.quotes.map((slice) => {
    const built = planTradeSheetBuilt({
      quote: slice.quote,
      lines: slice.lines,
      kind: model.kind,
    })
    built.sheetName = slice.sheetName

    const expectedTotal = slice.lines.reduce((sum, line) => {
      if (model.kind === "sell") {
        return sum + lineSellMaterialTotal(line, slice.quote) + lineSellLaborTotal(line, slice.quote)
      }
      return sum + lineCostMaterialTotal(line) + lineCostLaborTotal(line)
    }, 0)

    if (expectedTotal !== built.appTotals.net) {
      throw new Error(
        `${slice.tradeLabel}: összeg eltérés (${expectedTotal} vs ${built.appTotals.net} Ft)`
      )
    }

    return { slice, built }
  })

  // Főösszesítő mindig az első lap — előbb hozzuk létre, utána a szakági lapok.
  buildSummarySheet(workbook, {
    project: model.project,
    organization: model.organization,
    kind: model.kind,
    exportedAt: model.exportedAt,
    trades: bundles,
  })

  for (const bundle of bundles) {
    buildTradeSheet(workbook, bundle.slice.sheetName, {
      project: model.project,
      organization: model.organization,
      quote: bundle.slice.quote,
      lines: bundle.slice.lines,
      kind: model.kind,
      exportedAt: model.exportedAt,
      costItemById,
      unitCodeById,
    })
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer
  return {
    buffer,
    filename: buildFilename(model.project.name, model.kind),
    model,
  }
}
