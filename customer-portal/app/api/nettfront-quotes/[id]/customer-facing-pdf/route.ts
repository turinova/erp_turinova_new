import { NextRequest, NextResponse } from 'next/server'
import { buildNettfrontCustomerFacingHtml } from './build-html'

const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  console.log('[Nettfront customer-facing PDF] Starting...')

  try {
    const { id } = await params
    if (!id || id === 'new') {
      return NextResponse.json({ error: 'Érvénytelen árajánlat azonosító' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const built = await buildNettfrontCustomerFacingHtml(id, body, { preview: false })
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: built.status })
    }

    let browser
    try {
      if (isProduction) {
        const puppeteerCore = await import('puppeteer-core')
        const chromium = await import('@sparticuz/chromium')
        browser = await puppeteerCore.default.launch({
          args: [...chromium.default.args, '--disable-dev-shm-usage', '--no-sandbox'],
          defaultViewport: chromium.default.defaultViewport,
          executablePath: await chromium.default.executablePath(),
          headless: chromium.default.headless
        })
      } else {
        const puppeteer = await import('puppeteer')
        browser = await puppeteer.default.launch({
          headless: true,
          args: ['--disable-dev-shm-usage', '--no-sandbox']
        })
      }
    } catch (puppeteerError: any) {
      console.error('[Nettfront customer-facing PDF] Puppeteer error:', puppeteerError)
      return NextResponse.json(
        { error: `Puppeteer hiba: ${puppeteerError.message || 'ismeretlen'}` },
        { status: 500 }
      )
    }

    let pdfBuffer: Buffer
    try {
      const page = await browser.newPage()
      await page.setJavaScriptEnabled(false)
      await page.setRequestInterception(true)
      page.on('request', req => req.abort())
      await page.setContent(built.html, { waitUntil: 'domcontentloaded' })
      await new Promise(resolve => setTimeout(resolve, 50))
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        scale: 1,
        margin: { top: '8mm', right: '4mm', bottom: '8mm', left: '4mm' }
      })
      await browser.close()
    } catch (pdfError: any) {
      console.error('[Nettfront customer-facing PDF] PDF error:', pdfError)
      try {
        await browser?.close()
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        { error: `PDF generálási hiba: ${pdfError.message || 'ismeretlen'}` },
        { status: 500 }
      )
    }

    console.log(
      `[Nettfront customer-facing PDF] Done in ${Date.now() - startTime}ms, ${pdfBuffer.length} bytes`
    )

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Ugyfelajanlat-${built.quoteNumber}.pdf"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (error: any) {
    console.error('[Nettfront customer-facing PDF] Unexpected error:', error)
    return NextResponse.json(
      { error: error?.message || 'PDF generálás sikertelen' },
      { status: 500 }
    )
  }
}
