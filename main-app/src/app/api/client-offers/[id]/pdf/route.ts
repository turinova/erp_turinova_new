import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getClientOfferById, getTenantCompany, getAllVatRates } from '@/lib/supabase-server'
import generateOfferPdfHtml from '../pdf-template'

// Dynamic imports based on environment
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || id === 'new') {
      return NextResponse.json({ error: 'Érvénytelen ajánlat azonosító' }, { status: 400 })
    }

    // Fetch offer data
    const offerData = await getClientOfferById(id)
    if (!offerData) {
      return NextResponse.json({ error: 'Ajánlat nem található' }, { status: 404 })
    }

    const { offer, items } = offerData
    const tenantCompany = await getTenantCompany()
    const vatRates = await getAllVatRates()

    if (!tenantCompany) {
      return NextResponse.json({ error: 'Cégadatok nem találhatók' }, { status: 500 })
    }

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

    // Fetch tenant company logo from storage URL for header
    let tenantCompanyLogoBase64 = ''
    try {
      if (tenantCompany.logo_url) {
        // Fetch logo from Supabase storage URL
        const logoResponse = await fetch(tenantCompany.logo_url)
        if (logoResponse.ok) {
          const logoBuffer = Buffer.from(await logoResponse.arrayBuffer())
          tenantCompanyLogoBase64 = logoBuffer.toString('base64')
        } else {
          console.warn('Could not fetch tenant company logo from storage URL:', logoResponse.statusText)
        }
      }
    } catch (error) {
      console.warn('Could not load tenant company logo:', error)
      // Continue without logo if file not found
    }

    // Always fetch Turinova logo from filesystem for footer
    let turinovaLogoBase64 = ''
    try {
      const logoPath = join(process.cwd(), 'public', 'images', 'turinova-logo.png')
      const logoBuffer = await readFile(logoPath)
      turinovaLogoBase64 = logoBuffer.toString('base64')
    } catch (error) {
      console.warn('Could not load Turinova logo file:', error)
      // Continue without logo if file not found
    }

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
    await page.setContent(fullHtml, {
      waitUntil: 'networkidle0'
    })

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

