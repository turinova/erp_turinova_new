import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { getPortalAuthContext, round2 } from '@/lib/nettfront-portal-auth'

const CUSTOMER_PORTAL_SYSTEM_USER_ID = 'c0000000-0000-0000-0000-000000000001'

async function findOrCreateTenantCustomer(
  companySupabase: any,
  snap: {
    name?: string | null
    email?: string | null
    mobile?: string | null
    discount_percent?: number | null
    billing_name?: string | null
    billing_country?: string | null
    billing_city?: string | null
    billing_postal_code?: string | null
    billing_street?: string | null
    billing_house_number?: string | null
    billing_tax_number?: string | null
    billing_company_reg_number?: string | null
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const email = (snap.email || '').trim().toLowerCase()
  const baseName = (snap.name || 'Online ügyfél').trim()

  if (email) {
    const { data: byEmail } = await companySupabase
      .from('customers')
      .select('id, deleted_at')
      .ilike('email', email)
      .limit(5)

    const active = byEmail?.find((r: { deleted_at: string | null; id: string }) => !r.deleted_at)
    if (active) return { ok: true, id: active.id }

    const deleted = byEmail?.find((r: { deleted_at: string | null; id: string }) => r.deleted_at)
    if (deleted) {
      await companySupabase
        .from('customers')
        .update({
          deleted_at: null,
          name: baseName,
          mobile: snap.mobile || '',
          billing_name: snap.billing_name || '',
          billing_country: snap.billing_country || 'Magyarország',
          billing_city: snap.billing_city || '',
          billing_postal_code: snap.billing_postal_code || '',
          billing_street: snap.billing_street || '',
          billing_house_number: snap.billing_house_number || '',
          billing_tax_number: snap.billing_tax_number || '',
          billing_company_reg_number: snap.billing_company_reg_number || ''
        })
        .eq('id', deleted.id)
      return { ok: true, id: deleted.id }
    }
  }

  const name = `${baseName} - online`
  const { data: created, error } = await companySupabase
    .from('customers')
    .insert([
      {
        name,
        email: email || null,
        mobile: snap.mobile || '',
        discount_percent: snap.discount_percent || 0,
        billing_name: snap.billing_name || '',
        billing_country: snap.billing_country || 'Magyarország',
        billing_city: snap.billing_city || '',
        billing_postal_code: snap.billing_postal_code || '',
        billing_street: snap.billing_street || '',
        billing_house_number: snap.billing_house_number || '',
        billing_tax_number: snap.billing_tax_number || '',
        billing_company_reg_number: snap.billing_company_reg_number || ''
      }
    ])
    .select('id')
    .single()

  if (error || !created) {
    // name conflict → timestamp suffix
    const { data: fallback, error: fbErr } = await companySupabase
      .from('customers')
      .insert([
        {
          name: `${baseName} - online ${Date.now()}`,
          email: email || null,
          mobile: snap.mobile || '',
          discount_percent: snap.discount_percent || 0,
          billing_name: snap.billing_name || '',
          billing_country: snap.billing_country || 'Magyarország',
          billing_city: snap.billing_city || '',
          billing_postal_code: snap.billing_postal_code || '',
          billing_street: snap.billing_street || '',
          billing_house_number: snap.billing_house_number || '',
          billing_tax_number: snap.billing_tax_number || '',
          billing_company_reg_number: snap.billing_company_reg_number || ''
        }
      ])
      .select('id')
      .single()

    if (fbErr || !fallback) {
      return { ok: false, error: error?.message || fbErr?.message || 'Customer create failed' }
    }
    return { ok: true, id: fallback.id }
  }

  return { ok: true, id: created.id }
}

/**
 * POST /api/nettfront-quotes/submit
 * Portal draft → tenant fronttervezo_quotes as status=draft, source=customer_portal
 * Body: { quoteId, paymentMethodId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { quoteId, paymentMethodId } = body

    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID is required' }, { status: 400 })
    }
    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 })
    }

    const ctx = await getPortalAuthContext()
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const { supabase, portalCustomer } = ctx

    const { data: portalQuote, error: quoteError } = await supabase
      .from('portal_nettfront_quotes')
      .select(
        `
        *,
        companies!inner (id, name, supabase_url, supabase_anon_key)
      `
      )
      .eq('id', quoteId)
      .eq('portal_customer_id', portalCustomer.id)
      .eq('status', 'draft')
      .single()

    if (quoteError || !portalQuote) {
      return NextResponse.json(
        { error: 'Quote not found or already submitted' },
        { status: 404 }
      )
    }

    const { data: lines, error: linesError } = await supabase
      .from('portal_nettfront_quote_lines')
      .select('*')
      .eq('portal_nettfront_quote_id', quoteId)
      .order('sort_order', { ascending: true })

    if (linesError || !lines?.length) {
      return NextResponse.json({ error: 'Quote has no lines' }, { status: 400 })
    }

    const company = portalQuote.companies
    const companySupabase = createClient(company.supabase_url, company.supabase_anon_key)

    const snap =
      (portalQuote.customer_snapshot as Record<string, unknown> | null) ||
      ({
        name: portalCustomer.name,
        email: portalCustomer.email,
        mobile: portalCustomer.mobile,
        discount_percent: portalCustomer.discount_percent,
        billing_name: portalCustomer.billing_name,
        billing_country: portalCustomer.billing_country,
        billing_city: portalCustomer.billing_city,
        billing_postal_code: portalCustomer.billing_postal_code,
        billing_street: portalCustomer.billing_street,
        billing_house_number: portalCustomer.billing_house_number,
        billing_tax_number: portalCustomer.billing_tax_number,
        billing_company_reg_number: portalCustomer.billing_company_reg_number
      } as Record<string, unknown>)

    const customerResult = await findOrCreateTenantCustomer(companySupabase, {
      name: (snap.name as string) || portalCustomer.name,
      email: (snap.email as string) || portalCustomer.email,
      mobile: (snap.mobile as string) || portalCustomer.mobile,
      discount_percent: Number(snap.discount_percent ?? portalQuote.discount_percent) || 0,
      billing_name: snap.billing_name as string,
      billing_country: snap.billing_country as string,
      billing_city: snap.billing_city as string,
      billing_postal_code: snap.billing_postal_code as string,
      billing_street: snap.billing_street as string,
      billing_house_number: snap.billing_house_number as string,
      billing_tax_number: snap.billing_tax_number as string,
      billing_company_reg_number: snap.billing_company_reg_number as string
    })

    if (!customerResult.ok) {
      return NextResponse.json(
        { error: 'Failed to create customer in company database', details: customerResult.error },
        { status: 500 }
      )
    }

    const { data: ftQuoteNumber, error: genError } = await companySupabase.rpc(
      'generate_fronttervezo_quote_number'
    )

    if (genError || !ftQuoteNumber) {
      return NextResponse.json(
        {
          error: 'Failed to generate Fronttervező quote number',
          details: genError?.message || 'RPC missing — run fronttervezo migrations on tenant DB'
        },
        { status: 500 }
      )
    }

    const { data: companyQuote, error: companyQuoteError } = await companySupabase
      .from('fronttervezo_quotes')
      .insert([
        {
          customer_id: customerResult.id,
          quote_number: ftQuoteNumber,
          status: 'draft',
          source: 'customer_portal',
          payment_method_id: paymentMethodId,
          comment: portalQuote.comment || null,
          discount_percent: portalQuote.discount_percent,
          lines_total_net: portalQuote.lines_total_net,
          lines_total_vat: portalQuote.lines_total_vat,
          lines_total_gross: portalQuote.lines_total_gross,
          services_total_net: portalQuote.services_total_net,
          services_total_vat: portalQuote.services_total_vat,
          services_total_gross: portalQuote.services_total_gross,
          fees_total_net: 0,
          fees_total_vat: 0,
          fees_total_gross: 0,
          total_net: portalQuote.total_net,
          total_vat: portalQuote.total_vat,
          total_gross: portalQuote.total_gross,
          final_total_after_discount: portalQuote.final_total_after_discount,
          payment_status: 'not_paid',
          created_by: CUSTOMER_PORTAL_SYSTEM_USER_ID
        }
      ])
      .select('id, quote_number')
      .single()

    if (companyQuoteError || !companyQuote) {
      console.error('[nettfront submit] fronttervezo_quotes insert:', companyQuoteError)
      return NextResponse.json(
        {
          error: 'Failed to create quote in company database',
          details: companyQuoteError?.message
        },
        { status: 500 }
      )
    }

    const tenantLines = lines.map(line => ({
      quote_id: companyQuote.id,
      front_type: line.front_type,
      nettfront_sku_id: line.nettfront_sku_id,
      sku_code: line.sku_code,
      display_name: line.display_name,
      finish: line.finish,
      swatch_hex: line.swatch_hex,
      cost_net_per_sqm: line.cost_net_per_sqm,
      sell_net_per_sqm: line.sell_net_per_sqm,
      vat_percent: line.vat_percent,
      height_mm: line.height_mm,
      width_mm: line.width_mm,
      quantity: line.quantity,
      area_sqm: line.area_sqm,
      line_net: line.line_net,
      line_vat: line.line_vat,
      line_gross: line.line_gross,
      panthely: line.panthely,
      panthely_holes_total: line.panthely_holes_total,
      megjegyzes: line.megjegyzes,
      sort_order: line.sort_order
    }))

    const { error: tenantLinesErr } = await companySupabase
      .from('fronttervezo_quote_lines')
      .insert(tenantLines)

    if (tenantLinesErr) {
      console.error('[nettfront submit] lines:', tenantLinesErr)
      return NextResponse.json(
        { error: 'Failed to copy lines', details: tenantLinesErr.message },
        { status: 500 }
      )
    }

    // SKU summary rollup by display_name
    const bySku = new Map<
      string,
      {
        front_type: string
        nettfront_sku_id: string | null
        sku_code: string
        display_name: string
        finish: string | null
        panels_db: number
        total_sqm: number
        sell_net_per_sqm: number
        cost_net_total: number
        net: number
        vat: number
        gross: number
      }
    >()

    for (const line of lines) {
      const key = `${line.front_type}:${line.sku_code}`
      const prev = bySku.get(key)
      const area = Number(line.area_sqm) || 0
      const cost = round2(Number(line.cost_net_per_sqm) * area)
      if (!prev) {
        bySku.set(key, {
          front_type: line.front_type,
          nettfront_sku_id: line.nettfront_sku_id,
          sku_code: line.sku_code,
          display_name: line.display_name,
          finish: line.finish,
          panels_db: line.quantity,
          total_sqm: area,
          sell_net_per_sqm: Number(line.sell_net_per_sqm),
          cost_net_total: cost,
          net: Number(line.line_net),
          vat: Number(line.line_vat),
          gross: Number(line.line_gross)
        })
      } else {
        prev.panels_db += line.quantity
        prev.total_sqm += area
        prev.cost_net_total = round2(prev.cost_net_total + cost)
        prev.net = round2(prev.net + Number(line.line_net))
        prev.vat = round2(prev.vat + Number(line.line_vat))
        prev.gross = round2(prev.gross + Number(line.line_gross))
      }
    }

    const summaryRows = Array.from(bySku.values()).map(r => ({
      quote_id: companyQuote.id,
      ...r
    }))

    const { error: sumErr } = await companySupabase
      .from('fronttervezo_quote_sku_summary')
      .insert(summaryRows)

    if (sumErr) {
      console.warn('[nettfront submit] sku summary:', sumErr)
    }

    const totalHoles = lines.reduce((s, l) => s + (Number(l.panthely_holes_total) || 0), 0)
    if (totalHoles > 0 && Number(portalQuote.services_total_net) > 0) {
      const unitNet = round2(Number(portalQuote.services_total_net) / totalHoles)
      await companySupabase.from('fronttervezo_quote_services').insert([
        {
          quote_id: companyQuote.id,
          service_type: 'panthelyfuras',
          quantity: totalHoles,
          unit_price_net: unitNet,
          vat_percent: 27,
          net: portalQuote.services_total_net,
          vat: portalQuote.services_total_vat,
          gross: portalQuote.services_total_gross
        }
      ])
    }

    const { error: portalUpdErr } = await supabase
      .from('portal_nettfront_quotes')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        submitted_to_company_quote_id: companyQuote.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId)
      .eq('portal_customer_id', portalCustomer.id)

    if (portalUpdErr) {
      return NextResponse.json(
        { error: 'Tenant quote created but portal update failed', details: portalUpdErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      companyQuoteId: companyQuote.id,
      companyQuoteNumber: companyQuote.quote_number,
      portalQuoteNumber: portalQuote.quote_number
    })
  } catch (error: unknown) {
    console.error('[nettfront submit]', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
