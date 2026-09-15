import { access } from 'fs/promises'
import { readFile } from 'fs/promises'
import { constants as fsConstants } from 'fs'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'

import { getPartnerSession } from '@/lib/auth/partner-session'
import { getSessionUser } from '@/lib/auth/session'
import { getTenantCompany } from '@/lib/company/queries'
import {
  getQuoteForPdf,
  tenantCompanyToPdf
} from '@/lib/quotes/pdf-data'
import generateQuotePdfHtml from '@/lib/quotes/pdf-template'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

const isProduction = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production'

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Local Chrome for Puppeteer — bundled cache, env override, or system Chrome. */
async function resolveLocalChromePath(): Promise<string | undefined> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }

  try {
    const puppeteer = await import('puppeteer')
    const bundled = puppeteer.default.executablePath()
    if (bundled && (await pathExists(bundled))) {
      return bundled
    }
  } catch {
    // ignore — fall through to system paths
  }

  const candidates =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
        ]
      : process.platform === 'win32'
        ? [
            'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
            'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe'
          ]
        : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate
  }

  return undefined
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || id === 'new') {
      return NextResponse.json(
        { error: 'Érvénytelen árajánlat azonosító' },
        { status: 400 }
      )
    }

    const staffUser = await getSessionUser()
    const partnerSession = await getPartnerSession()

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Az adatbázis kapcsolat nem elérhető.' },
        { status: 500 }
      )
    }

    let tenantId: string | null = null

    if (staffUser?.tenantId && staffUser.hasMembership && !staffUser.isDevSession) {
      tenantId = staffUser.tenantId
    } else if (partnerSession) {
      const { data: owned } = await supabase
        .from('quotes')
        .select('tenant_id')
        .eq('id', id)
        .eq('partner_profile_id', partnerSession.id)
        .eq('source', 'portal')
        .is('deleted_at', null)
        .maybeSingle()

      if (!owned) {
        return NextResponse.json(
          { error: 'Árajánlat nem található' },
          { status: 404 }
        )
      }
      tenantId = owned.tenant_id
    } else if (staffUser?.isDevSession) {
      return NextResponse.json(
        { error: 'Dev bypass módban nincs adatbázis.' },
        { status: 400 }
      )
    } else {
      return NextResponse.json({ error: 'Nincs bejelentkezve.' }, { status: 401 })
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Nincs bejelentkezve.' }, { status: 401 })
    }

    const [quoteData, tenantCompany] = await Promise.all([
      getQuoteForPdf(supabase, tenantId, id),
      getTenantCompany(supabase, tenantId)
    ])

    if (!quoteData) {
      return NextResponse.json(
        { error: 'Árajánlat nem található' },
        { status: 404 }
      )
    }

    if (!tenantCompany) {
      return NextResponse.json(
        { error: 'Cégadatok nem találhatók' },
        { status: 500 }
      )
    }

    // Végösszeg = lapszabászat + termékek + egyéb díjak / jóváírások
    const feesNet = Math.round(quoteData.totals.fees_total_net ?? 0)
    const feesVat = Math.round(quoteData.totals.fees_total_vat ?? 0)
    const accessoriesNet = Math.round(
      quoteData.totals.accessories_total_net ?? 0
    )
    const accessoriesVat = Math.round(
      quoteData.totals.accessories_total_vat ?? 0
    )
    const finalGross = Math.round(
      quoteData.totals.final_total_after_discount ??
        quoteData.totals.total_gross
    )
    const summary = {
      totalNetBeforeDiscount:
        Math.round(quoteData.totals.total_net) + feesNet + accessoriesNet,
      totalVatBeforeDiscount:
        Math.round(quoteData.totals.total_vat) + feesVat + accessoriesVat,
      totalGrossBeforeDiscount: finalGross,
      totalNetAfterDiscount:
        Math.round(quoteData.totals.total_net) + feesNet + accessoriesNet,
      totalVatAfterDiscount:
        Math.round(quoteData.totals.total_vat) + feesVat + accessoriesVat,
      totalGrossAfterDiscount: finalGross
    }

    const [tenantCompanyLogoBase64, turinovaLogoBase64] = await Promise.all([
      tenantCompany.logo_url
        ? fetch(tenantCompany.logo_url)
            .then((res) => {
              if (!res.ok) return ''
              return res
                .arrayBuffer()
                .then((buf) => Buffer.from(buf).toString('base64'))
            })
            .catch(() => {
              console.warn('Could not load tenant company logo')
              return ''
            })
        : Promise.resolve(''),
      readFile(join(process.cwd(), 'public', 'images', 'turinova-logo.png'))
        .then((buf) => buf.toString('base64'))
        .catch(() => {
          console.warn('Could not load Turinova logo file')
          return ''
        })
    ])

    const fullHtml = generateQuotePdfHtml({
      quote: quoteData,
      tenantCompany: tenantCompanyToPdf(tenantCompany),
      summary,
      discountAmount: 0,
      discountPercentage: 0,
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
        defaultViewport: { width: 1280, height: 720 },
        executablePath: await chromium.default.executablePath(),
        headless: true
      })
    } else {
      const puppeteer = await import('puppeteer')
      const executablePath = await resolveLocalChromePath()

      if (!executablePath) {
        return NextResponse.json(
          {
            error:
              'Hiba történt a PDF generálása során: hiányzik a Chrome. Futtasd: npx puppeteer browsers install chrome'
          },
          { status: 500 }
        )
      }

      browser = await puppeteer.default.launch({
        headless: true,
        executablePath,
        args: [
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--no-sandbox'
        ]
      })
    }

    const page = await browser.newPage()
    const hasBarcode = Boolean(quoteData.barcode?.trim())
    await page.setJavaScriptEnabled(hasBarcode)
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      if (
        hasBarcode &&
        req.url().includes('jsdelivr.net') &&
        req.resourceType() === 'script'
      ) {
        req.continue()
        return
      }
      req.abort()
    })

    await page.setContent(fullHtml, {
      waitUntil: hasBarcode ? 'load' : 'domcontentloaded'
    })

    if (hasBarcode) {
      // Allow JsBarcode CDN a moment after load
      await new Promise((resolve) => setTimeout(resolve, 200))
      await page
        .waitForFunction(
          (id) => {
            const svg = document.getElementById(id)
            return Boolean(svg && svg.children.length > 0)
          },
          { timeout: 5000 },
          `barcode-${quoteData.id}`
        )
        .catch(() => {
          console.warn('Barcode SVG did not render in time')
        })
    } else {
      await new Promise((resolve) => setTimeout(resolve, 50))
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

    const fileSizeMB = pdfBuffer.length / (1024 * 1024)
    if (fileSizeMB > 3) {
      console.warn(`PDF size (${fileSizeMB.toFixed(2)}MB) exceeds 3MB limit`)
    }

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Arajanlat-${quoteData.quote_number}.pdf"`,
        'Content-Length': String(pdfBuffer.length)
      }
    })
  } catch (error: unknown) {
    console.error('Error generating PDF:', error)
    const message =
      error instanceof Error ? error.message : 'Ismeretlen hiba'
    return NextResponse.json(
      { error: 'Hiba történt a PDF generálása során: ' + message },
      { status: 500 }
    )
  }
}
