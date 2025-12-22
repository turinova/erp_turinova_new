/**
 * ESC/POS command generator for 80mm thermal printer receipts
 */

interface ReceiptData {
  tenantCompany: {
    logo_url?: string | null
    postal_code?: string
    city?: string
    address?: string
    phone_number?: string
    email?: string
    tax_number?: string
  }
  orderNumber: string
  customerName: string
  pricing: Array<{
    id: string
    material_name?: string
    materials?: {
      name: string
    }
    charged_sqm?: number
    boards_used?: number
    waste_multi?: number
    quote_services_breakdown?: Array<{
      id: string
      service_type: string
      quantity: number
      unit_price: number
      net_price: number
      vat_amount: number
      gross_price: number
    }>
  }>
}

// ESC/POS command constants
const ESC = '\x1B'
const GS = '\x1D'
const DLE = '\x10'
const EOT = '\x04'
const LF = '\x0A'

// Table formatting constants for 80mm paper
const PAPER_WIDTH_CHARS = 48  // Conservative estimate for 80mm thermal paper
const COLUMN_1_WIDTH = 26     // Material/Service name column width (reduced to fit header)
const COLUMN_2_WIDTH = 20     // Quantity column width (increased for "Mennyiség")
const COLUMN_SEPARATOR = '  ' // Separator between columns (2 spaces)
// Total: 26 + 2 + 20 = 48 (fits exactly)

/**
 * Initialize printer
 */
function initPrinter(): string {
  return ESC + '@' // Initialize printer
}

/**
 * Set text alignment (0=left, 1=center, 2=right)
 */
function setAlignment(align: 0 | 1 | 2): string {
  return ESC + 'a' + String.fromCharCode(align)
}

/**
 * Set text size (width: 1-8, height: 1-8)
 */
function setTextSize(width: number, height: number): string {
  const n = (width - 1) | ((height - 1) << 4)
  return GS + '!' + String.fromCharCode(n)
}

/**
 * Set bold on/off
 */
function setBold(enabled: boolean): string {
  return ESC + 'E' + String.fromCharCode(enabled ? 1 : 0)
}

/**
 * Print text
 */
function printText(text: string): string {
  return text
}

/**
 * Print line feed
 */
function lineFeed(lines: number = 1): string {
  return LF.repeat(lines)
}

/**
 * Print horizontal line (dashed)
 * Uses paper width to prevent wrapping
 */
function printDashedLine(): string {
  // Use paper width to ensure line doesn't wrap
  return '-'.repeat(PAPER_WIDTH_CHARS) + lineFeed()
}

/**
 * Pad or truncate text to fixed width for table column
 * @param text - Text to format
 * @param width - Target width in characters
 * @param align - 'left' or 'right' alignment
 * @returns Formatted text string
 */
function formatTableColumn(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  // Truncate if too long (leave 3 chars for "...")
  if (text.length > width) {
    return text.substring(0, width - 3) + '...'
  }
  
  // Pad with spaces to fixed width
  if (align === 'left') {
    return text + ' '.repeat(width - text.length)
  } else {
    // Right align
    return ' '.repeat(width - text.length) + text
  }
}

/**
 * Print a table row with two columns (left-aligned and right-aligned)
 * @param col1 - First column text (left-aligned)
 * @param col2 - Second column text (right-aligned)
 * @returns ESC/POS command string for the row
 */
function printTableRow(col1: string, col2: string): string {
  const formattedCol1 = formatTableColumn(col1, COLUMN_1_WIDTH, 'left')
  const formattedCol2 = formatTableColumn(col2, COLUMN_2_WIDTH, 'right')
  return formattedCol1 + COLUMN_SEPARATOR + formattedCol2 + lineFeed()
}

/**
 * Wrap text to multiple lines, breaking at word boundaries when possible
 * @param text - Text to wrap
 * @param maxWidth - Maximum width per line
 * @returns Array of text lines
 */
