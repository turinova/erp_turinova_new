import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getWorktopQuoteById, getTenantCompany, getAllVatRates } from '@/lib/supabase-server'
import generateWorktopQuotePdfHtml from '../pdf-template'
import { roundToWholeNumber, calculateVat, calculateGross } from '@/lib/pricing/hungarianRounding'
import { generateWorktopSvg } from '../svg-generator-comprehensive'

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
      return NextResponse.json({ error: 'Érvénytelen munkalap ajánlat azonosító' }, { status: 400 })
    }

    // Parallelize database queries for better performance
    const [quoteData, tenantCompany, vatRates] = await Promise.all([
      getWorktopQuoteById(id),
      getCachedTenantCompany(),
      getCachedVatRates()
    ])

    if (!quoteData) {
      return NextResponse.json({ error: 'Munkalap ajánlat nem található' }, { status: 404 })
    }

    if (!tenantCompany) {
      return NextResponse.json({ error: 'Cégadatok nem találhatók' }, { status: 500 })
    }

    // Get VAT rate
    const vatRate = quoteData.vat_id 
      ? vatRates?.find(v => v.id === quoteData.vat_id)?.kulcs || 27
      : 27
    const vatPercent = vatRate / 100

    // Group materials by material_id + assembly_type
    const materialsMap = new Map<string, {
      material_id: string
      material_name: string
      assembly_type: string
      totalMeters: number
      totalNet: number
      totalGross: number
    }>()

    quoteData.pricing.forEach(pricing => {
      const config = quoteData.configs.find(c => c.config_order === pricing.config_order)
      if (!config) return

      const key = `${pricing.material_id}_${config.assembly_type}`
      const existing = materialsMap.get(key)

      if (existing) {
        existing.totalNet += pricing.anyag_koltseg_net
        existing.totalGross += pricing.anyag_koltseg_gross
      } else {
        materialsMap.set(key, {
          material_id: pricing.material_id,
          material_name: pricing.material_name,
          assembly_type: config.assembly_type,
          totalMeters: 0,
          totalNet: pricing.anyag_koltseg_net,
          totalGross: pricing.anyag_koltseg_gross
        })
      }
    })

    // Calculate meters from configs
    quoteData.configs.forEach(config => {
      const pricing = quoteData.pricing.find(p => p.config_order === config.config_order)
      if (!pricing) return

      let meters = 0
      if (config.assembly_type === 'Levágás') {
        meters = config.dimension_a / 1000
      } else if (config.assembly_type === 'Összemarás Balos') {
        meters = (config.dimension_a / 1000) + ((config.dimension_c - (config.dimension_d || 0)) / 1000)
      } else if (config.assembly_type === 'Összemarás jobbos') {
        meters = ((config.dimension_a - (config.dimension_d || 0)) / 1000) + (config.dimension_c / 1000)
      }

      const key = `${pricing.material_id}_${config.assembly_type}`
      const material = materialsMap.get(key)
      if (material) {
        material.totalMeters += meters
      }
    })

    const materials = Array.from(materialsMap.values())

    // Calculate services breakdown
    const servicesMap = new Map<string, {
      quantity: number
      unit: string
      totalNet: number
      totalGross: number
      unitPrice?: number // Store unit price if extracted from details
    }>()

    quoteData.pricing.forEach(p => {
      // Összemarás
      if (p.osszemaras_gross > 0) {
        const existing = servicesMap.get('osszemaras')
        if (existing) {
          existing.quantity += 1
          existing.totalNet += p.osszemaras_net || 0
          existing.totalGross += p.osszemaras_gross
        } else {
          servicesMap.set('osszemaras', {
            quantity: 1,
            unit: 'db',
            totalNet: p.osszemaras_net || 0,
            totalGross: p.osszemaras_gross
          })
        }
      }

      // Kereszt vágás
      if (p.kereszt_vagas_gross > 0) {
        const existing = servicesMap.get('kereszt_vagas')
        if (existing) {
          existing.quantity += 1
          existing.totalNet += p.kereszt_vagas_net || 0
          existing.totalGross += p.kereszt_vagas_gross
        } else {
          servicesMap.set('kereszt_vagas', {
            quantity: 1,
            unit: 'db',
            totalNet: p.kereszt_vagas_net || 0,
            totalGross: p.kereszt_vagas_gross
          })
        }
      }

      // Hosszanti vágás - sum meters and extract unit price from details
      if (p.hosszanti_vagas_gross > 0) {
        const config = quoteData.configs.find(c => c.config_order === p.config_order)
        let meters = 0
        if (config) {
          if (config.assembly_type === 'Levágás') {
            meters = config.dimension_a / 1000
          } else if (config.assembly_type === 'Összemarás Balos') {
            meters = (config.dimension_a / 1000) + ((config.dimension_c - (config.dimension_d || 0)) / 1000)
          } else if (config.assembly_type === 'Összemarás jobbos') {
            meters = ((config.dimension_a - (config.dimension_d || 0)) / 1000) + (config.dimension_c / 1000)
          }
        }
        
        // Extract unit price from details string (e.g., "2.50m × 1500 = 3 750 HUF")
        let unitPrice: number | undefined = undefined
        if (p.hosszanti_vagas_details) {
          // Try to extract unit price from details: "2.50m × 1500 = ..." or "2.50m × 1 500 = ..."
          const priceMatch = p.hosszanti_vagas_details.match(/×\s*([\d\s]+)\s*=/)
          if (priceMatch) {
            // Remove spaces and parse
            const priceStr = priceMatch[1].replace(/\s/g, '')
            unitPrice = parseFloat(priceStr)
          }
        }
        
        const existing = servicesMap.get('hosszanti_vagas')
        if (existing) {
          existing.quantity += meters
          existing.totalNet += p.hosszanti_vagas_net || 0
          existing.totalGross += p.hosszanti_vagas_gross
          // Use the first extracted unit price if we don't have one yet
          if (!existing.unitPrice && unitPrice) {
            existing.unitPrice = unitPrice
          }
        } else {
          servicesMap.set('hosszanti_vagas', {
            quantity: meters,
            unit: 'm',
            totalNet: p.hosszanti_vagas_net || 0,
            totalGross: p.hosszanti_vagas_gross,
            unitPrice: unitPrice
          })
        }
      }

      // Íves vágás - count rounding values
      if (p.ives_vagas_gross > 0) {
        const config = quoteData.configs.find(c => c.config_order === p.config_order)
        let count = 0
        if (config) {
          if (config.rounding_r1 && config.rounding_r1 > 0) count++
          if (config.rounding_r2 && config.rounding_r2 > 0) count++
          if (config.rounding_r3 && config.rounding_r3 > 0) count++
          if (config.rounding_r4 && config.rounding_r4 > 0) count++
        }
        
        const existing = servicesMap.get('ives_vagas')
        if (existing) {
          existing.quantity += count
          existing.totalNet += p.ives_vagas_net || 0
          existing.totalGross += p.ives_vagas_gross
        } else {
          servicesMap.set('ives_vagas', {
            quantity: count,
            unit: 'db',
            totalNet: p.ives_vagas_net || 0,
            totalGross: p.ives_vagas_gross
          })
        }
      }

      // Szögvágás - count groups
      if (p.szogvagas_gross > 0) {
        const config = quoteData.configs.find(c => c.config_order === p.config_order)
        let count = 0
        if (config) {
          if (config.cut_l1 && config.cut_l1 > 0 && config.cut_l2 && config.cut_l2 > 0) count++
          if (config.cut_l3 && config.cut_l3 > 0 && config.cut_l4 && config.cut_l4 > 0) count++
          if (config.cut_l5 && config.cut_l5 > 0 && config.cut_l6 && config.cut_l6 > 0) count++
          if (config.cut_l7 && config.cut_l7 > 0 && config.cut_l8 && config.cut_l8 > 0) count++
        }
        
        const existing = servicesMap.get('szogvagas')
        if (existing) {
          existing.quantity += count
          existing.totalNet += p.szogvagas_net || 0
          existing.totalGross += p.szogvagas_gross
        } else {
          servicesMap.set('szogvagas', {
            quantity: count,
            unit: 'db',
            totalNet: p.szogvagas_net || 0,
            totalGross: p.szogvagas_gross
          })
        }
      }

      // Kivágás - count cutouts
      if (p.kivagas_gross > 0) {
        const config = quoteData.configs.find(c => c.config_order === p.config_order)
        let count = 0
        if (config && config.cutouts) {
          try {
            const cutouts = JSON.parse(config.cutouts)
            count = Array.isArray(cutouts) ? cutouts.length : 1
          } catch {
            count = 1
          }
        }
        
        const existing = servicesMap.get('kivagas')
        if (existing) {
          existing.quantity += count
          existing.totalNet += p.kivagas_net || 0
          existing.totalGross += p.kivagas_gross
        } else {
          servicesMap.set('kivagas', {
            quantity: count,
            unit: 'db',
            totalNet: p.kivagas_net || 0,
            totalGross: p.kivagas_gross
          })
        }
      }

      // Élzáró - sum meters and extract unit price from details
      if (p.elzaro_gross > 0) {
        const config = quoteData.configs.find(c => c.config_order === p.config_order)
        let meters = 0
        if (config) {
          if (config.assembly_type === 'Levágás') {
            if (config.edge_position1) meters += config.dimension_b / 1000
            if (config.edge_position2) meters += config.dimension_a / 1000
            if (config.edge_position3) meters += config.dimension_b / 1000
            if (config.edge_position4) meters += config.dimension_a / 1000
          } else if (config.assembly_type === 'Összemarás Balos') {
            if (config.edge_position1) meters += config.dimension_c / 1000
            if (config.edge_position2) meters += config.dimension_a / 1000
            if (config.edge_position3) meters += config.dimension_b / 1000
            if (config.edge_position4) meters += (config.dimension_a - (config.dimension_d || 0)) / 1000
            if (config.edge_position5) meters += (config.dimension_c - (config.dimension_b || 0)) / 1000
            if (config.edge_position6) meters += (config.dimension_d || 0) / 1000
          } else if (config.assembly_type === 'Összemarás jobbos') {
            if (config.edge_position1) meters += config.dimension_c / 1000
            if (config.edge_position2) meters += config.dimension_a / 1000
            if (config.edge_position3) meters += config.dimension_b / 1000
            if (config.edge_position4) meters += (config.dimension_a - (config.dimension_d || 0)) / 1000
            if (config.edge_position5) meters += (config.dimension_c - (config.dimension_b || 0)) / 1000
            if (config.edge_position6) meters += (config.dimension_d || 0) / 1000
          }
        }
        
        // Extract unit price from details string (e.g., "5.00m × 1 800 HUF = 27 000 HUF")
        let unitPrice: number | undefined = undefined
        if (p.elzaro_details) {
          const priceMatch = p.elzaro_details.match(/×\s*([\d\s]+)\s*HUF/)
          if (priceMatch) {
            const priceStr = priceMatch[1].replace(/\s/g, '')
            unitPrice = parseFloat(priceStr)
          }
        }
        
        const existing = servicesMap.get('elzaro')
        if (existing) {
          existing.quantity += meters
          existing.totalNet += p.elzaro_net || 0
          existing.totalGross += p.elzaro_gross
          if (!existing.unitPrice && unitPrice) {
            existing.unitPrice = unitPrice
          }
        } else {
          servicesMap.set('elzaro', {
            quantity: meters,
            unit: 'm',
            totalNet: p.elzaro_net || 0,
            totalGross: p.elzaro_gross,
            unitPrice: unitPrice
          })
        }
      }
    })

    const services = Array.from(servicesMap.entries()).map(([service_type, data]) => ({
      service_type,
      quantity: data.quantity,
      unit: data.unit,
      totalNet: data.totalNet,
      totalGross: data.totalGross,
      unitPrice: data.unitPrice
    }))

    // Calculate totals with Hungarian rounding
    const materialsTotalGross = roundToWholeNumber(materials.reduce((sum, m) => sum + m.totalGross, 0))
    const materialsTotalNet = roundToWholeNumber(materials.reduce((sum, m) => sum + m.totalNet, 0))
    const materialsTotalVat = calculateVat(materialsTotalNet, vatPercent)

    const servicesTotalGross = roundToWholeNumber(services.reduce((sum, s) => sum + s.totalGross, 0))
    const servicesTotalNet = roundToWholeNumber(services.reduce((sum, s) => sum + s.totalNet, 0))
    const servicesTotalVat = calculateVat(servicesTotalNet, vatPercent)

    // Calculate subtotal before discount
    const subtotalGross = materialsTotalGross + servicesTotalGross
    const subtotalNet = materialsTotalNet + servicesTotalNet
    const subtotalVat = materialsTotalVat + servicesTotalVat

    // Calculate discount
    const discountPercent = quoteData.discount_percent || 0
    const discountAmount = roundToWholeNumber(subtotalGross * (discountPercent / 100))

    // Final total after discount
    const finalTotalGross = roundToWholeNumber(subtotalGross - discountAmount)
    const finalTotalNet = roundToWholeNumber(subtotalNet * (1 - discountPercent / 100))
    const finalTotalVat = calculateGross(finalTotalNet, calculateVat(finalTotalNet, vatPercent)) - finalTotalNet

    const summary = {
      totalNetBeforeDiscount: roundToWholeNumber(subtotalNet),
      totalVatBeforeDiscount: roundToWholeNumber(subtotalVat),
      totalGrossBeforeDiscount: roundToWholeNumber(subtotalGross),
      totalNetAfterDiscount: roundToWholeNumber(finalTotalNet),
      totalVatAfterDiscount: roundToWholeNumber(finalTotalVat),
      totalGrossAfterDiscount: roundToWholeNumber(finalTotalGross)
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
    const fullHtml = generateWorktopQuotePdfHtml({
      quote: {
        id: quoteData.id,
        quote_number: quoteData.quote_number,
        customer: {
          name: quoteData.customers?.name || '',
          email: quoteData.customers?.email || null,
          mobile: quoteData.customers?.mobile || null,
          billing_name: quoteData.customers?.billing_name || null,
          billing_country: quoteData.customers?.billing_country || null,
          billing_city: quoteData.customers?.billing_city || null,
          billing_postal_code: quoteData.customers?.billing_postal_code || null,
          billing_street: quoteData.customers?.billing_street || null,
          billing_house_number: quoteData.customers?.billing_house_number || null,
          billing_tax_number: quoteData.customers?.billing_tax_number || null
        },
        discount_percent: quoteData.discount_percent || 0,
        comment: quoteData.comment || null,
        created_at: quoteData.created_at,
        materials,
        services,
        materialsTotalGross,
        servicesTotalGross,
        materialsTotalNet,
        servicesTotalNet,
        materialsTotalVat,
        servicesTotalVat,
        configs: (quoteData.configs || []).map(c => ({
          id: c.id,
          config_order: c.config_order,
          assembly_type: c.assembly_type,
          linear_material_name: c.linear_material_name,
          dimension_a: c.dimension_a,
          dimension_b: c.dimension_b,
          dimension_c: c.dimension_c,
          dimension_d: c.dimension_d,
          rounding_r1: c.rounding_r1,
          rounding_r2: c.rounding_r2,
          rounding_r3: c.rounding_r3,
          rounding_r4: c.rounding_r4,
          cut_l1: c.cut_l1,
          cut_l2: c.cut_l2,
          cut_l3: c.cut_l3,
          cut_l4: c.cut_l4,
          cut_l5: c.cut_l5,
          cut_l6: c.cut_l6,
          cut_l7: c.cut_l7,
          cut_l8: c.cut_l8,
          cutouts: c.cutouts,
          edge_position1: c.edge_position1,
          edge_position2: c.edge_position2,
          edge_position3: c.edge_position3,
          edge_position4: c.edge_position4,
          edge_position5: c.edge_position5,
          edge_position6: c.edge_position6
        }))
      },
      tenantCompany,
      summary,
      discountAmount,
      discountPercentage: discountPercent,
      tenantCompanyLogoBase64,
      turinovaLogoBase64,
      generateSvg: generateWorktopSvg
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
        'Content-Disposition': `inline; filename="Munkalap-Arajanlat-${quoteData.quote_number}.pdf"`,
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
