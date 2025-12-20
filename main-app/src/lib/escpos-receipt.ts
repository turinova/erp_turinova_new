/**
 * ESC/POS command generator for 58mm thermal printer receipts
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
 */
function printDashedLine(): string {
  return '-'.repeat(48) + lineFeed()
}

/**
 * Cut paper (partial cut)
 */
function cutPaper(): string {
  return GS + 'V' + String.fromCharCode(66) + String.fromCharCode(0)
}

/**
 * Generate ESC/POS commands for receipt
 */
export function generateEscPosCommands(data: ReceiptData): Uint8Array {
  let commands = ''

  // Initialize printer
  commands += initPrinter()

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
  commands += printText('Anyag')
  // Add spacing for quantity column (right-aligned)
  const maxMaterialNameLength = 32
  const headerSpacing = ' '.repeat(maxMaterialNameLength - 5) // "Anyag" is 5 chars
  commands += printText(headerSpacing)
  commands += printText('Mennyiség')
  commands += setBold(false)
  commands += lineFeed()
  commands += printDashedLine()

  // Materials rows
  if (data.pricing && data.pricing.length > 0) {
    data.pricing.forEach((item) => {
      const materialName = item.materials?.name || item.material_name || ''
      const chargedSqm = item.charged_sqm || 0
      const boardsSold = item.boards_used || 0
      const wasteMulti = item.waste_multi || 1
      const displaySqm = chargedSqm / wasteMulti
      const quantity = `${displaySqm.toFixed(2)} m² / ${boardsSold} db`

      // Truncate material name if too long
      const truncatedName = materialName.length > maxMaterialNameLength
        ? materialName.substring(0, maxMaterialNameLength - 3) + '...'
        : materialName

      commands += printText(truncatedName)
      // Add spacing to align quantity column
      const spacing = ' '.repeat(Math.max(0, maxMaterialNameLength - truncatedName.length))
      commands += printText(spacing)
      commands += printText(quantity)
      commands += lineFeed()
    })
  } else {
    commands += printText('Nincs anyag adat')
    commands += lineFeed()
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
              unit = 'm²'
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
    commands += printText('Megnevezés')
    const maxServiceNameLength = 32
    const headerSpacing = ' '.repeat(maxServiceNameLength - 11) // "Megnevezés" is 11 chars
    commands += printText(headerSpacing)
    commands += printText('Mennyiség')
    commands += setBold(false)
    commands += lineFeed()
    commands += printDashedLine()

    // Services rows
    aggregatedServices.forEach((service) => {
      const quantityText = service.quantity % 1 === 0
        ? `${service.quantity} ${service.unit}`
        : `${service.quantity.toFixed(2)} ${service.unit}`

      // Truncate service name if too long
      const truncatedName = service.name.length > maxServiceNameLength
        ? service.name.substring(0, maxServiceNameLength - 3) + '...'
        : service.name

      commands += printText(truncatedName)
      // Add spacing to align quantity column
      const spacing = ' '.repeat(Math.max(0, maxServiceNameLength - truncatedName.length))
      commands += printText(spacing)
      commands += printText(quantityText)
      commands += lineFeed()
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

  // Convert string to Uint8Array (UTF-8 encoding)
  const encoder = new TextEncoder()
  return encoder.encode(commands)
}

