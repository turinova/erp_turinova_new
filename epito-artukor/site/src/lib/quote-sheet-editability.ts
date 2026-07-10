import type { QuoteLine } from "@/types/projects"

export type CellEditability =
  | "editable"
  | "computed"
  | "meta"
  | "locked_rfq"
  | "locked_quote"

export type CostSheetField =
  | "quantity"
  | "unit"
  | "materialUnit"
  | "laborUnit"
  | "materialTotal"
  | "laborTotal"
  | "lineTotal"
  | "source"
  | "actions"

export function getCostCellEditability(
  line: QuoteLine,
  field: CostSheetField,
  isReadOnly: boolean
): CellEditability {
  if (field === "materialTotal" || field === "lineTotal" || field === "laborTotal") {
    return "computed"
  }
  if (field === "source" || field === "actions") {
    return "meta"
  }

  if (isReadOnly) return "locked_quote"

  if (
    line.pricingStatus === "rfq_pending" &&
    (field === "materialUnit" || field === "laborUnit")
  ) {
    return "locked_rfq"
  }

  return "editable"
}

export function isCostFieldDisabled(
  line: QuoteLine,
  field: CostSheetField,
  isReadOnly: boolean
): boolean {
  const editability = getCostCellEditability(line, field, isReadOnly)
  return editability === "locked_quote" || editability === "locked_rfq"
}

export function costFieldLockTitle(
  line: QuoteLine,
  field: CostSheetField,
  isReadOnly: boolean
): string | undefined {
  const editability = getCostCellEditability(line, field, isReadOnly)
  if (editability === "locked_quote") return "Lezárt árajánlat — nem szerkeszthető"
  if (editability === "locked_rfq") return "Vár alvállalkozóra — ár nem szerkeszthető"
  if (field === "materialTotal" || field === "laborTotal" || field === "lineTotal") {
    return "Számított mező — mennyiség × egységár"
  }
  if (line.costSource === "subcontractor" && (field === "materialUnit" || field === "laborUnit")) {
    return "Alvállalkozói ár — szerkeszthető, de forrás megmarad"
  }
  return undefined
}
