import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getQuoteById, getTenantCompany, getAllVatRates } from '@/lib/supabase-server'
import generateQuotePdfHtml from '../pdf-template'

// Dynamic imports based on environment
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

// In-memory cache for static data (tenant company and VAT rates)
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getCachedTenantCompany() {
  const key = 'tenant_company'
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || id === 'new') {
      return NextResponse.json({ error: 'Érvénytelen árajánlat azonosító' }, { status: 400 })
    }

    // Parallelize database queries for better performance
    const [quoteData, tenantCompany, vatRates] = await Promise.all([
      getQuoteById(id),
      getCachedTenantCompany(),
      getCachedVatRates()
    ])

    if (!quoteData) {
      return NextResponse.json({ error: 'Árajánlat nem található' }, { status: 404 })
    }

    if (!tenantCompany) {
      return NextResponse.json({ error: 'Cégadatok nem találhatók' }, { status: 500 })
    }

    // Calculate summary (matching quote totals)
    // Note: quote.totals.total_gross already includes materials + their services (cutting, edge materials, etc.)
    const materialsGross = quoteData.totals.total_gross || 0
    const feesGross = quoteData.totals.fees_total_gross || 0
    
    // Calculate subtotal before discount (only positive values get discount)
    const materialsGrossPositive = Math.max(0, materialsGross)
    const feesGrossPositive = Math.max(0, feesGross)
    const subtotalBeforeDiscount = materialsGrossPositive + feesGrossPositive
    
    // Calculate discount
    const discountPercent = quoteData.discount_percent || 0
    const discountAmount = subtotalBeforeDiscount * (discountPercent / 100)
    
    // Add negative values (no discount on these)
    const materialsGrossNegative = Math.min(0, materialsGross)
    const feesGrossNegative = Math.min(0, feesGross)
    
    // Final total after discount
    const totalGrossAfterDiscount = subtotalBeforeDiscount - discountAmount + materialsGrossNegative + feesGrossNegative
    
    // Calculate net and VAT from totals
    const materialsNet = quoteData.totals.total_net || 0
    const materialsVat = quoteData.totals.total_vat || 0
    const feesNet = quoteData.totals.fees_total_net || 0
    const feesVat = quoteData.totals.fees_total_vat || 0
    
    const totalNetBeforeDiscount = materialsNet + feesNet
    const totalVatBeforeDiscount = materialsVat + feesVat
    const totalGrossBeforeDiscount = materialsGross + feesGross
    
    // Apply discount ratio to net and VAT
    const discountRatio = totalGrossBeforeDiscount > 0 ? discountAmount / totalGrossBeforeDiscount : 0
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

    // Parallelize image fetching for better performance
    const [tenantCompanyLogoBase64, turinovaLogoBase64] = await Promise.all([
      // Fetch tenant company logo from storage URL for header
      tenantCompany.logo_url
        ? fetch(tenantCompany.logo_url)
            .then(res => {
              if (res.ok) {
                return res.arrayBuffer()
                  .then(buf => Buffer.from(buf).toString('base64'))
              }
              return ''
            })
            .catch(() => {
              console.warn('Could not load tenant company logo')
              return ''
            })
        : Promise.resolve(''),
      // Always fetch Turinova logo from filesystem for footer
      readFile(join(process.cwd(), 'public', 'images', 'turinova-logo.png'))
        .then(buf => buf.toString('base64'))
        .catch(() => {
          console.warn('Could not load Turinova logo file')
          return ''
        })
    ])

    // Generate HTML string directly (no React rendering)
    const fullHtml = generateQuotePdfHtml({
      quote: {
        ...quoteData,
        panels: quoteData.panels || []
      },
      tenantCompany,
      vatRates,
      summary,
      discountAmount,
      discountPercentage: discountPercent,
      tenantCompanyLogoBase64,
      turinovaLogoBase64
    })

    // Launch Puppeteer with performance optimizations
    let browser
    
    if (isProduction) {
      // Production: Use puppeteer-core with Vercel-optimized Chromium
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
          '--use-mock-keychain',
        ],
        defaultViewport: chromium.default.defaultViewport,
        executablePath: await chromium.default.executablePath(),
        headless: chromium.default.headless,
      })
    } else {
      // Development: Use puppeteer (includes bundled Chromium)
      const puppeteer = await import('puppeteer')
      
      browser = await puppeteer.default.launch({
        headless: true,
        args: [
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--no-sandbox',
        ],
      })
    }

    const page = await browser.newPage()
    
    // Disable unnecessary features for better performance
    await page.setJavaScriptEnabled(false)
    
    // Block all network requests (images are already base64 embedded)
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      req.abort()
    })
    
    // Set content and wait for rendering
    await page.setContent(fullHtml, {
      waitUntil: 'domcontentloaded'
    })
    
    // Small delay for images to render
    await new Promise(resolve => setTimeout(resolve, 50))

    // Generate PDF with optimized settings
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

    // Check file size (3MB limit)
    const fileSizeMB = pdfBuffer.length / (1024 * 1024)
    if (fileSizeMB > 3) {
      console.warn(`PDF size (${fileSizeMB.toFixed(2)}MB) exceeds 3MB limit`)
    }

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Arajanlat-${quoteData.quote_number}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Hiba történt a PDF generálása során: ' + (error.message || 'Ismeretlen hiba') },
      { status: 500 }
    )
  }
}

