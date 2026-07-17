import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

import { getFronttervezoQuoteById, getTenantCompany, getAllVatRates } from '@/lib/supabase-server'

import generateFronttervezoQuotePdfHtml from '../pdf-template'

const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

async function getCachedTenantCompany() {
  const key = 'tenant_company'
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as Awaited<ReturnType<typeof getTenantCompany>>
  }
  const data = await getTenantCompany()
  if (data) {
    cache.set(key, { data, timestamp: Date.now() })
  }
  return data
}

async function getCachedVatRates() {
  const key = 'vat_rates'
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  const data = await getAllVatRates()
  cache.set(key, { data, timestamp: Date.now() })
  return data
}

function sanitizeFilenamePart(name: string): string {
  return name
    .trim()
    .replace(/[^\w\-áéíóöőúüűÁÉÍÓÖŐÚÜŰ.]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80)
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

    const [quoteData, tenantCompany, vatRates] = await Promise.all([
      getFronttervezoQuoteById(id),
      getCachedTenantCompany(),
      getCachedVatRates()
    ])

    if (!quoteData) {
      return NextResponse.json({ error: 'Árajánlat nem található' }, { status: 404 })
    }

    if (!tenantCompany) {
      return NextResponse.json({ error: 'Cégadatok nem találhatók' }, { status: 500 })
    }

    void vatRates

    // Same discount logic as fronttervezo detail / Opti
    const frontGross =
      (Number(quoteData.lines_total_gross) || 0) + (Number(quoteData.services_total_gross) || 0)
    const feesGross = Number(quoteData.fees_total_gross) || 0
    const feesGrossPositive = Math.max(0, feesGross)
    const feesGrossNegative = Math.min(0, feesGross)
    const subtotalBeforeDiscount = frontGross + feesGrossPositive

    const discountPercent = Number(quoteData.discount_percent) || 0
    const discountAmount = subtotalBeforeDiscount * (discountPercent / 100)
    const totalGrossAfterDiscount = subtotalBeforeDiscount - discountAmount + feesGrossNegative

    const frontNet =
      (Number(quoteData.lines_total_net) || 0) + (Number(quoteData.services_total_net) || 0)
    const frontVat =
      (Number(quoteData.lines_total_vat) || 0) + (Number(quoteData.services_total_vat) || 0)
    const feesNet = Number(quoteData.fees_total_net) || 0
    const feesVat = Number(quoteData.fees_total_vat) || 0

    const totalNetBeforeDiscount = frontNet + feesNet
    const totalVatBeforeDiscount = frontVat + feesVat
    const totalGrossBeforeDiscount = frontGross + feesGross

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
        id: quoteData.id,
        quote_number: quoteData.quote_number,
        order_number: quoteData.order_number || null,
        barcode: quoteData.barcode || null,
        created_at: quoteData.created_at,
        comment: quoteData.comment,
        customer: quoteData.customer,
        sku_summary: quoteData.sku_summary || [],
        services: quoteData.services || [],
        fees: quoteData.fees || [],
        lines: quoteData.lines || []
      },
      tenantCompany,
      summary,
      discountAmount,
      discountPercentage: discountPercent,
      tenantCompanyLogoBase64,
      turinovaLogoBase64
    })

    let browser

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
        args: ['--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions', '--no-sandbox']
      })
    }

    const hasBarcode = Boolean(quoteData.barcode)
    const page = await browser.newPage()
    await page.setJavaScriptEnabled(hasBarcode)
    await page.setRequestInterception(true)
    page.on('request', req => {
      if (hasBarcode && req.url().includes('jsdelivr.net')) {
        req.continue()
        return
      }
      req.abort()
    })

    await page.setContent(fullHtml, {
      waitUntil: hasBarcode ? 'networkidle0' : 'domcontentloaded'
    })

    if (hasBarcode) {
      try {
        await page.waitForFunction(
          (barcodeId: string) => {
            const svg = document.getElementById(barcodeId)
            return Boolean(svg && svg.children.length > 0)
          },
          { timeout: 5000 },
          `barcode-${quoteData.id}`
        )
      } catch {
        console.warn('[fronttervezo pdf] barcode render timeout, continuing')
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      scale: 1,
      margin: {
        top: '8mm',
        right: '4mm',
        bottom: '8mm',
        left: '4mm'
      }
    })

    await browser.close()

    const customerName =
      quoteData.customer?.billing_name || quoteData.customer?.name || quoteData.quote_number
    const filename = `NETT-FQ-${sanitizeFilenamePart(customerName)}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error: unknown) {
    console.error('[fronttervezo pdf]', error)
    return NextResponse.json(
      {
        error:
          'Hiba történt a PDF generálása során: ' +
          (error instanceof Error ? error.message : 'Ismeretlen hiba')
      },
      { status: 500 }
    )
  }
}
