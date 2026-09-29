import type { SupabaseClient } from '@supabase/supabase-js'

import {
  DEFAULT_HANDOVER_SLIP_SETTINGS,
  type HandoverSlipCopies,
  type HandoverSlipQtyFormat,
  type HandoverSlipSettings,
  type HandoverSlipSingleKind
} from '@/lib/handover-slip/types'

type DbRow = {
  enabled: boolean
  copies: number
  single_copy_kind: string
  paper_width_mm: number
  auto_on_handover: boolean
  ask_before_print: boolean
  show_company_logo: boolean
  show_company_address: boolean
  show_company_phone: boolean
  show_company_email: boolean
  show_tax_number: boolean
  show_order_number: boolean
  show_customer_name: boolean
  show_barcode: boolean
  show_print_datetime: boolean
  show_materials: boolean
  show_edge: boolean
  show_services: boolean
  show_fees: boolean
  show_accessories: boolean
  qty_format: string
  show_legal_text: boolean
  legal_text: string
  show_gate_line: boolean
  gate_line_text: string
  show_signatures: boolean
  customer_copy_label: string
}

function asCopies(n: number): HandoverSlipCopies {
  if (n === 0 || n === 1 || n === 2) return n
  return 2
}

function asSingle(v: string): HandoverSlipSingleKind {
  return v === 'original' ? 'original' : 'customer'
}

function asQty(v: string): HandoverSlipQtyFormat {
  if (v === 'm2_only' || v === 'boards_only') return v
  return 'm2_db'
}

export function mapHandoverSlipSettings(row: DbRow): HandoverSlipSettings {
  return {
    enabled: Boolean(row.enabled),
    copies: asCopies(Number(row.copies)),
    singleCopyKind: asSingle(row.single_copy_kind),
    paperWidthMm: row.paper_width_mm === 58 ? 58 : 80,
    autoOnHandover: Boolean(row.auto_on_handover),
    askBeforePrint: Boolean(row.ask_before_print),
    showCompanyLogo: Boolean(row.show_company_logo),
    showCompanyAddress: Boolean(row.show_company_address),
    showCompanyPhone: Boolean(row.show_company_phone),
    showCompanyEmail: Boolean(row.show_company_email),
    showTaxNumber: Boolean(row.show_tax_number),
    showOrderNumber: Boolean(row.show_order_number),
    showCustomerName: Boolean(row.show_customer_name),
    showBarcode: Boolean(row.show_barcode),
    showPrintDatetime: Boolean(row.show_print_datetime),
    showMaterials: Boolean(row.show_materials),
    showEdge: Boolean(row.show_edge),
    showServices: Boolean(row.show_services),
    showFees: Boolean(row.show_fees),
    showAccessories: Boolean(row.show_accessories),
    qtyFormat: asQty(row.qty_format),
    showLegalText: Boolean(row.show_legal_text),
    legalText: row.legal_text || DEFAULT_HANDOVER_SLIP_SETTINGS.legalText,
    showGateLine: Boolean(row.show_gate_line),
    gateLineText:
      row.gate_line_text || DEFAULT_HANDOVER_SLIP_SETTINGS.gateLineText,
    showSignatures: Boolean(row.show_signatures),
    customerCopyLabel:
      row.customer_copy_label ||
      DEFAULT_HANDOVER_SLIP_SETTINGS.customerCopyLabel
  }
}

export function settingsToDbRow(
  tenantId: string,
  s: HandoverSlipSettings
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    enabled: s.enabled,
    copies: s.copies,
    single_copy_kind: s.singleCopyKind,
    paper_width_mm: s.paperWidthMm,
    auto_on_handover: s.autoOnHandover,
    ask_before_print: s.askBeforePrint,
    show_company_logo: s.showCompanyLogo,
    show_company_address: s.showCompanyAddress,
    show_company_phone: s.showCompanyPhone,
    show_company_email: s.showCompanyEmail,
    show_tax_number: s.showTaxNumber,
    show_order_number: s.showOrderNumber,
    show_customer_name: s.showCustomerName,
    show_barcode: s.showBarcode,
    show_print_datetime: s.showPrintDatetime,
    show_materials: s.showMaterials,
    show_edge: s.showEdge,
    show_services: s.showServices,
    show_fees: s.showFees,
    show_accessories: s.showAccessories,
    qty_format: s.qtyFormat,
    show_legal_text: s.showLegalText,
    legal_text: s.legalText.slice(0, 800),
    show_gate_line: s.showGateLine,
    gate_line_text: s.gateLineText.slice(0, 200),
    show_signatures: s.showSignatures,
    customer_copy_label: s.customerCopyLabel.slice(0, 40),
    updated_at: new Date().toISOString()
  }
}

const SELECT_COLS = `
  enabled, copies, single_copy_kind, paper_width_mm,
  auto_on_handover, ask_before_print,
  show_company_logo, show_company_address, show_company_phone,
  show_company_email, show_tax_number,
  show_order_number, show_customer_name, show_barcode, show_print_datetime,
  show_materials, show_edge, show_services, show_fees, show_accessories,
  qty_format, show_legal_text, legal_text,
  show_gate_line, gate_line_text, show_signatures, customer_copy_label
`

export async function getHandoverSlipSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<HandoverSlipSettings> {
  const { data, error } = await supabase
    .from('tenant_handover_slip_settings')
    .select(SELECT_COLS)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    console.error('getHandoverSlipSettings', error.message)
    return { ...DEFAULT_HANDOVER_SLIP_SETTINGS }
  }
  if (!data) return { ...DEFAULT_HANDOVER_SLIP_SETTINGS }
  return mapHandoverSlipSettings(data as DbRow)
}

export async function ensureHandoverSlipSettingsRow(
  supabase: SupabaseClient,
  tenantId: string
): Promise<HandoverSlipSettings> {
  const existing = await getHandoverSlipSettings(supabase, tenantId)
  const { data } = await supabase
    .from('tenant_handover_slip_settings')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (data) return existing

  await supabase.from('tenant_handover_slip_settings').upsert(
    { tenant_id: tenantId },
    { onConflict: 'tenant_id' }
  )
  return getHandoverSlipSettings(supabase, tenantId)
}
