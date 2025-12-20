/**
 * Utility functions for printing order receipts on 58mm thermal paper
 * Supports both WebUSB (direct ESC/POS) and browser print dialog fallback
 */

import { generateEscPosCommands } from './escpos-receipt'
import { printReceiptViaWebUSB } from './webusb-printer'

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

/**
 * Fetch logo from URL and convert to base64
 */
async function fetchLogoAsBase64(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null

  try {
    const response = await fetch(logoUrl)
    if (!response.ok) {
      console.warn('[Print Receipt] Failed to fetch logo:', response.statusText)
      return null
    }

    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        resolve(base64String)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('[Print Receipt] Error converting logo to base64:', error)
    return null
  }
}

/**
 * Print order receipt on 58mm thermal paper
 * Tries WebUSB first, falls back to browser print dialog
 */
export async function printOrderReceipt(data: ReceiptData): Promise<void> {
  console.log('[Print Receipt] Starting printOrderReceipt with data:', {
    orderNumber: data.orderNumber,
    customerName: data.customerName,
    pricingCount: data.pricing.length
  })

  // Try WebUSB direct printing first
  try {
    console.log('[Print Receipt] Attempting WebUSB direct printing...')
    const escPosCommands = generateEscPosCommands(data)
    await printReceiptViaWebUSB(escPosCommands)
    console.log('[Print Receipt] WebUSB printing successful')
    return // Success, exit early
  } catch (webusbError: any) {
    console.warn('[Print Receipt] WebUSB printing failed, falling back to browser print:', webusbError.message)
    
    // If WebUSB is not supported or user cancelled, fall back to browser print
    if (webusbError.message.includes('not supported') || 
        webusbError.message.includes('cancelled') ||
        webusbError.message.includes('NotFoundError')) {
      // Fall through to browser print dialog
      console.log('[Print Receipt] Falling back to browser print dialog...')
    } else {
      // For other errors, still try browser print as fallback
      console.log('[Print Receipt] WebUSB error, trying browser print as fallback...')
    }
  }

  // Fallback to browser print dialog
  console.log('[Print Receipt] Using browser print dialog fallback...')
  
  // Fetch logo as base64 (only needed for browser print)
  console.log('[Print Receipt] Fetching logo...')
  const logoBase64 = await fetchLogoAsBase64(data.tenantCompany.logo_url)
  console.log('[Print Receipt] Logo fetched:', logoBase64 ? 'Yes' : 'No')

  // Create print container
  const printContainer = document.createElement('div')
  printContainer.id = 'order-receipt-print-temp-container'
  printContainer.style.position = 'absolute'
  printContainer.style.left = '-9999px'
  printContainer.style.top = '-9999px'
  printContainer.style.visibility = 'hidden'
  document.body.appendChild(printContainer)
  console.log('[Print Receipt] Print container created and appended to body')

  // Inject print styles
  const styleId = 'order-receipt-print-styles'
  let existingStyle = document.getElementById(styleId)
  if (existingStyle) {
    existingStyle.remove()
  }

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    /* Screen styles - hide container */
    #order-receipt-print-temp-container {
      position: absolute !important;
      left: -9999px !important;
      top: -9999px !important;
      visibility: hidden !important;
    }
    
    @media print {
      @page {
        size: 58mm auto;
        margin: 0;
        padding: 0;
      }
      
      /* Override ALL browser defaults */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        box-sizing: border-box !important;
      }
      
      /* Force html and body to zero spacing */
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 58mm !important;
        background: white !important;
      }
      
      /* Hide everything except our container */
      body > *:not(#order-receipt-print-temp-container) {
        display: none !important;
        visibility: hidden !important;
      }
      
      /* Show our container */
      #order-receipt-print-temp-container {
        position: relative !important;
        left: 0 !important;
        top: 0 !important;
        width: 58mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 9999 !important;
      }
      
      /* Receipt container */
      #order-receipt-print-container {
        width: 58mm !important;
        max-width: 58mm !important;
        margin: 0 !important;
        padding: 4mm !important;
        font-family: monospace !important;
        font-size: 9px !important;
        line-height: 1.2 !important;
        color: #000 !important;
        background: white !important;
      }
      
      /* Remove all spacing from elements */
      #order-receipt-print-container * {
        margin: 0 !important;
        padding: 0 !important;
      }
      
      /* Preserve our padding */
      #order-receipt-print-container {
        padding: 4mm !important;
      }
      
      /* Table styles */
      #order-receipt-print-container table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 8px !important;
        margin: 0 !important;
      }
      
      #order-receipt-print-container th,
      #order-receipt-print-container td {
        padding: 2px 0 !important;
        font-size: 8px !important;
        border: none !important;
      }
      
      #order-receipt-print-container th {
        border-bottom: 1px solid #000 !important;
        font-weight: bold !important;
      }
      
      /* Typography */
      #order-receipt-print-container p,
      #order-receipt-print-container span,
      #order-receipt-print-container div {
        font-size: inherit !important;
        line-height: 1.2 !important;
        color: #000 !important;
      }
      
      /* Logo */
      #order-receipt-print-container img {
        max-height: 10mm !important;
        max-width: 100% !important;
        object-fit: contain !important;
      }
      
      /* Separators */
      #order-receipt-print-container [style*="border-top"] {
        border-top: 1px dashed #000 !important;
      }
    }
  `
  document.head.appendChild(style)

  // Render receipt using React
  console.log('[Print Receipt] Importing React components...')
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { default: OrderReceiptPrint } = await import('@/components/OrderReceiptPrint')

  console.log('[Print Receipt] Creating React root and rendering...')
  const root = createRoot(printContainer)
  root.render(
    React.createElement(OrderReceiptPrint, {
      tenantCompany: data.tenantCompany,
      orderNumber: data.orderNumber,
      customerName: data.customerName,
      pricing: data.pricing,
      logoBase64: logoBase64
    })
  )

  // Wait for render to complete - increased timeout for React to fully render
  console.log('[Print Receipt] Waiting for React render to complete...')
  await new Promise(resolve => setTimeout(resolve, 300))

  // Verify container has content
  const receiptContainer = document.getElementById('order-receipt-print-container')
  if (!receiptContainer) {
    console.error('[Print Receipt] Receipt container not found in DOM!')
    throw new Error('Receipt container not rendered')
  }
  console.log('[Print Receipt] Receipt container found, content:', receiptContainer.textContent?.substring(0, 100))

  // Trigger browser print dialog
  console.log('[Print Receipt] Triggering window.print()...')
  window.print()
  console.log('[Print Receipt] window.print() called')

  // Cleanup after print dialog closes (or is cancelled)
  setTimeout(() => {
    console.log('[Print Receipt] Cleaning up...')
    root.unmount()
    if (printContainer.parentNode) {
      printContainer.parentNode.removeChild(printContainer)
    }
    if (style.parentNode) {
      style.parentNode.removeChild(style)
    }
    console.log('[Print Receipt] Cleanup complete')
  }, 1000)
}

