import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/print/label
 * Generate ZPL commands for Zebra ZD220 printer and send to printer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { item, fields, amount, labelSize } = body

    if (!item || !fields || !amount || !labelSize) {
      return NextResponse.json({ error: 'Hiányzó adatok' }, { status: 400 })
    }

    // Validate at least one field is selected
    if (!fields.showName && !fields.showSku && !fields.showBarcode && !fields.showPrice) {
      return NextResponse.json({ error: 'Válasszon ki legalább egy mezőt' }, { status: 400 })
    }

    // Generate ZPL commands for each label
    // Zebra ZD220: 203 DPI
    // 33mm = 33 * 203 / 25.4 ≈ 264 dots
    // 25mm = 25 * 203 / 25.4 ≈ 200 dots
    const labelWidth = 264 // dots
    const labelHeight = 200 // dots
    
    const zplCommands: string[] = []
    
    for (let i = 0; i < amount; i++) {
      let zpl = '^XA' // Start of label
      
      // Set label dimensions
      zpl += `^LL${labelHeight}` // Label length in dots
      zpl += `^PW${labelWidth}` // Print width in dots
      
      const leftMargin = 10
      const barcodeHeight = 50 // Space reserved for barcode at bottom
      const topMargin = 5
      const availableHeight = labelHeight - barcodeHeight - topMargin // Space for text above barcode
      
      // Calculate positions to fill available space
      let currentY = topMargin
      const fieldsToShow = [
        fields.showName ? 'name' : null,
        fields.showSku ? 'sku' : null,
        fields.showPrice ? 'price' : null
      ].filter(Boolean)
      
      const fieldCount = fieldsToShow.length
      const spacePerField = fieldCount > 0 ? availableHeight / fieldCount : 0
      
      // Product Name (if selected) - allow wrapping to multiple lines
      if (fields.showName && item.name) {
        // Split name into multiple lines if too long (max ~28 chars per line for 33mm width with bigger font)
        const maxCharsPerLine = 28
        const nameLines = wrapText(item.name, maxCharsPerLine)
        const nameFontSize = 29 // 30% bigger (22 * 1.3 = 28.6 ≈ 29)
        
        nameLines.forEach((line, index) => {
          if (currentY < labelHeight - barcodeHeight - 10) {
            // ^CF sets font, ^FO sets position, ^FD is data, ^FS is field stop
            // Using ^CF0 for default font, ^A0N for scalable font
            zpl += `^FO${leftMargin},${currentY}^A0N,${nameFontSize},${nameFontSize}^FD${escapeZPL(line)}^FS`
            currentY += nameFontSize + 2
          }
        })
        currentY += 2 // Spacing after name
      }
      
      // SKU (if selected) - no "SKU:" prefix
      if (fields.showSku && item.sku) {
        const skuFontSize = 36 // Double size (18 * 2)
        zpl += `^FO${leftMargin},${currentY}^A0N,${skuFontSize},${skuFontSize}^FD${escapeZPL(item.sku)}^FS`
        currentY += skuFontSize + 3
      }
      
      // Price (if selected) - biggest font, positioned near barcode
      if (fields.showPrice && item.sellingPrice) {
        const priceFontSize = 64 // Double size
        const priceText = `${formatPrice(item.sellingPrice)} Ft`
        // Position price just above barcode area (adjust for larger font)
        const priceY = labelHeight - barcodeHeight - 10
        zpl += `^FO${leftMargin},${priceY}^A0N,${priceFontSize},${priceFontSize}^FD${escapeZPL(priceText)}^FS`
      }
      
      // Barcode (always at bottom if selected, full width)
      if (fields.showBarcode && item.barcode) {
        // Position barcode at bottom
        const barcodeY = labelHeight - 45
        const barcodeX = 5 // Small left margin
        const availableWidth = labelWidth - 10 // Full width minus small margins
        
        // CODE128 barcode: each character uses ~11 modules
        // Calculate optimal module width to use full available width
        // Module width range: 1-10 (typically 2-4)
        const charsInBarcode = item.barcode.length
        const modulesPerChar = 11
        const totalModules = charsInBarcode * modulesPerChar
        const optimalModuleWidth = Math.max(1, Math.min(10, Math.floor(availableWidth / totalModules)))
        
        // Use calculated module width, narrow bar ratio 2:1, height 30
        zpl += `^FO${barcodeX},${barcodeY}^BY${optimalModuleWidth},2,30^BCN,30,Y,N,N^FD${item.barcode}^FS`
      }
      
      zpl += '^XZ' // End of label
      
      zplCommands.push(zpl)
    }

    // For now, return ZPL commands
    // In production, you would send these to the printer via:
    // 1. Network printer (TCP/IP)
    // 2. USB printer (via system print service)
    // 3. Browser print (convert ZPL to image/PDF)
    
    // Option 1: Return ZPL for client-side printing
    // Option 2: Send directly to printer (requires printer IP/connection)
    
    // For MVP, we'll return ZPL and let client handle printing
    // In production, you might want to:
    // - Store printer IP in environment variable
    // - Use node-printer or similar library
    // - Send ZPL via TCP/IP to printer
    
    return NextResponse.json({
      success: true,
      zpl: zplCommands.join('\n'),
      message: `${amount} címke ZPL parancs generálva`
    })
  } catch (error: any) {
    console.error('Error generating label ZPL:', error)
    return NextResponse.json({ error: 'Hiba a címke generálása során' }, { status: 500 })
  }
}

/**
 * Escape special characters for ZPL
 */
function escapeZPL(text: string): string {
  return text
    .replace(/\^/g, '\\^')
    .replace(/~/g, '\\~')
    .replace(/\?/g, '\\?')
    .replace(/\_/g, '\\_')
    .substring(0, 50) // Limit length
}

/**
 * Format price for display
 */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price)
}

/**
 * Wrap text to multiple lines
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  words.forEach(word => {
    if ((currentLine + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) {
        lines.push(currentLine)
      }
      // If word itself is longer than maxCharsPerLine, split it
      if (word.length > maxCharsPerLine) {
        let remainingWord = word
        while (remainingWord.length > maxCharsPerLine) {
          lines.push(remainingWord.substring(0, maxCharsPerLine))
          remainingWord = remainingWord.substring(maxCharsPerLine)
        }
        currentLine = remainingWord
      } else {
        currentLine = word
      }
    }
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.length > 0 ? lines : [text]
}

