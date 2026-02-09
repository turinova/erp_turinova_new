// PDFKit generator for visualization pages only
// First page is generated with Puppeteer (existing HTML template)

import { generateWorktopSvg } from './svg-generator-comprehensive'

interface WorktopConfig {
  id: string
  config_order: number
  assembly_type: string
  linear_material_name: string
  edge_banding: string
  edge_color_choice: string
  edge_color_text: string | null
  no_postforming_edge: boolean
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
  materials: any[]
  services: any[]
  materialsTotalGross: number
  servicesTotalGross: number
  materialsTotalNet: number
  servicesTotalNet: number
  materialsTotalVat: number
  servicesTotalVat: number
  configs: WorktopConfig[]
}

// PDF Dimensions (A4 Portrait)
const A4_PORTRAIT_WIDTH = 595.28  // A4 portrait width in points (210mm)
const A4_PORTRAIT_HEIGHT = 841.89 // A4 portrait height in points (297mm)

// Margins (8mm top/bottom, 4mm left/right)
const MARGIN_TOP = 22.68    // 8mm in points
const MARGIN_BOTTOM = 22.68 // 8mm in points
const MARGIN_LEFT = 11.34   // 4mm in points
const MARGIN_RIGHT = 11.34  // 4mm in points

// Printable area for portrait
const PRINTABLE_PORTRAIT_WIDTH = A4_PORTRAIT_WIDTH - MARGIN_LEFT - MARGIN_RIGHT   // 572.6 points (202mm)
const PRINTABLE_PORTRAIT_HEIGHT = A4_PORTRAIT_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM // 796.53 points (281mm)

