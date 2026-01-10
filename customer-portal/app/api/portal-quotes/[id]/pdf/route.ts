import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getPortalQuoteById } from '@/lib/supabase-server'
import { 
  getCompanyInfo, 
  getCompanyVatRates,
  getEdgeMaterialCodes
} from '@/lib/company-data-server'
import generatePortalQuotePdfHtml from './pdf-template'

// Log that the route module is loaded
console.log('[PDF Route] Route module loaded at:', new Date().toISOString())

// Dynamic imports based on environment
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

// In-memory cache for static data (tenant company and VAT rates)
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getCachedCompanyInfo(companyCredentials: { supabase_url: string; supabase_anon_key: string }) {
  const key = `company_info_${companyCredentials.supabase_url}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  const data = await getCompanyInfo(companyCredentials)
  if (data) {
    cache.set(key, { data, timestamp: Date.now() })
  }
  return data
}

async function getCachedVatRates(companyCredentials: { supabase_url: string; supabase_anon_key: string }) {
  const key = `vat_rates_${companyCredentials.supabase_url}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  const data = await getCompanyVatRates(companyCredentials)
  cache.set(key, { data, timestamp: Date.now() })
  return data
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  console.log('[PDF Generation] Starting PDF generation...')
  
  try {
    const { id: quote_id } = await params
    console.log(`[PDF Generation] Quote ID: ${quote_id}`)

    if (!quote_id || quote_id === 'new') {
      return NextResponse.json({ error: 'Érvénytelen árajánlat azonosító' }, { status: 400 })
    }

    // Fetch portal quote data (includes company credentials)
    const quoteData = await getPortalQuoteById(quote_id)

    if (!quoteData) {
      return NextResponse.json({ error: 'Árajánlat nem található' }, { status: 404 })
    }

    if (!quoteData.companies) {
      return NextResponse.json({ error: 'Cégadatok nem találhatók' }, { status: 500 })
    }

    const companyCredentials = {
      supabase_url: quoteData.companies.supabase_url,
      supabase_anon_key: quoteData.companies.supabase_anon_key
    }

    // Parallelize database queries for better performance
    const [tenantCompany, vatRates] = await Promise.all([
      getCachedCompanyInfo(companyCredentials),
      getCachedVatRates(companyCredentials)
    ])

    if (!tenantCompany) {
      return NextResponse.json({ error: 'Cégadatok nem találhatók' }, { status: 500 })
    }

    // Fetch edge material codes for panels (machine codes not needed for customer portal)
    const edgeMaterialIds = new Set<string>()
    quoteData.panels?.forEach(panel => {
      if (panel.edge_material_a_id) edgeMaterialIds.add(panel.edge_material_a_id)
      if (panel.edge_material_b_id) edgeMaterialIds.add(panel.edge_material_b_id)
      if (panel.edge_material_c_id) edgeMaterialIds.add(panel.edge_material_c_id)
      if (panel.edge_material_d_id) edgeMaterialIds.add(panel.edge_material_d_id)
    })

    const edgeCodesMap = edgeMaterialIds.size > 0 
      ? await getEdgeMaterialCodes(companyCredentials, Array.from(edgeMaterialIds))
      : new Map()

    // Enrich panels with edge codes and material names
    // Get material name from pricing data (same as the page does)
    const enrichedPanels = quoteData.panels?.map(panel => {
      // Find material name from pricing (same logic as PortalQuoteDetailClient.tsx)
      const materialPricing = quoteData.pricing?.find(p => p.material_id === panel.material_id)
      const materialName = materialPricing?.material_name || 'Ismeretlen anyag'
      
      return {
        ...panel,
        material_machine_code: materialName, // Use material name (machine codes not needed for customers)
        material_name: materialName,
        edge_a_code: panel.edge_material_a_id ? edgeCodesMap.get(panel.edge_material_a_id) || null : null,
        edge_b_code: panel.edge_material_b_id ? edgeCodesMap.get(panel.edge_material_b_id) || null : null,
        edge_c_code: panel.edge_material_c_id ? edgeCodesMap.get(panel.edge_material_c_id) || null : null,
        edge_d_code: panel.edge_material_d_id ? edgeCodesMap.get(panel.edge_material_d_id) || null : null
      }
    }) || []

    // Calculate summary (matching portal quote totals)
    // Portal quotes don't have fees, so only materials totals
    const materialsGross = quoteData.total_gross || 0
    const materialsNet = quoteData.total_net || 0
    const materialsVat = quoteData.total_vat || 0
    
    // Calculate subtotal before discount (only positive values get discount)
    const materialsGrossPositive = Math.max(0, materialsGross)
    const subtotalBeforeDiscount = materialsGrossPositive
    
    // Calculate discount
    const discountPercent = quoteData.discount_percent || 0
    const discountAmount = subtotalBeforeDiscount * (discountPercent / 100)
    
    // Add negative values (no discount on these)
    const materialsGrossNegative = Math.min(0, materialsGross)
    
    // Final total after discount
    const totalGrossAfterDiscount = subtotalBeforeDiscount - discountAmount + materialsGrossNegative
    
    // Apply discount ratio to net and VAT
    const discountRatio = materialsGross > 0 ? discountAmount / materialsGross : 0
    const totalNetAfterDiscount = Math.round(materialsNet * (1 - discountRatio))
    const totalVatAfterDiscount = totalGrossAfterDiscount - totalNetAfterDiscount

    const summary = {
      totalNetBeforeDiscount: Math.round(materialsNet),
      totalVatBeforeDiscount: Math.round(materialsVat),
      totalGrossBeforeDiscount: Math.round(materialsGross),
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

    // Transform portal quote data to match PDF template structure
    const transformedQuote = {
      id: quoteData.id,
      quote_number: quoteData.quote_number,
      customer: {
        name: quoteData.portal_customers.name,
        email: quoteData.portal_customers.email || '',
        mobile: quoteData.portal_customers.mobile || '',
        billing_name: quoteData.portal_customers.billing_name || quoteData.portal_customers.name,
        billing_country: quoteData.portal_customers.billing_country || '',
        billing_city: quoteData.portal_customers.billing_city || '',
        billing_postal_code: quoteData.portal_customers.billing_postal_code || '',
        billing_street: quoteData.portal_customers.billing_street || '',
        billing_house_number: quoteData.portal_customers.billing_house_number || '',
        billing_tax_number: quoteData.portal_customers.billing_tax_number || ''
      },
      discount_percent: quoteData.discount_percent || 0,
      comment: quoteData.comment,
      created_at: quoteData.created_at,
      pricing: quoteData.pricing || [],
      panels: enrichedPanels,
      totals: {
        total_net: quoteData.total_net || 0,
        total_vat: quoteData.total_vat || 0,
        total_gross: quoteData.total_gross || 0,
        final_total_after_discount: quoteData.final_total_after_discount || 0
      }
    }

    // Generate HTML string directly (no React rendering)
    let fullHtml: string
    try {
      fullHtml = generatePortalQuotePdfHtml({
        quote: transformedQuote,
        tenantCompany,
        vatRates: vatRates || [],
        summary,
        discountAmount,
        discountPercentage: discountPercent,
        tenantCompanyLogoBase64,
        turinovaLogoBase64
      })
      
      if (!fullHtml || fullHtml.length === 0) {
        throw new Error('Generated HTML is empty')
      }
      
      console.log(`[PDF Generation] HTML generated: ${fullHtml.length} characters`)
    } catch (htmlError: any) {
      console.error('[PDF Generation] HTML generation error:', htmlError)
      return NextResponse.json(
        { error: `HTML generálási hiba: ${htmlError.message || 'Ismeretlen hiba'}` },
        { status: 500 }
      )
    }

    // Launch Puppeteer with performance optimizations
    let browser
    
    try {
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
    } catch (puppeteerError: any) {
      console.error('[PDF Generation] Puppeteer import/launch error:', puppeteerError)
      return NextResponse.json(
        { error: `Puppeteer hiba: ${puppeteerError.message || 'Puppeteer nem található. Kérjük, telepítse a puppeteer vagy puppeteer-core csomagot.'}` },
        { status: 500 }
      )
    }

    let pdfBuffer: Buffer
    
    try {
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
      pdfBuffer = await page.pdf({
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
      
      // Validate PDF buffer
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF is empty')
      }
      
      console.log(`[PDF Generation] PDF generated successfully: ${pdfBuffer.length} bytes`)
    } catch (pdfError: any) {
      console.error('[PDF Generation] PDF generation error:', pdfError)
      console.error('[PDF Generation] Error stack:', pdfError.stack)
      if (browser) {
        try {
          await browser.close()
        } catch (closeError) {
          console.error('[PDF Generation] Error closing browser:', closeError)
        }
      }
      return NextResponse.json(
        { error: `PDF generálási hiba: ${pdfError.message || 'Ismeretlen hiba'}` },
        { status: 500 }
      )
    }

    // Check file size (3MB limit)
    const fileSizeMB = pdfBuffer.length / (1024 * 1024)
    if (fileSizeMB > 3) {
      console.warn(`PDF size (${fileSizeMB.toFixed(2)}MB) exceeds 3MB limit`)
    }

    const duration = Date.now() - startTime
    console.log(`[PDF Generation] PDF generation completed in ${duration}ms`)

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
    const duration = Date.now() - startTime
    console.error(`[PDF Generation] Error generating PDF (took ${duration}ms):`, error)
    console.error('[PDF Generation] Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Hiba történt a PDF generálása során: ' + (error.message || 'Ismeretlen hiba') },
      { status: 500 }
    )
  }
}

