// PDFKit-based PDF generator for Worktop Quotes
// Replaces Puppeteer with direct PDF generation for better control and performance

// Use dynamic import to avoid Next.js bundling issues with PDFKit
// PDFKit uses font files that need to be available at runtime
// This must run server-side only (in API route)

import { generateWorktopSvg } from './svg-generator-comprehensive'

// Type definitions for PDFKit
declare module 'pdfkit' {
  interface PDFDocument {
    widthOfString(text: string, options?: any): number
  }
}

interface WorktopQuoteMaterial {
  material_id: string
  material_name: string
  assembly_type: string
  totalMeters: number
  totalNet: number
  totalGross: number
}

interface WorktopQuoteService {
  service_type: string
  quantity: number
  unit: string
  totalNet: number
  totalGross: number
  unitPrice?: number
}

interface WorktopConfig {
  id: string
  config_order: number
  assembly_type: string
  linear_material_name: string
  dimension_a: number
  dimension_b: number
  dimension_c: number | null
  dimension_d: number | null
  rounding_r1: number | null
  rounding_r2: number | null
  rounding_r3: number | null
  rounding_r4: number | null
  cut_l1: number | null
  cut_l2: number | null
  cut_l3: number | null
  cut_l4: number | null
  cut_l5: number | null
  cut_l6: number | null
  cut_l7: number | null
  cut_l8: number | null
  cutouts: string | null
  edge_position1: boolean
  edge_position2: boolean
  edge_position3: boolean
  edge_position4: boolean
  edge_position5: boolean | null
  edge_position6: boolean | null
}

interface WorktopQuote {
  id: string
  quote_number: string
  customer: {
    name: string
    email: string | null
    mobile: string | null
    billing_name: string | null
    billing_country: string | null
    billing_city: string | null
    billing_postal_code: string | null
    billing_street: string | null
    billing_house_number: string | null
    billing_tax_number: string | null
  }
  discount_percent: number
  comment: string | null
  created_at: string
  materials: WorktopQuoteMaterial[]
  services: WorktopQuoteService[]
  materialsTotalGross: number
  servicesTotalGross: number
  materialsTotalNet: number
  servicesTotalNet: number
  materialsTotalVat: number
  servicesTotalVat: number
  configs: WorktopConfig[]
}

interface TenantCompany {
  name: string
  address: string
  city: string
  postal_code: string
  tax_number: string
  logo_url: string | null
}

interface Summary {
  totalNetBeforeDiscount: number
  totalVatBeforeDiscount: number
  totalGrossBeforeDiscount: number
  totalNetAfterDiscount: number
  totalVatAfterDiscount: number
  totalGrossAfterDiscount: number
}

interface WorktopQuotePdfKitProps {
  quote: WorktopQuote
  tenantCompany: TenantCompany
  summary: Summary
  discountAmount: number
  discountPercentage: number
  tenantCompanyLogoBase64: string
  turinovaLogoBase64: string
}

// Helper functions
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('hu-HU').format(Math.round(amount))
}

