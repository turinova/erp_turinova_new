/**
 * WebUSB API utility for direct ESC/POS printing to USB thermal printers
 */

// ESC/POS USB vendor/product IDs for common thermal printers
// EQUIP Thermo blokknyomtató - 351001 might use generic ESC/POS protocol
const COMMON_THERMAL_PRINTER_IDS = [
  { vendorId: 0x04f9, productId: 0x2042 }, // Brother
  { vendorId: 0x04b8, productId: 0x0202 }, // Epson
  { vendorId: 0x0483, productId: 0x5740 }, // STMicroelectronics (common for generic printers)
  { vendorId: 0x154f, productId: 0x154f }, // Bixolon
  { vendorId: 0x0519, productId: 0x0001 }, // Generic ESC/POS
]

/**
 * Request USB device access
 * First tries with filters, then without filters if no device found
 */
export async function requestPrinterAccess(): Promise<USBDevice | null> {
  try {
    // Check if WebUSB is supported
    if (!navigator.usb) {
      throw new Error('WebUSB API is not supported in this browser. Please use Chrome or Edge.')
    }

    // First, try with filters for common thermal printers
    try {
      const device = await navigator.usb.requestDevice({
        filters: COMMON_THERMAL_PRINTER_IDS
      })
      return device
    } catch (filterError: any) {
      // If no device found with filters, try without filters (allows any USB device)
      // This is useful for printers not in our common list (like EQUIP)
      if (filterError.name === 'NotFoundError') {
        console.log('[WebUSB] No device found with filters, trying without filters...')
        const device = await navigator.usb.requestDevice({
          filters: [] // Empty filters = show all USB devices
        })
        return device
      }
      throw filterError
    }
  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      throw new Error('Nincs nyomtató kiválasztva. Kérjük, válasszon ki egy USB nyomtatót.')
    } else if (error.name === 'SecurityError') {
      throw new Error('Nincs engedély a USB eszköz eléréséhez. Kérjük, adja meg az engedélyt a böngészőben.')
    } else {
      throw new Error(`Hiba a nyomtató elérésekor: ${error.message}`)
    }
  }
}

/**
 * Get already paired USB printer
 * Returns all paired USB devices (not just filtered ones)
 */
export async function getPairedPrinter(): Promise<USBDevice[]> {
  try {
    if (!navigator.usb) {
      return []
    }

    // Get all paired devices (user has already granted permission)
    const devices = await navigator.usb.getDevices()
    
    // Return all paired devices (user can select which one to use)
    // We'll try to use the first one, or let user select
    return devices
  } catch (error) {
    console.error('[WebUSB] Error getting paired devices:', error)
    return []
  }
}

/**
 * Connect to USB printer and send ESC/POS commands
 */
export async function printToUsbPrinter(
  device: USBDevice,
  escPosCommands: Uint8Array
): Promise<void> {
  try {
    console.log('[WebUSB] Opening device...')
    await device.open()

    // Select configuration (most printers use configuration 1)
    if (device.configuration === null) {
      await device.selectConfiguration(1)
    }

    // Claim interface (most ESC/POS printers use interface 0)
    try {
      await device.claimInterface(0)
    } catch (error: any) {
      // If interface is already claimed, try to release and reclaim
      if (error.message.includes('already claimed')) {
        await device.releaseInterface(0)
        await device.claimInterface(0)
      } else {
        throw error
      }
    }

    // Find the bulk out endpoint (for sending data to printer)
    const interface_ = device.configuration!.interfaces[0]
    const alternate = interface_.alternates[0]
    const endpoint = alternate.endpoints.find(
      (ep: USBEndpoint) => ep.direction === 'out' && ep.type === 'bulk'
    )

    if (!endpoint) {
      throw new Error('Nem található kimeneti végpont a nyomtatóban')
    }

    console.log('[WebUSB] Sending ESC/POS commands...', escPosCommands.length, 'bytes')

    // Send data in chunks (USB has packet size limits, typically 64 bytes)
    const chunkSize = endpoint.packetSize || 64
    for (let i = 0; i < escPosCommands.length; i += chunkSize) {
      const chunk = escPosCommands.slice(i, i + chunkSize)
      await device.transferOut(endpoint.endpointNumber, chunk)
    }

    console.log('[WebUSB] Print job sent successfully')

    // Release interface
    await device.releaseInterface(0)

    // Close device
    await device.close()

    console.log('[WebUSB] Device closed')
  } catch (error: any) {
    console.error('[WebUSB] Error printing:', error)
    
    // Try to clean up
    try {
      if (device.opened) {
        await device.releaseInterface(0).catch(() => {})
        await device.close().catch(() => {})
      }
    } catch (cleanupError) {
      console.error('[WebUSB] Cleanup error:', cleanupError)
    }

    throw new Error(`Nyomtatási hiba: ${error.message}`)
  }
}

/**
 * Print receipt using WebUSB (with automatic device selection)
 */
export async function printReceiptViaWebUSB(escPosCommands: Uint8Array): Promise<void> {
  try {
    // First, try to get already paired printer
    const pairedDevices = await getPairedPrinter()
    
    let device: USBDevice | null = null

    if (pairedDevices.length > 0) {
      // Use the first paired device
      console.log('[WebUSB] Using paired printer:', pairedDevices[0].productName)
      device = pairedDevices[0]
    } else {
      // Request new device access
      console.log('[WebUSB] No paired printer found, requesting access...')
      device = await requestPrinterAccess()
    }

    if (!device) {
      throw new Error('Nincs nyomtató kiválasztva')
    }

    // Print to device
    await printToUsbPrinter(device, escPosCommands)
  } catch (error: any) {
    console.error('[WebUSB] Print error:', error)
    throw error
  }
}

