import { NextRequest, NextResponse } from 'next/server'

import { persistBuiltCustomerQuote } from '@/lib/persist-customer-quote'
import { touchPortalCustomerQuotePdf } from '@/lib/supabase-server'

import { buildEmptyCustomerFacingHtml } from './build-html'

const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('[Ügyfélajánlat empty PDF] Starting...')

  try {
    const body = await request.json().catch(() => ({}))
    const built = await buildEmptyCustomerFacingHtml(body, { preview: false })
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: built.status })
    }

    let browser
    try {
      if (isProduction) {
        const puppeteerCore = await import('puppeteer-core')
        const chromium = await import('@sparticuz/chromium')
        const cr = chromium.default as unknown as {
          args: string[]
          defaultViewport: unknown
          executablePath: () => Promise<string>
          headless: boolean | 'shell'
        }
        browser = await puppeteerCore.default.launch({
          args: [...cr.args, '--disable-dev-shm-usage', '--no-sandbox'],
          defaultViewport: cr.defaultViewport as never,
          executablePath: await cr.executablePath(),
          headless: cr.headless
        })
      } else {
        const puppeteer = await import('puppeteer')
        browser = await puppeteer.default.launch({
          headless: true,
          args: ['--disable-dev-shm-usage', '--no-sandbox']
        })
      }
    } catch (puppeteerError: unknown) {
      const msg = puppeteerError instanceof Error ? puppeteerError.message : 'ismeretlen'
      console.error('[Ügyfélajánlat empty PDF] Puppeteer error:', puppeteerError)
      return NextResponse.json({ error: `Puppeteer hiba: ${msg}` }, { status: 500 })
    }

    let pdfBuffer: Buffer
    try {
      const page = await browser.newPage()
      await page.setJavaScriptEnabled(false)
      await page.setRequestInterception(true)
      page.on('request', req => req.abort())
      await page.setContent(built.html, { waitUntil: 'domcontentloaded' })
      await new Promise(resolve => setTimeout(resolve, 50))
      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        scale: 1,
        margin: { top: '8mm', right: '4mm', bottom: '8mm', left: '4mm' }
      })
      pdfBuffer = Buffer.from(pdfBytes)
      await browser.close()
    } catch (pdfError: unknown) {
      const msg = pdfError instanceof Error ? pdfError.message : 'ismeretlen'
      console.error('[Ügyfélajánlat empty PDF] PDF error:', pdfError)
      try {
        await browser?.close()
      } catch {
        /* ignore */
      }
      return NextResponse.json({ error: `PDF generálási hiba: ${msg}` }, { status: 500 })
    }

    console.log(
      `[Ügyfélajánlat empty PDF] Done in ${Date.now() - startTime}ms, ${pdfBuffer.length} bytes`
    )

    let savedId = built.customerQuoteId
    let saveWarning: string | null = null

    if (built.fromSnapshot && built.customerQuoteId) {
      await touchPortalCustomerQuotePdf(built.customerQuoteId, built.portalCustomerId)
      savedId = built.customerQuoteId
    } else if (!built.fromSnapshot) {
      const saved = await persistBuiltCustomerQuote(body, built)
      if (!saved.ok) {
        console.error('[Ügyfélajánlat empty PDF] Save error:', saved.error)
        saveWarning = saved.error
      } else {
        savedId = saved.id
      }
    }

    const expose = ['X-Customer-Quote-Id', 'X-Quote-Number']
    if (saveWarning) expose.push('X-Save-Warning')

    const headers: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Ugyfelajanlat-${built.quoteNumber}.pdf"`,
      'Cache-Control': 'no-store',
      'Access-Control-Expose-Headers': expose.join(', ')
    }
    if (savedId) {
      headers['X-Customer-Quote-Id'] = savedId
      headers['X-Quote-Number'] = built.quoteNumber
    }
    if (saveWarning) {
      headers['X-Save-Warning'] = encodeURIComponent(saveWarning.slice(0, 200))
    }

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'PDF generálás sikertelen'
    console.error('[Ügyfélajánlat empty PDF] Unexpected error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