const formatCurrencyWithDecimals = (amount: number): string => {
  return new Intl.NumberFormat('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}.`
}

const getServiceName = (serviceType: string): string => {
  const serviceNames: Record<string, string> = {
    'hosszanti_vagas': 'Hosszanti vágás',
    'ives_vagas': 'Íves vágás',
    'szogvagas': 'Szögvágás',
    'kivagas': 'Kivágás',
    'elzaro': 'Élzáró',
    'csatlakozas': 'Csatlakozás',
    'egyeb': 'Egyéb'
  }
  return serviceNames[serviceType] || serviceType
}

// PDF Dimensions (A4)
const A4_WIDTH = 595.28  // A4 width in points (210mm)
const A4_HEIGHT = 841.89 // A4 height in points (297mm)
const A4_LANDSCAPE_WIDTH = 841.89  // A4 landscape width in points (297mm)
const A4_LANDSCAPE_HEIGHT = 595.28 // A4 landscape height in points (210mm)

// Margins (8mm top/bottom, 4mm left/right)
const MARGIN_TOP = 22.68    // 8mm in points
const MARGIN_BOTTOM = 22.68 // 8mm in points
const MARGIN_LEFT = 11.34   // 4mm in points
const MARGIN_RIGHT = 11.34  // 4mm in points

// Printable area
const PRINTABLE_WIDTH = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT   // 572.6 points
const PRINTABLE_HEIGHT = A4_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM // 796.53 points
const PRINTABLE_LANDSCAPE_WIDTH = A4_LANDSCAPE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT   // 819.21 points
const PRINTABLE_LANDSCAPE_HEIGHT = A4_LANDSCAPE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM // 549.92 points

export async function generateWorktopQuotePdfKit({
  quote,
  tenantCompany,
  summary,
  discountAmount,
  discountPercentage,
  tenantCompanyLogoBase64,
  turinovaLogoBase64
}: WorktopQuotePdfKitProps): Promise<Buffer> {
  // Load PDFKit dynamically to avoid Next.js bundling issues
  // This ensures font files are loaded correctly at runtime
  const PDFDocument = (await import('pdfkit')).default
  const SVGtoPDF = (await import('svg-to-pdfkit')).default
  
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document (A4 portrait)
      // PDFKit has built-in support for standard fonts (Helvetica, Times-Roman, Courier)
      // These don't require external font files when used correctly
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: MARGIN_TOP,
          bottom: MARGIN_BOTTOM,
          left: MARGIN_LEFT,
          right: MARGIN_RIGHT
        },
        bufferPages: true, // Enable page buffering for multi-page documents
        autoFirstPage: true
      })

      const buffers: Buffer[] = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Generate first page (summary)
      generateFirstPage(doc, {
        quote,
        tenantCompany,
        summary,
        discountAmount,
        discountPercentage,
        tenantCompanyLogoBase64,
        turinovaLogoBase64
      })

      // Generate visualization pages
      if (quote.configs && quote.configs.length > 0) {
        quote.configs.forEach((config, index) => {
          generateVisualizationPage(doc, config, quote, index, SVGtoPDF)
        })
      }

      // Finalize PDF
      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

