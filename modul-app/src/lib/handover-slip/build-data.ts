import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  HandoverSlipData,
  HandoverSlipMaterialLine,
  HandoverSlipServiceLine
} from '@/lib/handover-slip/types'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/** Quote → átvételi blokk payload (lean select). */
export async function buildHandoverSlipData(
  supabase: SupabaseClient,
  tenantId: string,
  quoteId: string
): Promise<HandoverSlipData | null> {
  const [{ data: quote, error: qErr }, { data: company, error: cErr }] =
    await Promise.all([
      supabase
        .from('quotes')
        .select(
          `
          id,
          order_number,
          barcode,
          customers ( name ),
          quote_material_lines (
            material_name,
            boards_charged,
            charged_sqm,
            waste_multi,
            edge_length_m,
            cutting_length_m
          )
        `
        )
        .eq('id', quoteId)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('tenant_companies')
        .select(
          `
          name,
          postal_code,
          city,
          address,
          phone_number,
          email,
          tax_number,
          logo_url
        `
        )
        .eq('tenant_id', tenantId)
        .maybeSingle()
    ])

  if (qErr) {
    console.error('buildHandoverSlipData quote', qErr.message)
    return null
  }
  if (cErr) {
    console.error('buildHandoverSlipData company', cErr.message)
  }
  if (!quote?.order_number) return null

  const customer = one(
    quote.customers as { name: string } | { name: string }[] | null
  )

  const linesRaw = (quote.quote_material_lines ?? []) as Array<{
    material_name: string
    boards_charged: number
    charged_sqm: number
    waste_multi: number
    edge_length_m: number
    cutting_length_m: number
  }>

  const materials: HandoverSlipMaterialLine[] = linesRaw.map((l) => ({
    name: l.material_name || '—',
    chargedSqm: Number(l.charged_sqm) || 0,
    boardsCharged: Number(l.boards_charged) || 0,
    wasteMulti: Number(l.waste_multi) || 1,
    edgeLengthM: Number(l.edge_length_m) || 0
  }))

  const services: HandoverSlipServiceLine[] = []
  let cuttingM = 0
  for (const l of linesRaw) {
    cuttingM += Number(l.cutting_length_m) || 0
  }
  if (cuttingM > 0.001) {
    services.push({
      name: 'Szabás',
      quantity: Math.round(cuttingM * 100) / 100,
      unit: 'm'
    })
  }

  return {
    company: {
      name: company?.name ?? '—',
      postalCode: company?.postal_code ?? null,
      city: company?.city ?? null,
      address: company?.address ?? null,
      phone: company?.phone_number ?? null,
      email: company?.email ?? null,
      taxNumber: company?.tax_number ?? null,
      logoUrl: company?.logo_url ?? null
    },
    orderNumber: quote.order_number as string,
    customerName: customer?.name ?? '—',
    barcode: (quote.barcode as string | null) ?? null,
    materials,
    services,
    feeLines: [],
    accessoryLines: []
  }
}

/** Demo preview adat a beállítások oldalhoz. */
export function sampleHandoverSlipData(): HandoverSlipData {
  return {
    company: {
      name: 'Minta Lapbútor Kft.',
      postalCode: '6000',
      city: 'Kecskemét',
      address: 'Példa utca 1.',
      phone: '+36 76 000 000',
      email: 'info@pelda.hu',
      taxNumber: '12345678-2-03',
      logoUrl: null
    },
    orderNumber: 'MR-2026-001',
    customerName: 'Kovács István',
    barcode: 'MR2026001',
    materials: [
      {
        name: 'Fehér bútorlap 18 mm',
        chargedSqm: 4.32,
        boardsCharged: 2,
        wasteMulti: 1.15,
        edgeLengthM: 12.4
      },
      {
        name: 'Antracit bútorlap 18 mm',
        chargedSqm: 2.1,
        boardsCharged: 1,
        wasteMulti: 1.1,
        edgeLengthM: 6.2
      }
    ],
    services: [{ name: 'Szabás', quantity: 18.5, unit: 'm' }],
    feeLines: [],
    accessoryLines: []
  }
}

export function formatMaterialQty(
  line: HandoverSlipMaterialLine,
  format: 'm2_db' | 'm2_only' | 'boards_only'
): string {
  const multi = line.wasteMulti || 1
  const displaySqm = multi > 0 ? line.chargedSqm / multi : line.chargedSqm
  if (format === 'm2_only') return `${displaySqm.toFixed(2)} m²`
  if (format === 'boards_only') return `${line.boardsCharged} db`
  return `${displaySqm.toFixed(2)} m² / ${line.boardsCharged} db`
}