// Helper functions
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}.`
}

const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return '—'
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function generateVisualizationPagesPdfKit(
  configs: WorktopConfig[],
  quote: WorktopQuote
): Promise<Buffer> {
  // Load PDFKit dynamically to avoid Next.js bundling issues
  const PDFDocument = (await import('pdfkit')).default
  const SVGtoPDF = (await import('svg-to-pdfkit')).default
  
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document (no first page - we'll add portrait pages)
      const doc = new PDFDocument({
        size: [A4_PORTRAIT_WIDTH, A4_PORTRAIT_HEIGHT],
        margins: {
          top: MARGIN_TOP,
          bottom: MARGIN_BOTTOM,
          left: MARGIN_LEFT,
          right: MARGIN_RIGHT
        },
        bufferPages: true,
        autoFirstPage: false // Don't create first page automatically
      })

      const buffers: Buffer[] = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Generate visualization pages
      if (configs && configs.length > 0) {
        configs.forEach((config, index) => {
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

function generateVisualizationPage(
  doc: any,
  config: WorktopConfig,
  quote: WorktopQuote,
  index: number,
  SVGtoPDF: any
) {
  // Add new page in portrait orientation
  doc.addPage({
    size: [A4_PORTRAIT_WIDTH, A4_PORTRAIT_HEIGHT],
    margins: {
      top: MARGIN_TOP,
      bottom: MARGIN_BOTTOM,
      left: MARGIN_LEFT,
      right: MARGIN_RIGHT
    }
  })

  // Set font immediately after page creation (required for PDFKit)
  doc.fontSize(7)
  doc.font('Helvetica')

  // Parse cutouts
  let cutoutsData: any[] = []
  try {
    cutoutsData = config.cutouts ? JSON.parse(config.cutouts) : []
  } catch (e) {
    cutoutsData = []
  }

  // Professional two-column blueprint-style layout
  const COLUMN_GAP = 8 // Gap between two main columns
  const LEFT_COL_WIDTH = Math.floor((PRINTABLE_PORTRAIT_WIDTH - COLUMN_GAP) / 2)
  const RIGHT_COL_WIDTH = PRINTABLE_PORTRAIT_WIDTH - LEFT_COL_WIDTH - COLUMN_GAP
  const LABEL_COL_WIDTH = Math.floor(LEFT_COL_WIDTH * 0.35) // 35% for labels in left column
  const DATA_COL_WIDTH = LEFT_COL_WIDTH - LABEL_COL_WIDTH // Remaining for data
  const MIN_ROW_HEIGHT = 14 // Minimum row height in points
  const CELL_PADDING = 3 // Padding inside cells
  const SECTION_SPACING = 2 // Spacing between sections
  
  // Set thinner line width for table borders (default is 1, using 0.5 for thinner lines)
  doc.lineWidth(0.5)
  
  const headerY = MARGIN_TOP
  let currentY = headerY
  
  // Helper function to measure text height
  const measureTextHeight = (text: string, width: number, fontSize: number = 7): number => {
    doc.fontSize(fontSize)
    doc.font('Helvetica') // Ensure font is set
    const lines = doc.heightOfString(text, { width: width - (CELL_PADDING * 2) })
    return Math.max(MIN_ROW_HEIGHT, lines + (CELL_PADDING * 2))
  }
  
  // Helper function to wrap text instead of truncating (for important data)
  const wrapText = (text: string, maxWidth: number, fontSize: number = 7): string[] => {
    doc.fontSize(fontSize)
    doc.font('Helvetica') // Ensure font is set
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = doc.widthOfString(testLine)
      
      if (testWidth <= maxWidth - (CELL_PADDING * 2)) {
        currentLine = testLine
      } else {
        if (currentLine) {
          lines.push(currentLine)
          currentLine = word
    } else {
          // Word is too long, force it
          lines.push(word)
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine)
    }
    return lines.length > 0 ? lines : [text]
  }
  
  // Helper function to draw a field row (label + value) in left column
  const drawLeftField = (label: string, value: string, y: number, allowWrap: boolean = false): number => {
    doc.fontSize(7)
    const valueWidth = DATA_COL_WIDTH
    
    // Measure height needed
    let rowHeight = MIN_ROW_HEIGHT
    if (allowWrap) {
      const wrappedLines = wrapText(value, valueWidth)
      const textHeight = wrappedLines.length * (doc.currentLineHeight() || 10) + (CELL_PADDING * 2)
      rowHeight = Math.max(MIN_ROW_HEIGHT, textHeight)
    } else {
      rowHeight = Math.max(MIN_ROW_HEIGHT, measureTextHeight(value, valueWidth))
    }
    
    // Draw borders
    const leftX = MARGIN_LEFT
    const rightX = MARGIN_LEFT + LEFT_COL_WIDTH
    
    // Top border
    doc.moveTo(leftX, y)
    doc.lineTo(rightX, y)
    doc.stroke()
    // Bottom border
    doc.moveTo(leftX, y + rowHeight)
    doc.lineTo(rightX, y + rowHeight)
    doc.stroke()
    // Left border
    doc.moveTo(leftX, y)
    doc.lineTo(leftX, y + rowHeight)
    doc.stroke()
    // Label divider
    const dividerX = leftX + LABEL_COL_WIDTH
    doc.moveTo(dividerX, y)
    doc.lineTo(dividerX, y + rowHeight)
    doc.stroke()
    // Right border
    doc.moveTo(rightX, y)
    doc.lineTo(rightX, y + rowHeight)
    doc.stroke()
    
    // Draw label
    doc.font('Helvetica-Bold').fontSize(7)
    const labelY = y + (rowHeight - (doc.currentLineHeight() || 10)) / 2
    doc.text(label, leftX + CELL_PADDING, labelY, { width: LABEL_COL_WIDTH - (CELL_PADDING * 2) })
    
    // Draw value
    doc.font('Helvetica').fontSize(7)
    if (allowWrap) {
      const wrappedLines = wrapText(value, valueWidth)
      let textY = y + CELL_PADDING
      wrappedLines.forEach(line => {
        doc.text(line, dividerX + CELL_PADDING, textY, { width: valueWidth - (CELL_PADDING * 2) })
        textY += doc.currentLineHeight() || 10
      })
    } else {
      const textY = y + (rowHeight - (doc.currentLineHeight() || 10)) / 2
      doc.text(value, dividerX + CELL_PADDING, textY, { width: valueWidth - (CELL_PADDING * 2) })
    }
    
    return rowHeight
  }
  
  // Helper function to draw a field row (label + value) in right column
  const drawRightField = (label: string, value: string, y: number, allowWrap: boolean = false): number => {
    doc.fontSize(7)
    const rightColLabelWidth = Math.floor(RIGHT_COL_WIDTH * 0.35)
    const rightColDataWidth = RIGHT_COL_WIDTH - rightColLabelWidth
    const valueWidth = rightColDataWidth
    
    // Measure height needed
    let rowHeight = MIN_ROW_HEIGHT
    if (allowWrap) {
      const wrappedLines = wrapText(value, valueWidth)
      const textHeight = wrappedLines.length * (doc.currentLineHeight() || 10) + (CELL_PADDING * 2)
      rowHeight = Math.max(MIN_ROW_HEIGHT, textHeight)
    } else {
      rowHeight = Math.max(MIN_ROW_HEIGHT, measureTextHeight(value, valueWidth))
    }
    
    // Draw borders
    const leftX = MARGIN_LEFT + LEFT_COL_WIDTH + COLUMN_GAP
    const rightX = MARGIN_LEFT + PRINTABLE_PORTRAIT_WIDTH
    
    // Top border
    doc.moveTo(leftX, y)
    doc.lineTo(rightX, y)
    doc.stroke()
    // Bottom border
    doc.moveTo(leftX, y + rowHeight)
    doc.lineTo(rightX, y + rowHeight)
    doc.stroke()
    // Left border
    doc.moveTo(leftX, y)
    doc.lineTo(leftX, y + rowHeight)
    doc.stroke()
    // Label divider
    const dividerX = leftX + rightColLabelWidth
    doc.moveTo(dividerX, y)
    doc.lineTo(dividerX, y + rowHeight)
          doc.stroke()
    // Right border
    doc.moveTo(rightX, y)
    doc.lineTo(rightX, y + rowHeight)
    doc.stroke()
    
    // Draw label
    doc.font('Helvetica-Bold').fontSize(7)
    const labelY = y + (rowHeight - (doc.currentLineHeight() || 10)) / 2
    doc.text(label, leftX + CELL_PADDING, labelY, { width: rightColLabelWidth - (CELL_PADDING * 2) })
    
    // Draw value
    doc.font('Helvetica').fontSize(7)
    if (allowWrap) {
      const wrappedLines = wrapText(value, valueWidth)
      let textY = y + CELL_PADDING
      wrappedLines.forEach(line => {
        doc.text(line, dividerX + CELL_PADDING, textY, { width: valueWidth - (CELL_PADDING * 2) })
        textY += doc.currentLineHeight() || 10
      })
    } else {
      const textY = y + (rowHeight - (doc.currentLineHeight() || 10)) / 2
      doc.text(value, dividerX + CELL_PADDING, textY, { width: valueWidth - (CELL_PADDING * 2) })
    }
    
    return rowHeight
  }
  
  // Helper function to draw a compact grid for multiple values (e.g., L1-L8, R1-R4)
  const drawCompactGrid = (label: string, items: Array<{ label: string, value: string }>, y: number, numCols: number = 4): number => {
    const labelWidth = LABEL_COL_WIDTH
    const gridWidth = LEFT_COL_WIDTH - labelWidth
    const colWidth = Math.floor(gridWidth / numCols)
    const rowHeight = MIN_ROW_HEIGHT
    
    // Draw borders
    const leftX = MARGIN_LEFT
    const rightX = MARGIN_LEFT + LEFT_COL_WIDTH
    
    // Draw main label
    doc.font('Helvetica-Bold').fontSize(7)
    const labelY = y + (rowHeight - (doc.currentLineHeight() || 10)) / 2
    doc.text(label, leftX + CELL_PADDING, labelY, { width: labelWidth - (CELL_PADDING * 2) })
    
    // Draw grid items
    doc.font('Helvetica').fontSize(7)
    const visibleItems = items.filter(item => item.value !== '—' || item.label)
    
    // Check if we need a second row
    const needsSecondRow = visibleItems.length > numCols
    const totalHeight = needsSecondRow ? rowHeight + MIN_ROW_HEIGHT : rowHeight
    
    // Draw all borders for the complete grid (including second row if needed)
    // Top border
    doc.moveTo(leftX, y)
    doc.lineTo(rightX, y)
    doc.stroke()
    // Bottom border (for complete grid)
    doc.moveTo(leftX, y + totalHeight)
    doc.lineTo(rightX, y + totalHeight)
    doc.stroke()
    // Left border (full height)
    doc.moveTo(leftX, y)
    doc.lineTo(leftX, y + totalHeight)
    doc.stroke()
    // Label divider (full height)
    const dividerX = leftX + labelWidth
    doc.moveTo(dividerX, y)
    doc.lineTo(dividerX, y + totalHeight)
    doc.stroke()
    // Grid dividers (full height)
    for (let i = 1; i < numCols; i++) {
      const gridX = dividerX + (i * colWidth)
      doc.moveTo(gridX, y)
      doc.lineTo(gridX, y + totalHeight)
      doc.stroke()
    }
    // Right border (full height)
    doc.moveTo(rightX, y)
    doc.lineTo(rightX, y + totalHeight)
    doc.stroke()
    
    // Draw middle border between rows if second row exists
    if (needsSecondRow) {
      const secondRowY = y + rowHeight
      doc.moveTo(leftX, secondRowY)
      doc.lineTo(rightX, secondRowY)
      doc.stroke()
    }
    
    // Draw first row items
    visibleItems.forEach((item, idx) => {
      if (idx >= numCols) return
      const col = idx % numCols
      const gridX = dividerX + (col * colWidth)
      const itemText = `${item.label}: ${item.value}`
      const textY = y + (rowHeight - (doc.currentLineHeight() || 10)) / 2
      doc.text(itemText, gridX + CELL_PADDING, textY, { width: colWidth - (CELL_PADDING * 2) })
    })
    
    // Draw second row items if needed
    if (needsSecondRow) {
      const secondRowY = y + rowHeight
      const secondRowHeight = MIN_ROW_HEIGHT
      
      visibleItems.slice(numCols).forEach((item, idx) => {
        if (idx >= numCols) return
        const col = idx % numCols
        const gridX = dividerX + (col * colWidth)
        const itemText = `${item.label}: ${item.value}`
        const textY = secondRowY + (secondRowHeight - (doc.currentLineHeight() || 10)) / 2
        doc.text(itemText, gridX + CELL_PADDING, textY, { width: colWidth - (CELL_PADDING * 2) })
      })
      
      return totalHeight
    }
    
    return rowHeight
  }
  
  // Helper function to draw a compact grid for right column
  const drawRightCompactGrid = (label: string, items: Array<{ label: string, value: string }>, y: number, numCols: number = 4): number => {
    const rightColLabelWidth = Math.floor(RIGHT_COL_WIDTH * 0.35)
    const labelWidth = rightColLabelWidth
    const gridWidth = RIGHT_COL_WIDTH - labelWidth
    const colWidth = Math.floor(gridWidth / numCols)
    const rowHeight = MIN_ROW_HEIGHT
    
    // Draw borders
    const leftX = MARGIN_LEFT + LEFT_COL_WIDTH + COLUMN_GAP
    const rightX = MARGIN_LEFT + PRINTABLE_PORTRAIT_WIDTH
    
    // Top border
    doc.moveTo(leftX, y)
    doc.lineTo(rightX, y)
    doc.stroke()
    // Bottom border
    doc.moveTo(leftX, y + rowHeight)
    doc.lineTo(rightX, y + rowHeight)
    doc.stroke()
    // Draw main label
    doc.font('Helvetica-Bold').fontSize(7)
    const labelY = y + (rowHeight - (doc.currentLineHeight() || 10)) / 2
    doc.text(label, leftX + CELL_PADDING, labelY, { width: labelWidth - (CELL_PADDING * 2) })
    
    // Draw grid items
    doc.font('Helvetica').fontSize(7)
    const visibleItems = items.filter(item => item.value !== '—' || item.label)
    
    // Check if we need a second row
    const needsSecondRow = visibleItems.length > numCols
    const totalHeight = needsSecondRow ? rowHeight + MIN_ROW_HEIGHT : rowHeight
    
    // Draw all borders for the complete grid (including second row if needed)
    // Top border
    doc.moveTo(leftX, y)
    doc.lineTo(rightX, y)
    doc.stroke()
    // Bottom border (for complete grid)
    doc.moveTo(leftX, y + totalHeight)
    doc.lineTo(rightX, y + totalHeight)
    doc.stroke()
    // Left border (full height)
    doc.moveTo(leftX, y)
    doc.lineTo(leftX, y + totalHeight)
    doc.stroke()
    // Label divider (full height)
    const dividerX = leftX + labelWidth
    doc.moveTo(dividerX, y)
    doc.lineTo(dividerX, y + totalHeight)
    doc.stroke()
    // Grid dividers (full height)
    for (let i = 1; i < numCols; i++) {
      const gridX = dividerX + (i * colWidth)
      doc.moveTo(gridX, y)
      doc.lineTo(gridX, y + totalHeight)
      doc.stroke()
    }
    // Right border (full height)
    doc.moveTo(rightX, y)
    doc.lineTo(rightX, y + totalHeight)
    doc.stroke()
    
    // Draw middle border between rows if second row exists
    if (needsSecondRow) {
      const secondRowY = y + rowHeight
      doc.moveTo(leftX, secondRowY)
      doc.lineTo(rightX, secondRowY)
      doc.stroke()
    }
    
    // Draw first row items
    visibleItems.forEach((item, idx) => {
      if (idx >= numCols) return
      const col = idx % numCols
      const gridX = dividerX + (col * colWidth)
      const itemText = `${item.label}: ${item.value}`
      const textY = y + (rowHeight - (doc.currentLineHeight() || 10)) / 2
      doc.text(itemText, gridX + CELL_PADDING, textY, { width: colWidth - (CELL_PADDING * 2) })
    })
    
    // Draw second row items if needed
    if (needsSecondRow) {
      const secondRowY = y + rowHeight
      const secondRowHeight = MIN_ROW_HEIGHT
      
      visibleItems.slice(numCols).forEach((item, idx) => {
        if (idx >= numCols) return
        const col = idx % numCols
        const gridX = dividerX + (col * colWidth)
        const itemText = `${item.label}: ${item.value}`
        const textY = secondRowY + (secondRowHeight - (doc.currentLineHeight() || 10)) / 2
        doc.text(itemText, gridX + CELL_PADDING, textY, { width: colWidth - (CELL_PADDING * 2) })
      })
      
      return totalHeight
    }
    
    return rowHeight
  }
  
  // Get customer name from customer.name (not billing_name)
  const customerName = quote.customer.name || '—'
  const materialName = config.linear_material_name || '—'
  const edgeColorText = config.edge_color_choice === 'Egyéb szín' && config.edge_color_text 
    ? config.edge_color_text 
    : (config.edge_color_choice || 'Színazonos')
  
  // LEFT COLUMN - Main information
  let leftY = currentY
  
  // Customer information
  const h1 = drawLeftField('Megrendelő:', customerName, leftY, true)
  leftY += h1
  
  const h2 = drawLeftField('Telefon:', quote.customer.mobile || '—', leftY)
  leftY += h2
  
  const h3 = drawLeftField('Ajánlat szám:', quote.quote_number || '—', leftY)
  leftY += h3
  
  const h4 = drawLeftField('Dátum:', formatDate(quote.created_at), leftY)
  leftY += h4
  
  leftY += SECTION_SPACING
  
  // Material information
  const h5 = drawLeftField('Anyag neve:', materialName, leftY, true)
  leftY += h5
  
  const h6 = drawLeftField('Élzáró anyag:', config.edge_banding || 'Nincs élzáró', leftY)
  leftY += h6
  
  const h7 = drawLeftField('Élzáró színe:', edgeColorText, leftY)
  leftY += h7
  
  const h8 = drawLeftField('Postforming:', config.no_postforming_edge ? 'NEM' : 'IGEN', leftY)
  leftY += h8
  
  leftY += SECTION_SPACING
  
  // Dimensions
  const h9 = drawLeftField('A:', `${config.dimension_a}mm`, leftY)
  leftY += h9
  
  const h10 = drawLeftField('B:', `${config.dimension_b}mm`, leftY)
  leftY += h10
  
  const h11 = drawLeftField('C:', config.dimension_c ? `${config.dimension_c}mm` : '—', leftY)
  leftY += h11
  
  const h12 = drawLeftField('D:', config.dimension_d ? `${config.dimension_d}mm` : '—', leftY)
  leftY += h12
  
  // RIGHT COLUMN - Edge positions and cutouts
  let rightY = currentY
  
  // Edge positions
  const edgePositions = [
    config.edge_position1, config.edge_position2, config.edge_position3,
    config.edge_position4, config.edge_position5, config.edge_position6
  ]
  for (let i = 0; i < 6; i++) {
    const h = drawRightField(`${i + 1}. oldal:`, edgePositions[i] ? 'IGEN' : 'NEM', rightY)
    rightY += h
  }
  
  rightY += SECTION_SPACING
  
  // Cutouts
  if (cutoutsData.length > 0) {
    cutoutsData.forEach((cutout: any, idx: number) => {
      const cutoutValue = `${cutout.width || '—'}×${cutout.height || '—'}mm, Bal: ${cutout.distanceFromLeft || '—'}mm, Alul: ${cutout.distanceFromBottom || '—'}mm${cutout.worktopType ? ` (${cutout.worktopType})` : ''}`
      const h = drawRightField(`Kivágás ${idx + 1}:`, cutoutValue, rightY, true)
      rightY += h
    })
  } else {
    const h = drawRightField('Kivágás:', 'Nincs', rightY)
    rightY += h
  }
  
  rightY += SECTION_SPACING
  
  // Rounding values (R1-R4) - compact grid in right column
  const rItems = [
    { label: 'R1', value: config.rounding_r1 ? `${config.rounding_r1}mm` : '—' },
    { label: 'R2', value: config.rounding_r2 ? `${config.rounding_r2}mm` : '—' },
    { label: 'R3', value: config.rounding_r3 ? `${config.rounding_r3}mm` : '—' },
    { label: 'R4', value: config.rounding_r4 ? `${config.rounding_r4}mm` : '—' }
  ]
  const h13 = drawRightCompactGrid('Íves vágás:', rItems, rightY, 4)
  rightY += h13
  
  rightY += SECTION_SPACING
  
  // Cut values (L1-L8) - compact grid in right column
  const lValues = [
    config.cut_l1, config.cut_l2, config.cut_l3, config.cut_l4,
    config.cut_l5, config.cut_l6, config.cut_l7, config.cut_l8
  ]
  const lItems = lValues.map((val, idx) => ({
    label: `L${idx + 1}`,
    value: val ? `${val}mm` : '—'
  }))
  const h14 = drawRightCompactGrid('Szögvágás:', lItems, rightY, 4)
  rightY += h14
  
  // Update currentY to the maximum of left and right columns
  currentY = Math.max(leftY, rightY)
  
  // Draw unified outer border around entire header table
  const headerHeight = currentY - headerY
  doc.rect(MARGIN_LEFT, headerY, PRINTABLE_PORTRAIT_WIDTH, headerHeight).stroke()
  
  // Draw vertical divider between left and right columns
  const columnDividerX = MARGIN_LEFT + LEFT_COL_WIDTH
  doc.moveTo(columnDividerX, headerY)
  doc.lineTo(columnDividerX, currentY)
  doc.stroke()

  // Visualization area (below header) - use actual header height
  const visualizationY = currentY + 5 // Small gap after header
  const visualizationHeight = PRINTABLE_PORTRAIT_HEIGHT - headerHeight - 10 // Account for actual header height and gap
  const visualizationWidth = PRINTABLE_PORTRAIT_WIDTH

  // Generate SVG
  const svgContent = generateWorktopSvg(config)

  // Render SVG to PDF
  try {
    SVGtoPDF(doc, svgContent, MARGIN_LEFT, visualizationY, {
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
