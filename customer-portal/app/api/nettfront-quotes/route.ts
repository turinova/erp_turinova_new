import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getPortalAuthContext, round2 } from '@/lib/nettfront-portal-auth'
import {
  buildInomatCatalogFromSkus,
  computeFronttervezoInomatQuote,
  getInomatColorDef,
  normalizeInomatSzin,
  type InomatQuoteLineInput,
  type NettfrontSkuRow
} from '@/lib/pricing/fronttervezoInomatQuote'
import { NETTFRONT_VAT_RATE } from '@/lib/pricing/inomatCatalog'
import { getCompanyNettfrontSkus, getCompanyCuttingFee } from '@/lib/company-data-server'

type CustomerPayload = {
  id?: string | null
  name?: string
  email?: string
  mobile?: string
  discount_percent?: number | string
  billing_name?: string
  billing_country?: string
  billing_city?: string
  billing_postal_code?: string
  billing_street?: string
  billing_house_number?: string
  billing_tax_number?: string
  billing_company_reg_number?: string
}

/**
 * POST /api/nettfront-quotes
 * Save/update Nettfront draft in portal DB (Inomat lines).
 * Body: { quoteId?, customerData, inomatLines }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      quoteId,
      customerData,
      inomatLines
    }: {
      quoteId?: string | null
      customerData: CustomerPayload
      inomatLines: InomatQuoteLineInput[]
    } = body

    const ctx = await getPortalAuthContext()
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const { supabase, portalCustomer } = ctx

    if (!Array.isArray(inomatLines) || inomatLines.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy Inomat tétel szükséges a mentéshez.' },
        { status: 400 }
      )
    }

    if (!customerData?.name?.trim()) {
      return NextResponse.json({ error: 'A megrendelő neve kötelező.' }, { status: 400 })
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, supabase_url, supabase_anon_key')
      .eq('id', portalCustomer.selected_company_id)
      .eq('is_active', true)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Selected company not found' }, { status: 404 })
    }

    const creds = {
      supabase_url: company.supabase_url,
      supabase_anon_key: company.supabase_anon_key
    }

    const [skuRows, cuttingFee] = await Promise.all([
      getCompanyNettfrontSkus(creds, 'inomat'),
      getCompanyCuttingFee(creds)
    ])

    const catalog = buildInomatCatalogFromSkus(skuRows as NettfrontSkuRow[])
    if (catalog.length === 0) {
      return NextResponse.json(
        { error: 'Nettfront katalógus üres — árak nem elérhetők.' },
        { status: 500 }
      )
    }

    const discountPercent =
      Number.parseFloat(String(customerData.discount_percent ?? portalCustomer.discount_percent ?? 0)) ||
      0

    const quoteCalc = computeFronttervezoInomatQuote(
      inomatLines,
      cuttingFee,
      discountPercent,
      catalog
    )

    if (!quoteCalc) {
      return NextResponse.json({ error: 'Az ajánlat számítása sikertelen.' }, { status: 400 })
    }

    const linesNet = round2(quoteCalc.rows.reduce((s, r) => s + r.net, 0))
    const linesVat = round2(quoteCalc.rows.reduce((s, r) => s + r.vat, 0))
    const linesGross = round2(quoteCalc.rows.reduce((s, r) => s + r.gross, 0))
    const servicesNet = round2(quoteCalc.panthely.net)
    const servicesVat = round2(quoteCalc.panthely.vat)
    const servicesGross = round2(quoteCalc.panthely.gross)
    const totalNet = round2(linesNet + servicesNet)
    const totalVat = round2(linesVat + servicesVat)
    const totalGross = round2(linesGross + servicesGross)
    const finalGross = round2(quoteCalc.totals.finalGross)

    const customerSnapshot = {
      id: customerData.id || null,
      name: customerData.name.trim(),
      email: customerData.email || portalCustomer.email || null,
      mobile: customerData.mobile || portalCustomer.mobile || null,
      discount_percent: discountPercent,
      billing_name: customerData.billing_name || null,
      billing_country: customerData.billing_country || 'Magyarország',
      billing_city: customerData.billing_city || null,
      billing_postal_code: customerData.billing_postal_code || null,
      billing_street: customerData.billing_street || null,
      billing_house_number: customerData.billing_house_number || null,
      billing_tax_number: customerData.billing_tax_number || null,
      billing_company_reg_number: customerData.billing_company_reg_number || null
    }

    const headerBase = {
      portal_customer_id: portalCustomer.id,
      target_company_id: company.id,
      status: 'draft',
      discount_percent: discountPercent,
      lines_total_net: linesNet,
      lines_total_vat: linesVat,
      lines_total_gross: linesGross,
      services_total_net: servicesNet,
      services_total_vat: servicesVat,
      services_total_gross: servicesGross,
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross,
      final_total_after_discount: finalGross,
      customer_snapshot: customerSnapshot,
      submitted_at: null,
      submitted_to_company_quote_id: null,
      updated_at: new Date().toISOString()
    }

    let savedQuoteId = quoteId || null
    let quoteNumber: string

    if (savedQuoteId) {
      const { data: existing, error: existingErr } = await supabase
        .from('portal_nettfront_quotes')
        .select('id, quote_number, status')
        .eq('id', savedQuoteId)
        .eq('portal_customer_id', portalCustomer.id)
        .maybeSingle()

      if (existingErr || !existing) {
        return NextResponse.json({ error: 'Az ajánlat nem található.' }, { status: 404 })
      }

      if (existing.status !== 'draft') {
        return NextResponse.json(
          { error: 'Csak piszkozat ajánlat szerkeszthető.' },
          { status: 400 }
        )
      }

      quoteNumber = existing.quote_number

      const { error: updErr } = await supabase
        .from('portal_nettfront_quotes')
        .update(headerBase)
        .eq('id', savedQuoteId)

      if (updErr) {
        return NextResponse.json(
          { error: 'Ajánlat frissítése sikertelen', details: updErr.message },
          { status: 500 }
        )
      }

      await supabase
        .from('portal_nettfront_quote_lines')
        .delete()
        .eq('portal_nettfront_quote_id', savedQuoteId)
    } else {
      let lastError: { message?: string; code?: string } | null = null
      let inserted: { id: string; quote_number: string } | null = null

      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: numData, error: numErr } = await supabase.rpc(
          'generate_portal_nettfront_quote_number'
        )

        if (numErr || !numData) {
          lastError = numErr
          break
        }

        const { data, error: insErr } = await supabase
          .from('portal_nettfront_quotes')
          .insert([{ ...headerBase, quote_number: numData as string }])
          .select('id, quote_number')
          .single()

        if (!insErr && data) {
          inserted = data
          break
        }

        lastError = insErr
        if (insErr?.code !== '23505') break
      }

      if (!inserted) {
        return NextResponse.json(
          {
            error: 'Ajánlat mentése sikertelen',
            details: lastError?.message || 'quote number generation failed'
          },
          { status: 500 }
        )
      }

      savedQuoteId = inserted.id
      quoteNumber = inserted.quote_number
    }

    const lineRows = inomatLines.map((line, index) => {
      const label = normalizeInomatSzin(line.szin, catalog)
      const def = getInomatColorDef(label, catalog)
      const sellNet = def?.sellNetPerSqm ?? 0
      const costNet = def?.costNetPerSqm ?? 0
      const areaSqm = (line.magassagMm * line.szelessegMm * line.mennyiseg) / 1_000_000
      const lineNet = round2(areaSqm * sellNet)
      const lineVat = round2(lineNet * NETTFRONT_VAT_RATE)
      const lineGross = round2(lineNet + lineVat)
      const holes =
        line.panthely && line.panthely.mennyiseg > 0
          ? line.panthely.mennyiseg * line.mennyiseg
          : 0

      return {
        portal_nettfront_quote_id: savedQuoteId,
        front_type: 'inomat',
        nettfront_sku_id: def?.skuId ?? null,
        sku_code: def?.id ?? label.toLowerCase().replace(/\s+/g, '-'),
        display_name: label,
        finish: def?.group ?? 'matt',
        swatch_hex: def?.swatchHex ?? null,
        cost_net_per_sqm: costNet,
        sell_net_per_sqm: sellNet,
        vat_percent: 27,
        height_mm: line.magassagMm,
        width_mm: line.szelessegMm,
        quantity: line.mennyiseg,
        area_sqm: round2(areaSqm * 1e6) / 1e6,
        line_net: lineNet,
        line_vat: lineVat,
        line_gross: lineGross,
        panthely: line.panthely,
        panthely_holes_total: holes,
        megjegyzes: line.megjegyzes ?? null,
        sort_order: index
      }
    })

    if (lineRows.some(r => r.sell_net_per_sqm <= 0)) {
      return NextResponse.json(
        { error: 'Egy vagy több tételnél hiányzik az eladási ár a katalógusból.' },
        { status: 400 }
      )
    }

    const { error: linesErr } = await supabase.from('portal_nettfront_quote_lines').insert(lineRows)

    if (linesErr) {
      return NextResponse.json(
        { error: 'Tételek mentése sikertelen', details: linesErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      quoteId: savedQuoteId,
      quoteNumber
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[nettfront-quotes] POST error:', error)
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}
