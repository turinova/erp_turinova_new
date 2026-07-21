import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

import { getPortalNettfrontQuoteById } from '@/lib/supabase-server'
import { getCompanyInfo } from '@/lib/company-data-server'

import generateFronttervezoQuotePdfHtml from './pdf-template'

const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || id === 'new') {
      return NextResponse.json({ error: 'Érvénytelen árajánlat azonosító' }, { status: 400 })
    }

    const quote = await getPortalNettfrontQuoteById(id)
    if (!quote) {
      return NextResponse.json({ error: 'Árajánlat nem található' }, { status: 404 })
    }

    if (!quote.companies?.supabase_url || !quote.companies?.supabase_anon_key) {
      return NextResponse.json({ error: 'Cégadatok nem találhatók' }, { status: 500 })
    }

    const tenantCompany = await getCompanyInfo({
      supabase_url: quote.companies.supabase_url,
      supabase_anon_key: quote.companies.supabase_anon_key
    })

    if (!tenantCompany) {
      return NextResponse.json({ error: 'Cégadatok nem találhatók' }, { status: 500 })
    }

    const lines = quote.lines || []

    // SKU summary rollup (same as detail UI / main-app)
    const bySku = new Map<
      string,
      {
        id: string
        display_name: string
        finish: string | null
        front_type: string
        panels_db: number
        total_sqm: number
        sell_net_per_sqm: number
        net: number
        vat: number
        gross: number
      }
    >()

    for (const line of lines) {
      const key = `${line.front_type || 'inomat'}:${line.sku_code || line.display_name}`
      const prev = bySku.get(key)
      const area = Number(line.area_sqm) || 0
      if (!prev) {
        bySku.set(key, {
          id: key,
          display_name: line.display_name,
          finish: line.finish,
          front_type: line.front_type || 'inomat',
          panels_db: Number(line.quantity) || 0,
          total_sqm: area,
          sell_net_per_sqm: Number(line.sell_net_per_sqm) || 0,
          net: Number(line.line_net) || 0,
          vat: Number(line.line_vat) || 0,
          gross: Number(line.line_gross) || 0
        })
      } else {
        prev.panels_db += Number(line.quantity) || 0
        prev.total_sqm = round2(prev.total_sqm + area)
        prev.net = round2(prev.net + Number(line.line_net))
        prev.vat = round2(prev.vat + Number(line.line_vat))
        prev.gross = round2(prev.gross + Number(line.line_gross))
      }
    }

    const sku_summary = Array.from(bySku.values())

    const totalHoles = lines.reduce((s, l) => s + (Number(l.panthely_holes_total) || 0), 0)
    const services =
      totalHoles > 0 && Number(quote.services_total_gross) > 0
        ? [
            {
              id: 'panthely',
              service_type: 'panthelyfuras',
              quantity: totalHoles,
              unit_price_net:
                totalHoles > 0
                  ? round2(Number(quote.services_total_net) / totalHoles)
                  : 0,
              net: Number(quote.services_total_net) || 0,
              vat: Number(quote.services_total_vat) || 0,
              gross: Number(quote.services_total_gross) || 0
            }
          ]
        : []

    const snap = (quote.customer_snapshot || {}) as Record<string, string | null>
    const pc = quote.portal_customers

    const customer = {
      name: String(snap.name || pc?.name || ''),
      email: String(snap.email || pc?.email || ''),
      mobile: String(snap.mobile || pc?.mobile || ''),
      billing_name: String(snap.billing_name || pc?.billing_name || snap.name || pc?.name || ''),
      billing_country: String(snap.billing_country || pc?.billing_country || 'Magyarország'),
      billing_city: String(snap.billing_city || pc?.billing_city || ''),
      billing_postal_code: String(snap.billing_postal_code || pc?.billing_postal_code || ''),
      billing_street: String(snap.billing_street || pc?.billing_street || ''),
      billing_house_number: String(snap.billing_house_number || pc?.billing_house_number || ''),
      billing_tax_number: String(snap.billing_tax_number || pc?.billing_tax_number || '')
    }

    // Same discount logic as main-app Fronttervező PDF
    const frontGross =
      (Number(quote.lines_total_gross) || 0) + (Number(quote.services_total_gross) || 0)
    const feesGross = 0
    const feesGrossPositive = Math.max(0, feesGross)
    const feesGrossNegative = Math.min(0, feesGross)
    const subtotalBeforeDiscount = frontGross + feesGrossPositive

    const discountPercent = Number(quote.discount_percent) || 0
    const discountAmount = subtotalBeforeDiscount * (discountPercent / 100)
    const totalGrossAfterDiscount = subtotalBeforeDiscount - discountAmount + feesGrossNegative

    const frontNet =
      (Number(quote.lines_total_net) || 0) + (Number(quote.services_total_net) || 0)
    const frontVat =
      (Number(quote.lines_total_vat) || 0) + (Number(quote.services_total_vat) || 0)
    const totalNetBeforeDiscount = frontNet
    const totalVatBeforeDiscount = frontVat
    const totalGrossBeforeDiscount = frontGross

    const discountRatio =
      totalGrossBeforeDiscount > 0 ? discountAmount / totalGrossBeforeDiscount : 0
    const totalNetAfterDiscount = Math.round(totalNetBeforeDiscount * (1 - discountRatio))
    const totalVatAfterDiscount = totalGrossAfterDiscount - totalNetAfterDiscount

    const summary = {
      totalNetBeforeDiscount: Math.round(totalNetBeforeDiscount),
      totalVatBeforeDiscount: Math.round(totalVatBeforeDiscount),
      totalGrossBeforeDiscount: Math.round(totalGrossBeforeDiscount),
      totalNetAfterDiscount,
      totalVatAfterDiscount: Math.round(totalVatAfterDiscount),
      totalGrossAfterDiscount: Math.round(totalGrossAfterDiscount)
    }

    const [tenantCompanyLogoBase64, turinovaLogoBase64] = await Promise.all([
      tenantCompany.logo_url
        ? fetch(tenantCompany.logo_url)
            .then(res => {
              if (res.ok) {
                return res.arrayBuffer().then(buf => Buffer.from(buf).toString('base64'))
              }
              return ''
            })
            .catch(() => '')
        : Promise.resolve(''),
      readFile(join(process.cwd(), 'public', 'images', 'turinova-logo.png'))
        .then(buf => buf.toString('base64'))
        .catch(() => '')
    ])

    const fullHtml = generateFronttervezoQuotePdfHtml({
      quote: {
        id: quote.id,
        quote_number: quote.quote_number,
        order_number: null,
        barcode: null,
        created_at: quote.created_at,
        comment: quote.comment,
        customer,
        sku_summary,
        services,
        fees: [],
        lines: lines.map(l => ({
          id: l.id,
          display_name: l.display_name,
          finish: l.finish,
          height_mm: l.height_mm,
          width_mm: l.width_mm,
          quantity: l.quantity,
          panthely_holes_total: l.panthely_holes_total,
          megjegyzes: l.megjegyzes
        }))
      },
      tenantCompany: {
        name: tenantCompany.name,
        country: tenantCompany.country,
        city: tenantCompany.city,
        postal_code: tenantCompany.postal_code,
        address: tenantCompany.address,
        tax_number: tenantCompany.tax_number
      },
      summary,
      discountAmount,
      discountPercentage: discountPercent,
      tenantCompanyLogoBase64,
      turinovaLogoBase64
    })

    let browser
    try {
      if (isProduction) {
        const puppeteerCore = await import('puppeteer-core')
        const chromium = await import('@sparticuz/chromium')
        browser = await puppeteerCore.default.launch({
          args: [
            ...chromium.default.args,
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-ipc-flooding-protection',
            '--disable-hang-monitor',
            '--disable-prompt-on-repost',
            '--disable-sync',
            '--disable-translate',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-first-run',
            '--safebrowsing-disable-auto-update',
            '--enable-automation',
            '--password-store=basic',
            '--use-mock-keychain'
          ],
          defaultViewport: chromium.default.defaultViewport,
          executablePath: await chromium.default.executablePath(),
          headless: chromium.default.headless
        })
      } else {
        const puppeteer = await import('puppeteer')
        browser = await puppeteer.default.launch({
          headless: true,
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--no-sandbox'
          ]
        })
      }

      const page = await browser.newPage()
      await page.setJavaScriptEnabled(false)
      await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 30000 })
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        preferCSSPageSize: true
      })

      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Nettfront-${quote.quote_number}.pdf"`
        }
      })
    } finally {
      if (browser) {
        try {
          await browser.close()
        } catch {
          /* ignore */
        }
      }
    }
  } catch (error: unknown) {
    console.error('[nettfront pdf]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PDF hiba' },
      { status: 500 }
    )
  }
}