function generateFirstPage(
  doc: PDFKit.PDFDocument,
  props: WorktopQuotePdfKitProps
) {
  const { quote, tenantCompany, summary, discountAmount, discountPercentage, tenantCompanyLogoBase64, turinovaLogoBase64 } = props
  
  let y = MARGIN_TOP
  const lineHeight = 12
  const sectionSpacing = 15

  // Header with logo (left) and title/quote number/date (right) - matching orders PDF
  const headerBottomY = y + 50
  
  // Left: Logo
  if (tenantCompanyLogoBase64) {
    try {
      const logoBuffer = Buffer.from(tenantCompanyLogoBase64, 'base64')
      doc.image(logoBuffer, MARGIN_LEFT, y, { width: 220, height: 50, fit: [220, 50] })
    } catch (e) {
      // Logo loading failed, continue without it
    }
  }

  // Right: Title (spaced out), Quote number, Date, Expiry
  // Title with spacing: "A J A N L A T"
  doc.fontSize(16).font('Helvetica-Bold')
  const titleText = 'A J A N L A T'
  doc.text(titleText, PRINTABLE_WIDTH + MARGIN_LEFT - doc.widthOfString(titleText), y)
  y += 6

  doc.fontSize(12).font('Helvetica')
  const quoteNumberText = quote.quote_number || '—'
  doc.text(quoteNumberText, PRINTABLE_WIDTH + MARGIN_LEFT - doc.widthOfString(quoteNumberText), y)
  y += 6

  doc.fontSize(10).font('Helvetica')
  const dateText = `Kelt.: ${formatDate(quote.created_at)}`
  doc.text(dateText, PRINTABLE_WIDTH + MARGIN_LEFT - doc.widthOfString(dateText), y)
  y += 6
  
  const expiryDate = new Date(quote.created_at)
  expiryDate.setDate(expiryDate.getDate() + 14)
  const expiryDateText = `Érvényesség: ${formatDate(expiryDate.toISOString())}`
  doc.text(expiryDateText, PRINTABLE_WIDTH + MARGIN_LEFT - doc.widthOfString(expiryDateText), y)

  // Draw header bottom border
  doc.moveTo(MARGIN_LEFT, headerBottomY)
  doc.lineTo(PRINTABLE_WIDTH + MARGIN_LEFT, headerBottomY)
  doc.stroke()

  y = headerBottomY + sectionSpacing

  // Company and Customer info (two columns) - matching orders PDF
  const columnWidth = (PRINTABLE_WIDTH - 56.7) / 2 // 56.7 points = 20mm gap
  const leftX = MARGIN_LEFT
  const rightX = MARGIN_LEFT + columnWidth + 56.7

  // Left column: Company (Ajánlat adó:)
  doc.fontSize(11).font('Helvetica-Bold')
  doc.text('Ajánlat adó:', leftX, y)
  y += lineHeight

  doc.fontSize(10).font('Helvetica')
  doc.text(tenantCompany.name || '', leftX + 14.17, y, { width: columnWidth - 14.17 }) // 14.17 points = 5mm padding
  y += lineHeight
  doc.text(`${tenantCompany.postal_code || ''} ${tenantCompany.city || ''}`, leftX + 14.17, y, { width: columnWidth - 14.17 })
  y += lineHeight
  doc.text(tenantCompany.address || '', leftX + 14.17, y, { width: columnWidth - 14.17 })
  y += lineHeight
  if (tenantCompany.tax_number) {
    doc.text(`Adószám: ${tenantCompany.tax_number}`, leftX + 14.17, y, { width: columnWidth - 14.17 })
    y += lineHeight
  }

  // Right column: Customer (Vevő adatok)
  const customerStartY = y - (lineHeight * (tenantCompany.tax_number ? 4 : 3))
  doc.fontSize(11).font('Helvetica-Bold')
  doc.text('Vevő adatok', rightX, customerStartY)
  let customerCurrentY = customerStartY + lineHeight

  doc.fontSize(10).font('Helvetica')
  doc.text(quote.customer.billing_name || quote.customer.name || '', rightX + 14.17, customerCurrentY, { width: columnWidth - 14.17 })
  customerCurrentY += lineHeight
  const customerAddress = [
    quote.customer.billing_postal_code || '',
    quote.customer.billing_city || '',
    quote.customer.billing_street || '',
    quote.customer.billing_house_number || ''
  ].filter(Boolean).join(' ')
  doc.text(customerAddress, rightX + 14.17, customerCurrentY, { width: columnWidth - 14.17 })
  customerCurrentY += lineHeight
  if (quote.customer.email) {
    doc.text(`E-mail: ${quote.customer.email}`, rightX + 14.17, customerCurrentY, { width: columnWidth - 14.17 })
    customerCurrentY += lineHeight
  }
  if (quote.customer.mobile) {
    doc.text(`Telefon: ${quote.customer.mobile}`, rightX + 14.17, customerCurrentY, { width: columnWidth - 14.17 })
    customerCurrentY += lineHeight
  }
  if (quote.customer.billing_tax_number) {
    doc.text(`Adószám: ${quote.customer.billing_tax_number}`, rightX + 14.17, customerCurrentY, { width: columnWidth - 14.17 })
    customerCurrentY += lineHeight
  }

  y = Math.max(y, customerCurrentY) + sectionSpacing

  // Items table - matching orders PDF (6 columns: Megnevezés, Hull. szorzó, Típus, Mennyiség, Bruttó egységár, Bruttó részösszeg)
  const tableTop = y
  const tableRowHeight = 20
  // Column widths matching orders PDF layout
  const colWidths = [180, 60, 80, 90, 100, 100] // Adjusted to fit 6 columns
  let tableY = tableTop

  // Table header
  doc.fontSize(9).font('Helvetica-Bold')
  doc.rect(MARGIN_LEFT, tableY, PRINTABLE_WIDTH, tableRowHeight).stroke()
  doc.text('Megnevezés', MARGIN_LEFT + 5, tableY + 5)
  doc.text('Hull. szorzó', MARGIN_LEFT + colWidths[0] + 5, tableY + 5)
  doc.text('Típus', MARGIN_LEFT + colWidths[0] + colWidths[1] + 5, tableY + 5)
  doc.text('Mennyiség', MARGIN_LEFT + colWidths[0] + colWidths[1] + colWidths[2] + 5, tableY + 5, { align: 'right' })
  doc.text('Bruttó egységár', MARGIN_LEFT + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, tableY + 5, { align: 'right' })
  doc.text('Bruttó részösszeg', MARGIN_LEFT + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 5, tableY + 5, { align: 'right' })
  tableY += tableRowHeight

  // Materials rows
  doc.fontSize(8).font('Helvetica')
  quote.materials.forEach((material) => {
    // Check if we need extra height for board sharing info
    const hasBoardInfo = (material.boards_used && material.boards_used > 0)
    const rowHeight = hasBoardInfo ? tableRowHeight + 8 : tableRowHeight

    if (tableY + rowHeight > PRINTABLE_HEIGHT + MARGIN_TOP - 100) {
      // Need new page
      doc.addPage()
      tableY = MARGIN_TOP
    }

    const materialNameOnly = material.material_name.split(' (')[0].trim()
    const unitPriceGross = material.totalMeters > 0 ? material.totalGross / material.totalMeters : 0
    const roundedUnitPriceGross = Math.round(unitPriceGross * 100) / 100
    const recalculatedTotalGross = roundedUnitPriceGross * material.totalMeters

    // Draw row border and column dividers
    doc.rect(MARGIN_LEFT, tableY, PRINTABLE_WIDTH, rowHeight).stroke()
    let currentX = MARGIN_LEFT
    colWidths.forEach((width, idx) => {
      if (idx < colWidths.length - 1) {
        currentX += width
        doc.moveTo(currentX, tableY)
        doc.lineTo(currentX, tableY + rowHeight)
        doc.stroke()
      }
    })
    
    // Material name
    doc.text(`${materialNameOnly} (${material.assembly_type})`, MARGIN_LEFT + 5, tableY + 5, { width: colWidths[0] - 10 })
    
    // Board sharing info
    if (material.boards_shared && material.boards_used) {
      doc.fontSize(7).fillColor('#1976d2')
      doc.text(`📦 ${material.boards_used} tábla megosztva ${material.configs_count} konfiguráció között`, MARGIN_LEFT + 5, tableY + 12, { width: colWidths[0] - 10 })
      doc.fontSize(8).fillColor('black')
    } else if (material.boards_used) {
      doc.fontSize(7).fillColor('#757575')
      doc.text(`📦 ${material.boards_used} tábla`, MARGIN_LEFT + 5, tableY + 12, { width: colWidths[0] - 10 })
      doc.fontSize(8).fillColor('black')
    }
    doc.text('', MARGIN_LEFT + colWidths[0] + 5, tableY + 5, { width: colWidths[1] - 10 }) // Hull. szorzó - empty for worktops
    doc.text('Szálas termék', MARGIN_LEFT + colWidths[0] + colWidths[1] + 5, tableY + 5, { width: colWidths[2] - 10 })
    doc.text(`${material.totalMeters.toFixed(2)} m`, MARGIN_LEFT + colWidths[0] + colWidths[1] + colWidths[2] + 5, tableY + 5, { width: colWidths[3] - 10, align: 'right' })
    doc.text(`${formatCurrencyWithDecimals(roundedUnitPriceGross)} Ft`, MARGIN_LEFT + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, tableY + 5, { width: colWidths[4] - 10, align: 'right' })
    doc.text(`${formatCurrency(Math.round(recalculatedTotalGross))} Ft`, MARGIN_LEFT + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 5, tableY + 5, { width: colWidths[5] - 10, align: 'right' })
    tableY += rowHeight
  })

  // Services rows
  quote.services.forEach((service) => {
    if (tableY + tableRowHeight > PRINTABLE_HEIGHT + MARGIN_TOP - 100) {
      doc.addPage()
      tableY = MARGIN_TOP
    }

    // Draw row border and column dividers
    doc.rect(MARGIN_LEFT, tableY, PRINTABLE_WIDTH, tableRowHeight).stroke()
    let currentX = MARGIN_LEFT
    colWidths.forEach((width, idx) => {
      if (idx < colWidths.length - 1) {
        currentX += width
        doc.moveTo(currentX, tableY)
        doc.lineTo(currentX, tableY + tableRowHeight)
        doc.stroke()
      }
    })
    
    doc.text(getServiceName(service.service_type), MARGIN_LEFT + 5, tableY + 5, { width: colWidths[0] - 10 })
    doc.text('', MARGIN_LEFT + colWidths[0] + 5, tableY + 5, { width: colWidths[1] - 10 }) // Hull. szorzó - empty
    doc.text('Díj', MARGIN_LEFT + colWidths[0] + colWidths[1] + 5, tableY + 5, { width: colWidths[2] - 10 })
    doc.text(`${service.quantity} ${service.unit}`, MARGIN_LEFT + colWidths[0] + colWidths[1] + colWidths[2] + 5, tableY + 5, { width: colWidths[3] - 10, align: 'right' })
    doc.text(service.unitPrice ? `${formatCurrencyWithDecimals(service.unitPrice)} Ft` : '', MARGIN_LEFT + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, tableY + 5, { width: colWidths[4] - 10, align: 'right' })
    doc.text(`${formatCurrency(Math.round(service.totalGross))} Ft`, MARGIN_LEFT + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 5, tableY + 5, { width: colWidths[5] - 10, align: 'right' })
    tableY += tableRowHeight
  })

  // Summary table - matching orders PDF exactly
  tableY += 10
  const summaryRowHeight = 18
  const summaryColSpan = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] // First 5 columns (colspan="5")
  const summaryValueCol = colWidths[5] // Last column for values

  // Before discount rows (if discount exists) - matching orders PDF structure
  if (summary.totalGrossBeforeDiscount !== summary.totalGrossAfterDiscount) {
    // Net before discount
    doc.rect(MARGIN_LEFT, tableY, PRINTABLE_WIDTH, summaryRowHeight).stroke()
    doc.moveTo(MARGIN_LEFT + summaryColSpan, tableY)
    doc.lineTo(MARGIN_LEFT + summaryColSpan, tableY + summaryRowHeight)
    doc.stroke()
    doc.fontSize(9).font('Helvetica')
    doc.text('Nettó összesen:', MARGIN_LEFT + 5, tableY + 4)
    doc.text(`${formatCurrency(summary.totalNetBeforeDiscount)} Ft`, MARGIN_LEFT + summaryColSpan + 5, tableY + 4, { width: summaryValueCol - 10, align: 'right' })
    tableY += summaryRowHeight

    // VAT before discount
    doc.rect(MARGIN_LEFT, tableY, PRINTABLE_WIDTH, summaryRowHeight).stroke()
    doc.moveTo(MARGIN_LEFT + summaryColSpan, tableY)
    doc.lineTo(MARGIN_LEFT + summaryColSpan, tableY + summaryRowHeight)
    doc.stroke()
    doc.text('Áfa összesen:', MARGIN_LEFT + 5, tableY + 4)
    doc.text(`${formatCurrency(summary.totalVatBeforeDiscount)} Ft`, MARGIN_LEFT + summaryColSpan + 5, tableY + 4, { width: summaryValueCol - 10, align: 'right' })
    tableY += summaryRowHeight

    // Gross before discount
    doc.rect(MARGIN_LEFT, tableY, PRINTABLE_WIDTH, summaryRowHeight).stroke()
    doc.moveTo(MARGIN_LEFT + summaryColSpan, tableY)
    doc.lineTo(MARGIN_LEFT + summaryColSpan, tableY + summaryRowHeight)
    doc.stroke()
    doc.text('Bruttó összesen:', MARGIN_LEFT + 5, tableY + 4)
    doc.text(`${formatCurrency(summary.totalGrossBeforeDiscount)} Ft`, MARGIN_LEFT + summaryColSpan + 5, tableY + 4, { width: summaryValueCol - 10, align: 'right' })
    tableY += summaryRowHeight
  }

  // Discount
  if (discountAmount > 0) {
    doc.rect(MARGIN_LEFT, tableY, PRINTABLE_WIDTH, summaryRowHeight).stroke()
    doc.moveTo(MARGIN_LEFT + summaryColSpan, tableY)
    doc.lineTo(MARGIN_LEFT + summaryColSpan, tableY + summaryRowHeight)
    doc.stroke()
    
    doc.fontSize(9).font('Helvetica')
    doc.text(`Kedvezmény${discountPercentage > 0 ? ` (${discountPercentage}%)` : ''}:`, MARGIN_LEFT + 5, tableY + 4)
    doc.text(`-${formatCurrency(discountAmount)} Ft`, MARGIN_LEFT + summaryColSpan + 5, tableY + 4, { width: summaryValueCol - 10, align: 'right' })
    tableY += summaryRowHeight
  }

  // Net total
  doc.rect(MARGIN_LEFT, tableY, PRINTABLE_WIDTH, summaryRowHeight).stroke()
  doc.moveTo(MARGIN_LEFT + summaryColSpan, tableY)
  doc.lineTo(MARGIN_LEFT + summaryColSpan, tableY + summaryRowHeight)
  doc.stroke()
  
  doc.fontSize(9).font('Helvetica-Bold')
  doc.text('Nettó összesen:', MARGIN_LEFT + 5, tableY + 4)
  doc.text(`${formatCurrency(summary.totalNetAfterDiscount)} Ft`, MARGIN_LEFT + summaryColSpan + 5, tableY + 4, { width: summaryValueCol - 10, align: 'right' })
  tableY += summaryRowHeight

  // VAT total
  doc.rect(MARGIN_LEFT, tableY, PRINTABLE_WIDTH, summaryRowHeight).stroke()
  doc.moveTo(MARGIN_LEFT + summaryColSpan, tableY)
  doc.lineTo(MARGIN_LEFT + summaryColSpan, tableY + summaryRowHeight)
  doc.stroke()
  
  doc.fontSize(9).font('Helvetica-Bold')
  doc.text('Áfa összesen:', MARGIN_LEFT + 5, tableY + 4)
  doc.text(`${formatCurrency(summary.totalVatAfterDiscount)} Ft`, MARGIN_LEFT + summaryColSpan + 5, tableY + 4, { width: summaryValueCol - 10, align: 'right' })
  tableY += summaryRowHeight

  // Gross total
  doc.rect(MARGIN_LEFT, tableY, PRINTABLE_WIDTH, summaryRowHeight).stroke()
  doc.moveTo(MARGIN_LEFT + summaryColSpan, tableY)
  doc.lineTo(MARGIN_LEFT + summaryColSpan, tableY + summaryRowHeight)
  doc.stroke()
  
  doc.fontSize(11).font('Helvetica-Bold')
  doc.text('Bruttó összesen:', MARGIN_LEFT + 5, tableY + 4)
  doc.text(`${formatCurrency(summary.totalGrossAfterDiscount)} Ft`, MARGIN_LEFT + summaryColSpan + 5, tableY + 4, { width: summaryValueCol - 10, align: 'right' })

  // Comment if exists (before footer)
  if (quote.comment) {
    const commentY = tableY + summaryRowHeight + 20
    if (commentY < PRINTABLE_HEIGHT + MARGIN_TOP - 70) {
      doc.fontSize(9).font('Helvetica-Bold')
      doc.text('Megjegyzés:', MARGIN_LEFT, commentY)
      doc.fontSize(8).font('Helvetica')
      doc.text(quote.comment, MARGIN_LEFT, commentY + 15, { width: PRINTABLE_WIDTH })
    }
  }

  // Footer with text and Turinova logo - matching orders PDF
  const footerY = PRINTABLE_HEIGHT + MARGIN_TOP - 20
  doc.fontSize(9).font('Helvetica')
  const footerText = 'Ez az ajánlat a Turinova Vállalatirányítási Rendszerrel készült.'
  doc.text(footerText, MARGIN_LEFT, footerY)
  
  if (turinovaLogoBase64) {
    try {
      const logoBuffer = Buffer.from(turinovaLogoBase64, 'base64')
      const logoWidth = 50
      const logoHeight = 15
      const logoX = MARGIN_LEFT + PRINTABLE_WIDTH - logoWidth
      doc.image(logoBuffer, logoX, footerY - 2, { width: logoWidth, height: logoHeight })
    } catch (e) {
      // Logo loading failed, continue without it
    }
  }
}

