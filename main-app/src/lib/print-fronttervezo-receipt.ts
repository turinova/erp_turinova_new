/**
 * Fronttervező átvételi nyugta nyomtatás — Opti printOrderReceipt wrapper
 */

import { printOrderReceipt } from '@/lib/print-receipt'

export type FronttervezoReceiptPrintInput = {
  orderId: string
  orderNumber: string
  customerName: string
  preferredUsbDevice?: USBDevice | null
}

/**
 * Fetch receipt data and print (WebUSB → browser fallback, 2 példány)
 */
export async function printFronttervezoReceipt({
  orderId,
  orderNumber,
  customerName,
  preferredUsbDevice
}: FronttervezoReceiptPrintInput): Promise<void> {
  const response = await fetch(`/api/fronttervezo-orders/${orderId}/receipt-data`)
  if (!response.ok) {
    throw new Error('Nem sikerült betölteni az adatokat a nyomtatáshoz')
  }

  const data = await response.json()
  const tenant = data.tenant_company
  if (!tenant) {
    throw new Error('Cégadatok nem találhatók a nyomtatáshoz')
  }

  await printOrderReceipt(
    {
      tenantCompany: {
        name: tenant.name,
        logo_url: tenant.logo_url,
        postal_code: tenant.postal_code,
        city: tenant.city,
        address: tenant.address,
        phone_number: tenant.phone_number,
        email: tenant.email,
        tax_number: tenant.tax_number
      },
      orderNumber: data.order_number || orderNumber,
      customerName:
        data.customer?.billing_name || data.customer?.name || customerName || '—',
      barcode: data.barcode || null,
      pricing: data.pricing || []
    },
    preferredUsbDevice
  )
}

export async function requestFronttervezoUsbPrinter(): Promise<USBDevice | null> {
  try {
    const { getPairedPrinter, requestPrinterAccess } = await import('@/lib/webusb-printer')
    const pairedDevices = await getPairedPrinter()
    if (pairedDevices.length > 0) {
      return pairedDevices[0]
    }
    return await requestPrinterAccess()
  } catch {
    return null
  }
}
