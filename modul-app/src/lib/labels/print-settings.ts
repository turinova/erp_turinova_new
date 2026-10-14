import type { SupabaseClient } from '@supabase/supabase-js'

export type LabelPrintSettings = {
  offsetXMm: number
  offsetYMm: number
}

export const LABEL_OFFSET_MIN = -2
export const LABEL_OFFSET_MAX = 2
export const LABEL_OFFSET_STEP = 0.1

export const DEFAULT_LABEL_PRINT_SETTINGS: LabelPrintSettings = {
  offsetXMm: 0,
  offsetYMm: 0
}

export function clampLabelOffset(n: number): number {
  const rounded = Math.round(n / LABEL_OFFSET_STEP) * LABEL_OFFSET_STEP
  return Math.min(
    LABEL_OFFSET_MAX,
    Math.max(LABEL_OFFSET_MIN, Number(rounded.toFixed(1)))
  )
}

export function normalizeLabelPrintSettings(
  input: Partial<LabelPrintSettings> | null | undefined
): LabelPrintSettings {
  return {
    offsetXMm: clampLabelOffset(Number(input?.offsetXMm) || 0),
    offsetYMm: clampLabelOffset(Number(input?.offsetYMm) || 0)
  }
}

type DbRow = {
  offset_x_mm: number | string
  offset_y_mm: number | string
}

export async function getLabelPrintSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<LabelPrintSettings> {
  const { data, error } = await supabase
    .from('tenant_label_print_settings')
    .select('offset_x_mm, offset_y_mm')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    console.error('getLabelPrintSettings', error.message)
    return { ...DEFAULT_LABEL_PRINT_SETTINGS }
  }
  if (!data) return { ...DEFAULT_LABEL_PRINT_SETTINGS }

  const row = data as DbRow
  return normalizeLabelPrintSettings({
    offsetXMm: Number(row.offset_x_mm),
    offsetYMm: Number(row.offset_y_mm)
  })
}
