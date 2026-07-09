import type { CostItem } from "@/types"
import type { QuoteLine } from "@/types/projects"
import { assignSectionNumbers } from "@/lib/quote-utils"

export function buildLineSectionNumbers(lines: QuoteLine[]): Map<string, string> {
  return assignSectionNumbers(lines)
}

export function getLineSectionNumber(
  lineId: string,
  sectionMap: Map<string, string>,
  fallbackIndex?: number
): string {
  const section = sectionMap.get(lineId)
  if (section) return section
  if (fallbackIndex != null) return String(fallbackIndex)
  return "—"
}

export function buildCostItemMap(items: CostItem[]): Map<string, CostItem> {
  return new Map(items.map((item) => [item.id, item]))
}

/** Belső UI — egyedi tételeknél belső kód (pl. BURK-1001), különben katalógus kód */
export function getLineInternalIdentifier(
  line: QuoteLine,
  costItemById?: Map<string, CostItem>
): string {
  if (line.costItemId && costItemById) {
    const item = costItemById.get(line.costItemId)
    if (item?.identifier) return item.identifier
  }
  return line.identifierSnapshot
}

export function lineMatchesInternalSearch(
  line: QuoteLine,
  query: string,
  costItemById?: Map<string, CostItem>
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const internalId = getLineInternalIdentifier(line, costItemById).toLowerCase()
  return (
    internalId.includes(q) ||
    line.identifierSnapshot.toLowerCase().includes(q) ||
    line.textSnapshot.toLowerCase().includes(q)
  )
}
