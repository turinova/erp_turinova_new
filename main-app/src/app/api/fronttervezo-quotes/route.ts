import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import { supabaseServer } from '@/lib/supabase-server'
import {
  buildInomatCatalogFromSkus,
  computeFronttervezoInomatQuote,
  getInomatColorDef,
  normalizeInomatSzin,
  type InomatQuoteLineInput,
  type NettfrontSkuRow
} from '@/lib/pricing/fronttervezoInomatQuote'
import { NETTFRONT_VAT_RATE } from '@/lib/pricing/inomatCatalog'

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

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
 * POST /api/fronttervezo-quotes
 * Mentés: draft fronttervezo ajánlat (Inomat tételek).
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

    const cookieStore = await cookies()
    const supabaseWithAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    const {
      data: { user },
      error: userError
    } = await supabaseWithAuth.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!customerData?.name?.trim()) {
      return NextResponse.json({ error: 'A megrendelő neve kötelező.' }, { status: 400 })
    }

    if (!Array.isArray(inomatLines) || inomatLines.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy Inomat tétel szükséges a mentéshez.' },
        { status: 400 }
      )
    }

    // --- Customer upsert (Opti minta) ---
    let customerId = customerData.id || null
    let shouldUpdateExisting = Boolean(customerId)
    const trimmedName = customerData.name.trim()

    if (!customerId) {
      const { data: existingCustomer, error: lookupErr } = await supabaseServer
        .from('customers')
        .select('id')
        .eq('name', trimmedName)
        .is('deleted_at', null)
        .maybeSingle()

      if (lookupErr && lookupErr.code !== 'PGRST116') {
        console.warn('[fronttervezo-quotes] customer lookup:', lookupErr)
      }

      if (existingCustomer) {
        customerId = existingCustomer.id
        shouldUpdateExisting = true
      }
    }

    const discountPercent = Number.parseFloat(String(customerData.discount_percent ?? 0)) || 0

    const customerFields = {
      name: trimmedName,
      email: customerData.email || null,
      mobile: customerData.mobile || null,
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

    if (!customerId) {
      const { data: newCustomer, error: createErr } = await supabaseServer
        .from('customers')
        .insert([customerFields])
        .select('id')
        .single()

      if (createErr) {
        if (createErr.code === '23505') {
          const { data: existing } = await supabaseServer
            .from('customers')
            .select('id')
            .eq('name', trimmedName)
            .is('deleted_at', null)
            .maybeSingle()

          if (existing) {
            customerId = existing.id
            shouldUpdateExisting = true
          } else {
            return NextResponse.json(
              { error: 'Ügyfél létrehozása sikertelen', details: createErr.message },
              { status: 409 }
            )
          }
        } else {
          return NextResponse.json(
            { error: 'Ügyfél létrehozása sikertelen', details: createErr.message },
            { status: 500 }
          )
        }
      } else {
        customerId = newCustomer.id
        shouldUpdateExisting = false
      }
    }

    if (customerId && shouldUpdateExisting) {
      const { error: updateErr } = await supabaseServer
        .from('customers')
        .update(customerFields)
        .eq('id', customerId)

      if (updateErr) {
        console.error('[fronttervezo-quotes] customer update:', updateErr)

        return NextResponse.json(
          { error: 'Ügyfél frissítése sikertelen', details: updateErr.message },
          { status: 500 }
        )
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Ügyfél azonosító hiányzik' }, { status: 500 })
    }

    // --- Catalog + quote compute ---
    const { data: skuRows, error: skuErr } = await supabaseServer
      .from('nettfront_skus')
      .select(
        'id, front_type, sku_code, display_name, finish, swatch_hex, cost_net_per_sqm, sell_net_per_sqm, is_active, sort_order'
      )
      .eq('front_type', 'inomat')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    if (skuErr) {
      console.error('[fronttervezo-quotes] nettfront_skus:', skuErr)

      return NextResponse.json(
        { error: 'Nettfront katalógus betöltése sikertelen', details: skuErr.message },
        { status: 500 }
      )
    }

    const catalog = buildInomatCatalogFromSkus((skuRows || []) as NettfrontSkuRow[])

    if (catalog.length === 0) {
      return NextResponse.json(
        {
          error:
            'Nettfront katalógus üres — nincs betölthető Inomat SKU ár. Fallback árakat nem használunk.'
        },
        { status: 500 }
      )
    }

    const { data: cuttingFee } = await supabaseServer
      .from('cutting_fees')
      .select('panthelyfuras_fee_per_hole')
      .limit(1)
      .maybeSingle()

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

    const headerPayload = {
      customer_id: customerId,
      status: 'draft' as const,
      source: 'internal' as const,
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
      payment_status: 'not_paid' as const,
      updated_at: new Date().toISOString()
    }

    let savedQuoteId = quoteId || null
    let quoteNumber: string

    if (savedQuoteId) {
      const { data: existing, error: existingErr } = await supabaseServer
        .from('fronttervezo_quotes')
        .select('id, quote_number, status, deleted_at')
        .eq('id', savedQuoteId)
        .maybeSingle()

      if (existingErr || !existing || existing.deleted_at) {
        return NextResponse.json({ error: 'Az ajánlat nem található.' }, { status: 404 })
      }

      if (existing.status !== 'draft') {
        return NextResponse.json(
          { error: 'Csak piszkozat ajánlat szerkeszthető.' },
          { status: 400 }
        )
      }

      quoteNumber = existing.quote_number

      const { error: updErr } = await supabaseServer
        .from('fronttervezo_quotes')
        .update(headerPayload)
        .eq('id', savedQuoteId)

      if (updErr) {
        console.error('[fronttervezo-quotes] update header:', updErr)

        return NextResponse.json(
          { error: 'Ajánlat frissítése sikertelen', details: updErr.message },
          { status: 500 }
        )
      }

      await supabaseServer.from('fronttervezo_quote_lines').delete().eq('quote_id', savedQuoteId)
      await supabaseServer.from('fronttervezo_quote_sku_summary').delete().eq('quote_id', savedQuoteId)
      await supabaseServer.from('fronttervezo_quote_services').delete().eq('quote_id', savedQuoteId)
    } else {
      const { data: numData, error: numErr } = await supabaseServer.rpc(
        'generate_fronttervezo_quote_number'
      )

      if (numErr || !numData) {
        console.error('[fronttervezo-quotes] quote number:', numErr)

        return NextResponse.json(
          { error: 'Ajánlatszám generálása sikertelen', details: numErr?.message },
          { status: 500 }
        )
      }

      quoteNumber = numData as string

      const { data: inserted, error: insErr } = await supabaseServer
        .from('fronttervezo_quotes')
        .insert([
          {
            ...headerPayload,
            quote_number: quoteNumber,
            created_by: user.id
          }
        ])
        .select('id, quote_number')
        .single()

      if (insErr || !inserted) {
        console.error('[fronttervezo-quotes] insert header:', insErr)

        return NextResponse.json(
          { error: 'Ajánlat mentése sikertelen', details: insErr?.message },
          { status: 500 }
        )
      }

      savedQuoteId = inserted.id
    }

    // --- Lines ---
    const lineRows = inomatLines.map((line, index) => {
      const label = normalizeInomatSzin(line.szin, catalog)
      const def = getInomatColorDef(label, catalog)
      const sellNet = def?.sellNetPerSqm ?? 35000
      const costNet = def?.costNetPerSqm ?? 25000
      const areaSqm = (line.magassagMm * line.szelessegMm * line.mennyiseg) / 1_000_000
      const lineNet = round2(areaSqm * sellNet)
      const lineVat = round2(lineNet * NETTFRONT_VAT_RATE)
      const lineGross = round2(lineNet + lineVat)
      const holes =
        line.panthely && line.panthely.mennyiseg > 0
          ? line.panthely.mennyiseg * line.mennyiseg
          : 0

      return {
        quote_id: savedQuoteId,
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

    const { error: linesErr } = await supabaseServer.from('fronttervezo_quote_lines').insert(lineRows)

    if (linesErr) {
      console.error('[fronttervezo-quotes] lines:', linesErr)

      return NextResponse.json(
        { error: 'Tételek mentése sikertelen', details: linesErr.message },
        { status: 500 }
      )
    }

    // --- SKU summary ---
    const summaryRows = quoteCalc.rows.map(r => {
      const def = getInomatColorDef(r.szin, catalog)
      const costTotal = round2((def?.costNetPerSqm ?? 25000) * r.sqm)

      return {
        quote_id: savedQuoteId,
        front_type: 'inomat',
        nettfront_sku_id: def?.skuId ?? null,
        sku_code: def?.id ?? r.szin.toLowerCase().replace(/\s+/g, '-'),
        display_name: r.szin,
        finish: def?.group ?? 'matt',
        panels_db: r.panelsDb,
        total_sqm: r.sqm,
        sell_net_per_sqm: def?.sellNetPerSqm ?? 35000,
        cost_net_total: costTotal,
        net: round2(r.net),
        vat: round2(r.vat),
        gross: round2(r.gross)
      }
    })

    const { error: sumErr } = await supabaseServer
      .from('fronttervezo_quote_sku_summary')
      .insert(summaryRows)

    if (sumErr) {
      console.error('[fronttervezo-quotes] sku summary:', sumErr)

      return NextResponse.json(
        { error: 'Összesítő mentése sikertelen', details: sumErr.message },
        { status: 500 }
      )
    }

    // --- Services (panthely) ---
    if (quoteCalc.panthely.holesDb > 0) {
      const unitNet = cuttingFee?.panthelyfuras_fee_per_hole ?? 50
      const { error: svcErr } = await supabaseServer.from('fronttervezo_quote_services').insert([
        {
          quote_id: savedQuoteId,
          service_type: 'panthelyfuras',
          quantity: quoteCalc.panthely.holesDb,
          unit_price_net: unitNet,
          vat_percent: 27,
          net: servicesNet,
          vat: servicesVat,
          gross: servicesGross
        }
      ])

      if (svcErr) {
        console.error('[fronttervezo-quotes] services:', svcErr)

        return NextResponse.json(
          { error: 'Szolgáltatások mentése sikertelen', details: svcErr.message },
          { status: 500 }
        )
      }
    }

    const { recalculateFronttervezoQuoteTotals } = await import(
      '@/lib/fronttervezo-quote-totals'
    )
    await recalculateFronttervezoQuoteTotals(savedQuoteId)

    const { data: refreshed } = await supabaseServer
      .from('fronttervezo_quotes')
      .select('final_total_after_discount')
      .eq('id', savedQuoteId)
      .single()

    return NextResponse.json({
      success: true,
      id: savedQuoteId,
      quote_number: quoteNumber,
      customer_id: customerId,
      final_total_after_discount: refreshed?.final_total_after_discount ?? finalGross
    })
  } catch (error: unknown) {
    console.error('[fronttervezo-quotes] POST:', error)

    return NextResponse.json(
      {
        error: 'Váratlan hiba az ajánlat mentésekor',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