function wrapText(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) {
    return [text]
  }
  
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''
  
  for (const word of words) {
    // If word itself is longer than maxWidth, break it
    if (word.length > maxWidth) {
      if (currentLine) {
        lines.push(currentLine.trim())
        currentLine = ''
      }
      // Break long word into chunks
      for (let i = 0; i < word.length; i += maxWidth) {
        lines.push(word.substring(i, i + maxWidth))
      }
    } else {
      // Check if adding this word would exceed maxWidth
      const testLine = currentLine ? `${currentLine} ${word}` : word
      if (testLine.length <= maxWidth) {
        currentLine = testLine
      } else {
        // Start new line
        if (currentLine) {
          lines.push(currentLine.trim())
        }
        currentLine = word
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine.trim())
  }
  
  return lines.length > 0 ? lines : [text]
}

/**
 * Print table row with text wrapping for first column
 * @param col1 - First column text (will wrap if needed)
 * @param col2 - Second column text (right-aligned)
 * @returns ESC/POS command string for the row(s)
 */
function printTableRowWithWrap(col1: string, col2: string): string {
  const wrappedLines = wrapText(col1, COLUMN_1_WIDTH)
  let result = ''
  
  // First line: first part of wrapped text + quantity
  result += formatTableColumn(wrappedLines[0], COLUMN_1_WIDTH, 'left')
  result += COLUMN_SEPARATOR
  result += formatTableColumn(col2, COLUMN_2_WIDTH, 'right')
  result += lineFeed()
  
  // Additional lines: just the wrapped text (no quantity column)
  for (let i = 1; i < wrappedLines.length; i++) {
    result += formatTableColumn(wrappedLines[i], COLUMN_1_WIDTH, 'left')
    result += COLUMN_SEPARATOR
    result += formatTableColumn('', COLUMN_2_WIDTH, 'right') // Empty quantity
    result += lineFeed()
  }
  
  return result
}

/**
 * Cut paper (partial cut)
 */
function cutPaper(): string {
  return GS + 'V' + String.fromCharCode(66) + String.fromCharCode(0)
}

/**
 * Select character code table for ESC/POS printer
 * @param codePage - Code page number (2 = CP852 Central European, includes Hungarian)
 * @returns ESC/POS command string
 */
function setCharacterCodePage(codePage: number): string {
  // ESC t <n> - Select character code table
  // 2 = CP852 (Latin-2, Central European - includes Hungarian: é, á, í, ő, ü, ö, etc.)
  // Some printers may use 18 instead of 2 for CP852 - if ő/ű don't work, try 18
  return ESC + 't' + String.fromCharCode(codePage)
}

/**
 * Convert UTF-8 string to CP852 (Central European) byte array
 * CP852 includes Hungarian characters: é, á, í, ő, ü, ö, É, Á, Í, Ő, Ü, Ö
 * @param text - UTF-8 encoded string
 * @returns Uint8Array of CP852 bytes
 */
