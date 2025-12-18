import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getClientOfferById, getTenantCompany, getAllVatRates } from '@/lib/supabase-server'
import generateOfferPdfHtml from '../pdf-template'

// Dynamic imports based on environment
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

// In-memory cache for static data (tenant company and VAT rates)
// These rarely change, so caching improves performance significantly
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
      return NextResponse.json({ error: 'Érvénytelen ajánlat azonosító' }, { status: 400 })
    }

    // Parallelize database queries for better performance
    const [offerData, tenantCompany, vatRates] = await Promise.all([
      getClientOfferById(id),
      getCachedTenantCompany(),
      getCachedVatRates()
    ])

    if (!offerData) {
      return NextResponse.json({ error: 'Ajánlat nem található' }, { status: 404 })
    }

    if (!tenantCompany) {
      return NextResponse.json({ error: 'Cégadatok nem találhatók' }, { status: 500 })
    }

    const { offer, items } = offerData

    // Calculate summary (matching client-side logic)
    const products = items.filter(item => ['product', 'material', 'accessory', 'linear_material'].includes(item.item_type))
    const fees = items.filter(item => item.item_type === 'fee')
    
    let itemsNet = 0
    let itemsVat = 0
    let itemsGross = 0
    
    products.forEach(item => {
      const net = Math.round(Number(item.total_net || 0))
      const vat = Math.round(Number(item.total_vat || 0))
      const gross = Math.round(Number(item.total_gross || 0))
      
      itemsNet += net
      itemsVat += vat
      itemsGross += gross
    })
    
    let feesNet = 0
    let feesVat = 0
    let feesGross = 0
    
    fees.forEach(item => {
      const net = Math.round(Number(item.total_net || 0))
      const vat = Math.round(Number(item.total_vat || 0))
      const gross = Math.round(Number(item.total_gross || 0))
      
      feesNet += net
      feesVat += vat
      feesGross += gross
    })
    
    const totalNetBeforeDiscount = itemsNet + feesNet
    const totalVatBeforeDiscount = itemsVat + feesVat
    const totalGrossBeforeDiscount = itemsGross + feesGross
    
    const discountAmountValue = Number(offer.discount_amount) || 0
    const grossAfterDiscountRaw = totalGrossBeforeDiscount - discountAmountValue
    const totalGrossAfterDiscount = Math.round(grossAfterDiscountRaw)
    
    const discountRatio = totalGrossBeforeDiscount > 0 ? discountAmountValue / totalGrossBeforeDiscount : 0
    const totalNetAfterDiscount = Math.round(totalNetBeforeDiscount * (1 - discountRatio))
    const totalVatAfterDiscount = totalGrossAfterDiscount - totalNetAfterDiscount

    const summary = {
      totalNetBeforeDiscount,
      totalVatBeforeDiscount,
      totalGrossBeforeDiscount,
      totalNetAfterDiscount,
      totalVatAfterDiscount,
      totalGrossAfterDiscount
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
    const fullHtml = generateOfferPdfHtml({
      offer,
      items,
      tenantCompany,
      vatRates,
      summary,
      discountAmount: offer.discount_amount,
      discountPercentage: offer.discount_percentage,
      tenantCompanyLogoBase64,
      turinovaLogoBase64
    })

    // Launch Puppeteer
    // In production (Vercel), use puppeteer-core with @sparticuz/chromium
    // In development, use puppeteer (includes bundled Chromium)
    let browser
    
    if (isProduction) {
      // Production: Use puppeteer-core with Vercel-optimized Chromium
      const puppeteerCore = await import('puppeteer-core')
      const chromium = await import('@sparticuz/chromium')
      
      browser = await puppeteerCore.default.launch({
        args: chromium.default.args,
        defaultViewport: chromium.default.defaultViewport,
        executablePath: await chromium.default.executablePath(),
        headless: chromium.default.headless,
      })
    } else {
      // Development: Use puppeteer (includes bundled Chromium)
      const puppeteer = await import('puppeteer')
      
      browser = await puppeteer.default.launch({
        headless: true,
      })
    }

    const page = await browser.newPage()
    
    // Set content and wait for rendering
    // Using 'domcontentloaded' instead of 'networkidle0' for better performance
    // Then explicitly wait for fonts and give images time to render
    await page.setContent(fullHtml, {
      waitUntil: 'domcontentloaded'
    })
    
    // Wait for fonts to load (important for PDF quality)
    await page.evaluateHandle('document.fonts.ready')
    
    // Small delay for images to render (much faster than networkidle0)
    await new Promise(resolve => setTimeout(resolve, 100))

    // Generate PDF with vector text
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
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
      // Still return it, but log warning
    }

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Ajanlat-${offer.offer_number}.pdf"`,
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

