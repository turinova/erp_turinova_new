import type { ProjectExportModel } from "@/lib/project-export/types"
import type { ExportValidationResult } from "@/lib/project-export/types"

export function validateProjectExport(model: ProjectExportModel): ExportValidationResult {
  const issues: ExportValidationResult["issues"] = []

  if (model.quotes.length === 0) {
    issues.push({
      level: "error",
      message: "Válassz legalább egy szakágot az exporthoz.",
    })
  }

  let partialCount = 0
  let emptyCount = 0

  for (const slice of model.quotes) {
    if (slice.lines.length === 0) {
      emptyCount += 1
      issues.push({
        level: "warning",
        message: `„${slice.tradeLabel}” — nincs tétel, üres lap kerül az exportba.`,
      })
    }
    if (slice.summary.isPartialTotal) {
      partialCount += 1
    }
  }

  if (partialCount > 0) {
    issues.push({
      level: "warning",
      message: `${partialCount} szakágban vannak még árazatlan tételek — az összegek részlegesek.`,
    })
  }

  if (emptyCount === model.quotes.length && model.quotes.length > 0) {
    issues.push({
      level: "error",
      message: "Minden kijelölt szakág üres — nincs mit exportálni.",
    })
  }

  const ok = !issues.some((i) => i.level === "error")
  return { ok, issues }
}

/** Export pillanatában app összeg vs várható (validáció trade sheet builder után). */
export function assertTotalsMatch(
  expected: number,
  actual: number,
  label: string,
  tolerance = 0
): void {
  if (Math.abs(expected - actual) > tolerance) {
    throw new Error(`${label}: eltérés ${expected} vs ${actual} Ft`)
  }
}
