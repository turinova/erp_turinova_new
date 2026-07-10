import { COST_SHEET_LAYOUT } from "@/lib/quote-sheet-layout"

export function CostSheetColgroup() {
  return (
    <colgroup>
      <col style={{ width: COST_SHEET_LAYOUT.ssz }} />
      <col style={{ width: COST_SHEET_LAYOUT.identifier }} />
      <col />
      <col style={{ width: COST_SHEET_LAYOUT.quantity }} />
      <col style={{ width: COST_SHEET_LAYOUT.unit }} />
      <col style={{ width: COST_SHEET_LAYOUT.materialUnit }} />
      <col style={{ width: COST_SHEET_LAYOUT.laborUnit }} />
      <col style={{ width: COST_SHEET_LAYOUT.materialTotal }} />
      <col style={{ width: COST_SHEET_LAYOUT.laborTotal }} />
      <col style={{ width: COST_SHEET_LAYOUT.lineTotal }} />
      <col style={{ width: COST_SHEET_LAYOUT.source }} />
      <col style={{ width: COST_SHEET_LAYOUT.actions }} />
    </colgroup>
  )
}