function encodeToCP852(text: string): Uint8Array {
  // Manual mapping for Hungarian and Central European characters to CP852
  const cp852Map: Record<string, number> = {
    // Hungarian lowercase
    'á': 0xA0, 'é': 0x82, 'í': 0xA1, 'ó': 0xA2, 'ö': 0x94, 'ő': 0x95,
    'ú': 0xA3, 'ü': 0x81, 'ű': 0x96,
    // Hungarian uppercase
    'Á': 0xB5, 'É': 0x90, 'Í': 0xD6, 'Ó': 0xE0, 'Ö': 0x99, 'Ő': 0xEA,
    'Ú': 0xE9, 'Ü': 0x9A, 'Ű': 0xEB,
    // Mathematical symbols
    '²': 0xFD,  // Superscript 2 (square meter symbol)
    '³': 0xFE,  // Superscript 3 (cubic meter, if needed)
    // Other Central European characters
    '€': 0xD5, '§': 0x15, '°': 0xF8, '±': 0xF1,
    // Czech/Slovak
    'Č': 0x80, 'č': 0x87, 'Ć': 0x8C, 'ć': 0x8D,
    'Đ': 0x8E, 'đ': 0x8F, 'Š': 0x9E, 'š': 0x9F,
    'Ž': 0x9C, 'ž': 0x9D, 'Ř': 0xE8, 'ř': 0xE7,
    'Ť': 0xEC, 'ť': 0xED, 'Ň': 0xEE, 'ň': 0xEF,
    'Ď': 0xF0, 'ď': 0xF2,
    // Polish
    'Ł': 0xA5, 'ł': 0xA4, 'Ą': 0xA6, 'ą': 0xA7,
    'Ę': 0xA8, 'ę': 0xA9, 'Ź': 0xAA, 'ź': 0xAB,
    'Ż': 0xAC, 'ż': 0xAD, 'Ń': 0xAE, 'ń': 0xAF,
    'Ś': 0xB6, 'ś': 0xB7
  }

  const result: number[] = []
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const code = char.charCodeAt(0)
    
    // Check if character is in our mapping (Hungarian/special chars)
    if (cp852Map[char] !== undefined) {
      result.push(cp852Map[char])
    }
    // ASCII characters (0-127) pass through unchanged
    else if (code < 128) {
      result.push(code)
    }
    // Control characters and extended ASCII (128-255) - try to preserve if possible
    else if (code >= 128 && code <= 255) {
      // Some extended ASCII might be valid in CP852, but to be safe, use mapping or '?'
      // For unmapped extended ASCII, use '?' as fallback
      result.push(0x3F) // '?'
    }
    // Multi-byte UTF-8 characters not in mapping
    else {
      result.push(0x3F) // '?' fallback for unmapped characters
    }
  }
  
  return new Uint8Array(result)
}

/**
 * Generate ESC/POS commands for receipt
 */
