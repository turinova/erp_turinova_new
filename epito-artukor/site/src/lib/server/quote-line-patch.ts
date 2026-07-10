import type { SupabaseClient } from "@supabase/supabase-js"
import type { QuoteLine } from "@/types/projects"

type QuoteLinePatch = Partial<
  Pick<
    QuoteLine,
    | "quantity"
    | "unitId"
    | "costMaterialUnitPrice"
    | "costLaborUnitPrice"
    | "markupPercent"
    | "costSource"
    | "costSourceSubcontractor"
    | "costSourceRfqSubmissionId"
    | "pricingStatus"
    | "executionStatus"
    | "textSnapshot"
    | "identifierSnapshot"
    | "sortOrder"
  >
>

export async function patchQuoteLineInDb(
  supabase: SupabaseClient,
  orgId: string,
  lineId: string,
  patch: QuoteLinePatch
): Promise<void> {
  const { data: lineRow, error: lineErr } = await supabase
    .from("quote_lines")
    .select("id, quote_id")
    .eq("id", lineId)
    .maybeSingle()

  if (lineErr) throw new Error(lineErr.message)
  if (!lineRow) throw new Error("A tételsor nem található.")

  const { data: quoteRow, error: quoteErr } = await supabase
    .from("quotes")
    .select("id, project_id")
    .eq("id", lineRow.quote_id)
    .maybeSingle()

  if (quoteErr) throw new Error(quoteErr.message)
  if (!quoteRow) throw new Error("Az árajánlat nem található.")

  const { data: projectRow, error: projErr } = await supabase
    .from("projects")
    .select("id")
    .eq("id", quoteRow.project_id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle()

  if (projErr) throw new Error(projErr.message)
  if (!projectRow) throw new Error("Nincs jogosultság ehhez a tételsorhoz.")

  const update: Record<string, unknown> = {}

  if (patch.quantity !== undefined) update.quantity = patch.quantity
  if (patch.costMaterialUnitPrice !== undefined) {
    update.cost_material_unit_price = Math.round(patch.costMaterialUnitPrice)
  }
  if (patch.costLaborUnitPrice !== undefined) {
    update.cost_labor_unit_price = Math.round(patch.costLaborUnitPrice)
  }
  if (patch.markupPercent !== undefined) update.markup_percent = patch.markupPercent
  if (patch.costSource !== undefined) update.cost_source = patch.costSource
  if (patch.costSourceSubcontractor !== undefined) {
    update.cost_source_subcontractor = patch.costSourceSubcontractor
  }
  if (patch.costSourceRfqSubmissionId !== undefined) {
    update.cost_source_submission_id = patch.costSourceRfqSubmissionId
  }
  if (patch.pricingStatus !== undefined) update.pricing_status = patch.pricingStatus
  if (patch.executionStatus !== undefined) update.execution_status = patch.executionStatus
  if (patch.textSnapshot !== undefined) update.text_snapshot = patch.textSnapshot
  if (patch.identifierSnapshot !== undefined) {
    update.identifier_snapshot = patch.identifierSnapshot
  }
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder
  if (patch.unitId !== undefined) {
    const { data: unit, error: unitErr } = await supabase
      .from("units")
      .select("id")
      .eq("organization_id", orgId)
      .eq("id", patch.unitId)
      .is("deleted_at", null)
      .maybeSingle()
    if (unitErr) throw new Error(unitErr.message)
    if (!unit) throw new Error("Érvénytelen mértékegység.")
    update.unit_id = unit.id
  }

  if (Object.keys(update).length === 0) return

  const { error } = await supabase.from("quote_lines").update(update).eq("id", lineId)
  if (error) throw new Error(error.message)

  await supabase
    .from("quotes")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", lineRow.quote_id)
}
