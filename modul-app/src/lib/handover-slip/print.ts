'use client'

import { generateHandoverEscPos } from '@/lib/handover-slip/escpos'
import { printEscPosViaWebUsb } from '@/lib/handover-slip/webusb'
import type {
  HandoverSlipCopyType,
  HandoverSlipData,
  HandoverSlipSettings
} from '@/lib/handover-slip/types'
import { openHandoverBrowserPrint } from '@/lib/handover-slip/browser-print'

export async function printHandoverSlip(input: {
  data: HandoverSlipData
  settings: HandoverSlipSettings
  copyTypes: HandoverSlipCopyType[]
  usbDevice?: USBDevice | null
}): Promise<{ method: 'webusb' | 'browser' }> {
  const { data, settings, copyTypes, usbDevice } = input
  if (copyTypes.length === 0) return { method: 'browser' }

  try {
    for (let i = 0; i < copyTypes.length; i++) {
      const bytes = generateHandoverEscPos(data, settings, copyTypes[i])
      await printEscPosViaWebUsb(bytes, usbDevice ?? null)
      if (i < copyTypes.length - 1) {
        await new Promise((r) => setTimeout(r, 400))
      }
    }
    return { method: 'webusb' }
  } catch (err) {
    console.warn('[handover-slip] WebUSB failed, browser fallback', err)
    openHandoverBrowserPrint(data, settings, copyTypes)
    return { method: 'browser' }
  }
}