export function generateEscPosCommands(data: ReceiptData): Uint8Array {
  let commands = ''

  // Initialize printer
  commands += initPrinter()

  // Select character code page (CP852 - Central European, includes Hungarian)
  // Code page 2 = CP852 (Latin-2) - standard for most ESC/POS printers
  // If ő/ű still don't work, try: 18 (alternative CP852), 17 (CP1250), or 19 (CP858)
  commands += setCharacterCodePage(2)  // CP852 - Latin 2 (Hungarian support)

  // Center alignment for logo area (if logo exists, we'll add space for it)
  commands += setAlignment(1)
  commands += lineFeed(2)

  // Company info (centered)
  commands += setTextSize(1, 1)
  if (data.tenantCompany.postal_code && data.tenantCompany.city) {
    commands += printText(`${data.tenantCompany.postal_code} ${data.tenantCompany.city}`)
    commands += lineFeed()
  }
  if (data.tenantCompany.address) {
    commands += printText(data.tenantCompany.address)
    commands += lineFeed()
  }
  if (data.tenantCompany.phone_number) {
    commands += printText(data.tenantCompany.phone_number)
    commands += lineFeed()
  }
  if (data.tenantCompany.email) {
    commands += printText(data.tenantCompany.email)
    commands += lineFeed()
  }
  if (data.tenantCompany.tax_number) {
    commands += printText(`Adószám: ${data.tenantCompany.tax_number}`)
    commands += lineFeed()
  }

  commands += lineFeed()
  commands += setAlignment(0) // Left align

  // Separator (dashed line)
  commands += printDashedLine()

  // Order number and customer name
  commands += setBold(true)
  commands += printText(`Megrendelés száma: ${data.orderNumber}`)
  commands += lineFeed()
  commands += printText(`Ügyfél neve: ${data.customerName}`)
  commands += setBold(false)
  commands += lineFeed()

  // Separator
  commands += printDashedLine()

  // Materials table header
  commands += setBold(true)
  commands += printTableRow('Anyag', 'Mennyiség')
  commands += setBold(false)
  commands += printDashedLine()

  // Materials rows
  if (data.pricing && data.pricing.length > 0) {
    data.pricing.forEach((item) => {
      const materialName = item.materials?.name || item.material_name || ''
      const chargedSqm = item.charged_sqm || 0
      const boardsSold = item.boards_used || 0
      const wasteMulti = item.waste_multi || 1
      const displaySqm = chargedSqm / wasteMulti
      const quantity = `${displaySqm.toFixed(2)} m2 / ${boardsSold} db`
      
      // Use wrapping for material names (allows multi-line display)
      commands += printTableRowWithWrap(materialName, quantity)
    })
  } else {
    commands += printTableRow('Nincs anyag adat', '')
  }

  // Separator
  commands += printDashedLine()

  // Collect and aggregate services from all pricing items
  const servicesMap = new Map<string, { name: string; quantity: number; unit: string }>()
  
  if (data.pricing && data.pricing.length > 0) {
    data.pricing.forEach((pricingItem) => {
      if (pricingItem.quote_services_breakdown) {
        pricingItem.quote_services_breakdown.forEach((service) => {
          // Translate service type to Hungarian name
          let serviceName = ''
          let unit = ''
          
          switch (service.service_type) {
            case 'panthelyfuras':
              serviceName = 'Pánthelyfúrás'
              unit = 'db'
              break
            case 'duplungolas':
              serviceName = 'Duplungolás'
              unit = 'm2'
              break
            case 'szogvagas':
              serviceName = 'Szögvágás'
              unit = 'db'
              break
            default:
              serviceName = service.service_type
              unit = 'db'
          }

          const existing = servicesMap.get(service.service_type)
          if (existing) {
            existing.quantity += service.quantity
          } else {
            servicesMap.set(service.service_type, {
              name: serviceName,
              quantity: service.quantity,
              unit: unit
            })
          }
        })
      }
    })
  }

  const aggregatedServices = Array.from(servicesMap.values())

  // Services table - Only show if there are services
  if (aggregatedServices.length > 0) {
    // Separator
    commands += printDashedLine()

    // Services table header
    commands += setBold(true)
    commands += printTableRow('Megnevezés', 'Mennyiség')
    commands += setBold(false)
    commands += printDashedLine()

    // Services rows
    aggregatedServices.forEach((service) => {
      const quantityText = service.quantity % 1 === 0
        ? `${service.quantity} ${service.unit}`
        : `${service.quantity.toFixed(2)} ${service.unit}`
      
      commands += printTableRow(service.name, quantityText)
    })

    // Separator
    commands += printDashedLine()
  }

  // Legal disclaimer
  commands += setTextSize(1, 1)
  commands += printText('A megrendelő igazolja, hogy az árut mennyiségében és minőségében átvette. Az átvételkor látható hibákra vonatkozó reklamációt a későbbiekben nem áll módunkban elfogadni.')
  commands += lineFeed(2)

  // Additional line
  commands += setAlignment(1)
  commands += setBold(true)
  commands += printText('Áru kizárólag ezen átvételi blokk bemutatásával adható ki.')
  commands += setBold(false)
  commands += lineFeed(2)

  // Print date and time
  const now = new Date()
  const printDate = now.toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const printTime = now.toLocaleTimeString('hu-HU', {
    hour: '2-digit',
    minute: '2-digit'
  })
  commands += setAlignment(1)
  commands += printText(`Nyomtatva: ${printDate} ${printTime}`)
  commands += lineFeed(2)

  // Signature lines
  commands += setAlignment(0)
  commands += setTextSize(1, 1)
  commands += printText('Ügyfél aláírása:')
  commands += lineFeed(3)
  commands += printDashedLine()
  commands += lineFeed()
  commands += printText('Átadó munkatárs neve:')
  commands += lineFeed(3)
  commands += printDashedLine()
  commands += lineFeed(3)

  // Cut paper
  commands += cutPaper()

  // Convert string to CP852 encoding for ESC/POS printer
  // CP852 includes Hungarian characters: é, á, í, ő, ü, ö, etc.
  return encodeToCP852(commands)
}

