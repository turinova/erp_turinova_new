import { MARKUP_SHEET_LAYOUT } from "@/lib/quote-sheet-layout"

export function MarkupSheetColgroup() {
  return (
    <colgroup>
      <col style={{ width: MARKUP_SHEET_LAYOUT.checkbox }} />
      <col style={{ width: MARKUP_SHEET_LAYOUT.ssz }} />
      <col style={{ width: MARKUP_SHEET_LAYOUT.identifier }} />
      <col />
      <col style={{ width: MARKUP_SHEET_LAYOUT.quantity }} />
      <col style={{ width: MARKUP_SHEET_LAYOUT.cost }} />
      <col style={{ width: MARKUP_SHEET_LAYOUT.markup }} />
      <col style={{ width: MARKUP_SHEET_LAYOUT.sell }} />
      <col style={{ width: MARKUP_SHEET_LAYOUT.margin }} />
    </colgroup>
  )
}
