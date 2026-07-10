import type { QuoteLine } from "@/types/projects"

/** Szerkeszthető oszlopok — bekerülés rács */
export const COST_SHEET_COLS = ["quantity", "material", "labor"] as const
export type CostSheetCol = (typeof COST_SHEET_COLS)[number]

/** Szerkeszthető oszlopok — árrés rács */
export const MARKUP_SHEET_COLS = ["markup"] as const
export type MarkupSheetCol = (typeof MARKUP_SHEET_COLS)[number]

export function parseSheetNumber(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".")
  if (normalized === "" || normalized === "—" || normalized === "-") return null
  const num = Number(normalized)
  return Number.isFinite(num) && num >= 0 ? num : null
}

export function parsePasteGrid(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((row) => row.length > 0)
    .map((row) => row.split("\t"))
}

type PasteCostPatch = {
  quantity?: number
  costMaterialUnitPrice?: number
  costLaborUnitPrice?: number
}

/** Excel TSV → soronkénti mezők (mennyiség / anyag / díj). */
export function mapPasteRowToCostPatch(
  cells: string[],
  startCol: CostSheetCol
): PasteCostPatch {
  const nums = cells.map(parseSheetNumber).filter((n): n is number => n != null)
  if (nums.length === 0) return {}

  const patch: PasteCostPatch = {}
  const startIdx = COST_SHEET_COLS.indexOf(startCol)

  if (cells.length >= 3 && startCol === "quantity") {
    const q = parseSheetNumber(cells[0])
    const m = parseSheetNumber(cells[1])
    const l = parseSheetNumber(cells[2])
    if (q != null) patch.quantity = q
    if (m != null) patch.costMaterialUnitPrice = m
    if (l != null) patch.costLaborUnitPrice = l
    return patch
  }

  nums.forEach((num, i) => {
    const col = COST_SHEET_COLS[startIdx + i]
    if (!col) return
    if (col === "quantity") patch.quantity = num
    if (col === "material") patch.costMaterialUnitPrice = num
    if (col === "labor") patch.costLaborUnitPrice = num
  })

  return patch
}

export function applyCostPasteToLines(
  lines: QuoteLine[],
  startRow: number,
  startCol: CostSheetCol,
  grid: string[][],
  applyPatch: (lineId: string, patch: PasteCostPatch) => void
): number {
  let updated = 0
  for (let r = 0; r < grid.length; r++) {
    const line = lines[startRow + r]
    if (!line) break
    const patch = mapPasteRowToCostPatch(grid[r], r === 0 ? startCol : "quantity")
    if (Object.keys(patch).length === 0) continue
    applyPatch(line.id, patch)
    updated += 1
  }
  return updated
}

export function focusSheetCell(
  root: HTMLElement | null,
  row: number,
  col: string
): void {
  if (!root) return
  const el = root.querySelector<HTMLElement>(
    `[data-sheet-row="${row}"][data-sheet-col="${col}"]`
  )
  el?.focus()
}

export function navigateSheetRowCol(
  row: number,
  col: string,
  direction: "up" | "down" | "left" | "right",
  maxRow: number,
  cols: readonly string[]
): { row: number; col: string } {
  const colIdx = cols.indexOf(col)
  if (colIdx < 0) return { row, col }

  if (direction === "left") {
    if (colIdx > 0) return { row, col: cols[colIdx - 1] }
    return { row, col }
  }
  if (direction === "right") {
    if (colIdx < cols.length - 1) return { row, col: cols[colIdx + 1] }
    return { row, col }
  }
  if (direction === "up") {
    return { row: Math.max(0, row - 1), col }
  }
  return { row: Math.min(maxRow, row + 1), col }
}