function generateVisualizationPage(
  doc: any,
  config: WorktopConfig,
  quote: WorktopQuote,
  index: number,
  SVGtoPDFLib: any
) {
  // Add new page in landscape orientation
  doc.addPage({
    size: [A4_LANDSCAPE_WIDTH, A4_LANDSCAPE_HEIGHT],
    margins: {
      top: MARGIN_TOP,
      bottom: MARGIN_BOTTOM,
      left: MARGIN_LEFT,
      right: MARGIN_RIGHT
    }
  })

  // Header table
  const headerHeight = 60
  const headerY = MARGIN_TOP
  const headerRowHeight = headerHeight / 3

  // Draw header table borders
  doc.rect(MARGIN_LEFT, headerY, PRINTABLE_LANDSCAPE_WIDTH, headerHeight).stroke()

  // Header content
  doc.fontSize(7).font('Helvetica')
  let headerRowY = headerY + 5

  // Row 1: Vevő, Ajánlat, Dátum, Konfiguráció típus, Signature
  doc.font('Helvetica-Bold')
  doc.text('Vevő:', MARGIN_LEFT + 5, headerRowY)
  doc.font('Helvetica')
  const customerName = quote.customer.billing_name || quote.customer.name || '—'
  doc.text(customerName, MARGIN_LEFT + 50, headerRowY, { width: 120 })

  doc.font('Helvetica-Bold')
  doc.text('Ajánlat:', MARGIN_LEFT + 180, headerRowY)
  doc.font('Helvetica')
  doc.text(quote.quote_number || '—', MARGIN_LEFT + 230, headerRowY, { width: 80 })

  doc.font('Helvetica-Bold')
  doc.text('Dátum:', MARGIN_LEFT + 320, headerRowY)
  doc.font('Helvetica')
  doc.text(formatDate(quote.created_at), MARGIN_LEFT + 370, headerRowY, { width: 80 })

  doc.font('Helvetica-Bold')
  doc.text('Konfiguráció típus:', MARGIN_LEFT + 460, headerRowY)
  doc.font('Helvetica')
  doc.text(config.assembly_type || '—', MARGIN_LEFT + 580, headerRowY, { width: 100 })

  // Signature cell (spans 2 rows)
  doc.font('Helvetica-Bold')
  doc.text('EMgrendelő', MARGIN_LEFT + PRINTABLE_LANDSCAPE_WIDTH - 80, headerY + headerRowHeight / 2, { width: 70, align: 'center' })
  doc.text('aláírás', MARGIN_LEFT + PRINTABLE_LANDSCAPE_WIDTH - 80, headerY + headerRowHeight / 2 + 10, { width: 70, align: 'center' })

  headerRowY += headerRowHeight

  // Row 2: Munkalap típusa, ABCD, R1-R4, L1-L8
  doc.font('Helvetica-Bold')
  doc.text('Munkalap típusa:', MARGIN_LEFT + 5, headerRowY)
  doc.font('Helvetica')
  const materialForConfig = quote.materials.find(m => m.assembly_type === config.assembly_type)
  const materialName = materialForConfig ? materialForConfig.material_name : config.linear_material_name || '-'
  doc.text(materialName, MARGIN_LEFT + 80, headerRowY, { width: 100 })

  doc.font('Helvetica-Bold')
  doc.text('ABCD:', MARGIN_LEFT + 190, headerRowY)
  doc.font('Helvetica')
  const abcdText = `A:${config.dimension_a}mm B:${config.dimension_b}mm${config.dimension_c !== null ? ` C:${config.dimension_c}mm` : ''}${config.dimension_d !== null ? ` D:${config.dimension_d}mm` : ''}`
  doc.text(abcdText, MARGIN_LEFT + 240, headerRowY, { width: 150 })

  doc.font('Helvetica-Bold')
  doc.text('R1-R4:', MARGIN_LEFT + 400, headerRowY)
  doc.font('Helvetica')
  const rValues = []
  if (config.rounding_r1 && config.rounding_r1 > 0) rValues.push(`R1:${config.rounding_r1}mm`)
  if (config.rounding_r2 && config.rounding_r2 > 0) rValues.push(`R2:${config.rounding_r2}mm`)
  if (config.rounding_r3 && config.rounding_r3 > 0) rValues.push(`R3:${config.rounding_r3}mm`)
  if (config.rounding_r4 && config.rounding_r4 > 0) rValues.push(`R4:${config.rounding_r4}mm`)
  doc.text(rValues.length > 0 ? rValues.join(' ') : 'Nincs', MARGIN_LEFT + 450, headerRowY, { width: 150 })

  doc.font('Helvetica-Bold')
  doc.text('L1-L8:', MARGIN_LEFT + 610, headerRowY)
  doc.font('Helvetica')
  const lValues = []
  if (config.cut_l1 && config.cut_l1 > 0) lValues.push(`L1:${config.cut_l1}mm`)
  if (config.cut_l2 && config.cut_l2 > 0) lValues.push(`L2:${config.cut_l2}mm`)
  if (config.cut_l3 && config.cut_l3 > 0) lValues.push(`L3:${config.cut_l3}mm`)
  if (config.cut_l4 && config.cut_l4 > 0) lValues.push(`L4:${config.cut_l4}mm`)
  if (config.cut_l5 && config.cut_l5 > 0) lValues.push(`L5:${config.cut_l5}mm`)
  if (config.cut_l6 && config.cut_l6 > 0) lValues.push(`L6:${config.cut_l6}mm`)
  if (config.cut_l7 && config.cut_l7 > 0) lValues.push(`L7:${config.cut_l7}mm`)
  if (config.cut_l8 && config.cut_l8 > 0) lValues.push(`L8:${config.cut_l8}mm`)
  doc.text(lValues.length > 0 ? lValues.join(' ') : 'Nincs', MARGIN_LEFT + 660, headerRowY, { width: 150 })

  headerRowY += headerRowHeight

  // Row 3: Kivágás
  doc.font('Helvetica-Bold')
  doc.text('Kivágás:', MARGIN_LEFT + 5, headerRowY)
  doc.font('Helvetica')
  let cutoutsData: any[] = []
  try {
    cutoutsData = config.cutouts ? JSON.parse(config.cutouts) : []
  } catch (e) {
    cutoutsData = []
  }
  const cutoutsDisplay = cutoutsData.length > 0 
    ? cutoutsData.map((cutout: any, idx: number) => 
        `${idx + 1}: ${cutout.width || '-'}×${cutout.height || '-'}mm`
      ).join('; ')
    : 'Nincs'
  doc.text(cutoutsDisplay, MARGIN_LEFT + 50, headerRowY, { width: PRINTABLE_LANDSCAPE_WIDTH - 100 })

  // Visualization area (below header)
  const visualizationY = headerY + headerHeight + 5
  const visualizationHeight = PRINTABLE_LANDSCAPE_HEIGHT - headerHeight - 10
  const visualizationWidth = PRINTABLE_LANDSCAPE_WIDTH

  // Generate SVG
  const svgContent = generateWorktopSvg(config)

  // Render SVG to PDF
  try {
    // SVGtoPDF renders SVG directly to PDF
    // The SVG from generateWorktopSvg is already in landscape orientation with proper scaling
    SVGtoPDFLib(doc, svgContent, MARGIN_LEFT, visualizationY, {
      width: visualizationWidth,
      height: visualizationHeight,
      preserveAspectRatio: 'xMidYMid meet'
    })
  } catch (error) {
    console.error('Error rendering SVG to PDF:', error)
    // Fallback: show error message
    doc.fontSize(12).font('Helvetica')
    doc.text('Hiba a vizualizáció renderelésekor', MARGIN_LEFT + visualizationWidth / 2, visualizationY + visualizationHeight / 2, { align: 'center' })
  }
}
