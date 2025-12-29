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
 * Windows-compatible: tries multiple interfaces and configurations
 */
export async function printToUsbPrinter(
  device: USBDevice,
  escPosCommands: Uint8Array
): Promise<void> {
  let claimedInterface: number | null = null
  let usedConfiguration: number | null = null
  
  try {
    console.log('[WebUSB] Opening device...', {
      vendorId: device.vendorId.toString(16),
      productId: device.productId.toString(16),
      productName: device.productName,
      manufacturerName: device.manufacturerName,
      alreadyOpened: device.opened
    })
    
    // Windows: Check if device is already open, if not try to open it
    // On Windows, devices might be closed even if paired
    try {
      if (!device.opened) {
        await device.open()
        console.log('[WebUSB] Successfully opened device')
      } else {
        console.log('[WebUSB] Device is already open')
      }
    } catch (openError: any) {
      // Windows: Device might be locked by Windows driver
      if (openError.message.includes('access denied') || 
          openError.message.includes('locked') ||
          openError.message.includes('busy') ||
          openError.message.includes('in use') ||
          openError.message.includes('permission')) {
        throw new Error(
          'A nyomtató használatban van Windows illesztőprogram által.\n\n' +
          'Windows megoldások:\n' +
          '1. Zárja be a nyomtatókezelőt (Print Spooler szolgáltatás)\n' +
          '2. Ellenőrizze, hogy nincs-e más program használatban a nyomtatót\n' +
          '3. Próbálja meg újraindítani a Chrome böngészőt\n' +
          '4. Válassza ki újra a nyomtatót a böngészőben'
        )
      }
      throw openError
    }

    // Windows: Try to select configuration if needed
    // Some Windows drivers require explicit configuration selection
    if (device.configuration === null) {
      // Try configuration 1 first (most common)
      try {
        console.log('[WebUSB] Selecting configuration 1...')
        await device.selectConfiguration(1)
        usedConfiguration = 1
      } catch (configError: any) {
        console.warn('[WebUSB] Configuration 1 failed, trying to detect available configurations...', configError.message)
        // On Windows, sometimes we need to let the device auto-select
        // or try different configurations
      }
    } else {
      usedConfiguration = 1 // Default to configuration 1 if already set
      console.log('[WebUSB] Using existing configuration')
    }

    // Windows: Try multiple interfaces (not just interface 0)
    // Some printers on Windows use interface 1 or 2
    const maxInterfaces = device.configuration?.interfaces.length || 1
    let endpoint: USBEndpoint | null = null
    let interfaceNumber: number | null = null
    
    console.log('[WebUSB] Device has', maxInterfaces, 'interface(s), trying to find bulk out endpoint...')
    
    for (let i = 0; i < maxInterfaces; i++) {
      try {
        const interface_ = device.configuration!.interfaces[i]
        const interfaceNum = interface_.interfaceNumber
        
        console.log(`[WebUSB] Trying interface ${interfaceNum}...`)
        
        // Try to claim this interface
        try {
          await device.claimInterface(interfaceNum)
          claimedInterface = interfaceNum
          console.log(`[WebUSB] Successfully claimed interface ${interfaceNum}`)
        } catch (claimError: any) {
          // Windows: Interface might be claimed by another driver
          if (claimError.message.includes('already claimed') || 
              claimError.message.includes('The requested interface is busy') ||
              claimError.message.includes('busy')) {
            console.warn(`[WebUSB] Interface ${interfaceNum} is already claimed, trying to release and reclaim...`)
            try {
              await device.releaseInterface(interfaceNum)
              await device.claimInterface(interfaceNum)
              claimedInterface = interfaceNum
              console.log(`[WebUSB] Successfully reclaimed interface ${interfaceNum}`)
            } catch (reclaimError: any) {
              console.warn(`[WebUSB] Could not reclaim interface ${interfaceNum}:`, reclaimError.message)
              continue // Try next interface
            }
          } else {
            console.warn(`[WebUSB] Could not claim interface ${interfaceNum}:`, claimError.message)
            continue // Try next interface
          }
        }

        // Find bulk out endpoint in this interface
        // Try all alternates (Windows might use different alternates)
        for (const alternate of interface_.alternates) {
          const bulkOutEndpoint = alternate.endpoints.find(
            (ep: USBEndpoint) => ep.direction === 'out' && ep.type === 'bulk'
          )
          
          if (bulkOutEndpoint) {
            endpoint = bulkOutEndpoint
            interfaceNumber = interfaceNum
            console.log(`[WebUSB] Found bulk out endpoint on interface ${interfaceNum}`)
            break
          }
        }
        
        if (endpoint) {
          break // Found endpoint, exit interface loop
        } else {
          // Release this interface if we didn't find an endpoint
          try {
            await device.releaseInterface(interfaceNum)
            claimedInterface = null
          } catch (releaseError) {
            console.warn(`[WebUSB] Could not release interface ${interfaceNum}:`, releaseError)
          }
        }
      } catch (interfaceError: any) {
        console.warn(`[WebUSB] Error with interface ${i}:`, interfaceError.message)
        continue
      }
    }

    if (!endpoint || interfaceNumber === null) {
      throw new Error(
        'Nem található kimeneti végpont a nyomtatóban.\n\n' +
        'Windows: Ellenőrizze, hogy a nyomtató nincs-e használatban más program által.\n' +
        'Próbálja meg bezárni a nyomtatókezelőt és újraindítani a böngészőt.'
      )
    }

    console.log('[WebUSB] Sending ESC/POS commands...', {
      bytes: escPosCommands.length,
      endpoint: endpoint.endpointNumber,
      packetSize: endpoint.packetSize,
      interface: interfaceNumber
    })

    // Send data in chunks (USB has packet size limits)
    // Windows: Some printers need smaller chunks
    const chunkSize = Math.min(endpoint.packetSize || 64, 64)
    const totalChunks = Math.ceil(escPosCommands.length / chunkSize)
    
    for (let i = 0; i < escPosCommands.length; i += chunkSize) {
      const chunk = escPosCommands.slice(i, i + chunkSize)
      const chunkNum = Math.floor(i / chunkSize) + 1
      
      try {
        await device.transferOut(endpoint.endpointNumber, chunk)
        if (chunkNum % 10 === 0 || chunkNum === totalChunks) {
          console.log(`[WebUSB] Sent chunk ${chunkNum}/${totalChunks}`)
        }
      } catch (transferError: any) {
        // Windows: Sometimes transfers fail, try to recover
        if (transferError.message.includes('transfer') || transferError.message.includes('timeout')) {
          console.warn(`[WebUSB] Transfer error on chunk ${chunkNum}, retrying...`, transferError.message)
          // Wait a bit and retry
          await new Promise(resolve => setTimeout(resolve, 100))
          await device.transferOut(endpoint.endpointNumber, chunk)
        } else {
          throw transferError
        }
      }
    }

    console.log('[WebUSB] Print job sent successfully')

    // Release interface
    if (claimedInterface !== null) {
      try {
        await device.releaseInterface(claimedInterface)
        console.log(`[WebUSB] Released interface ${claimedInterface}`)
      } catch (releaseError) {
        console.warn('[WebUSB] Could not release interface:', releaseError)
      }
    }

    // Close device
    await device.close()
    console.log('[WebUSB] Device closed')
  } catch (error: any) {
    console.error('[WebUSB] Error printing:', error)
    
    // Windows-specific error messages
    let errorMessage = error.message
    if (error.message.includes('access denied') || error.message.includes('permission')) {
      errorMessage = 
        'Hozzáférés megtagadva a nyomtatóhoz.\n\n' +
        'Windows megoldások:\n' +
        '1. Zárja be a nyomtatókezelőt (Print Spooler)\n' +
        '2. Ellenőrizze, hogy nincs-e más program használatban a nyomtatót\n' +
        '3. Próbálja meg újraindítani a Chrome böngészőt\n' +
        '4. Ellenőrizze a Windows eszközkezelőben, hogy a nyomtató nincs-e hibás állapotban'
    } else if (error.message.includes('not found') || error.message.includes('disconnected')) {
      errorMessage = 
        'A nyomtató nem található vagy le van választva.\n\n' +
        'Kérjük, ellenőrizze:\n' +
        '1. A nyomtató csatlakoztatva van-e\n' +
        '2. A USB kábel megfelelően csatlakoztatva van-e\n' +
        '3. Próbálja meg kihúzni és újra bedugni a USB kábelt'
    }
    
    // Try to clean up
    try {
      if (device.opened) {
        if (claimedInterface !== null) {
          await device.releaseInterface(claimedInterface).catch(() => {})
        }
        await device.close().catch(() => {})
      }
    } catch (cleanupError) {
      console.error('[WebUSB] Cleanup error:', cleanupError)
    }

    throw new Error(`Nyomtatási hiba: ${errorMessage}`)
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
      
      // Windows: Check if device is already opened, if not try to open it
      // On Windows, paired devices might be closed and need to be reopened
      if (!device.opened) {
        try {
          console.log('[WebUSB] Paired device is closed, attempting to open...')
          await device.open()
          console.log('[WebUSB] Successfully opened paired device')
        } catch (openError: any) {
          console.warn('[WebUSB] Could not open paired device, it may be locked by Windows driver:', openError.message)
          // On Windows, if the device is locked, we might need to request it again
          // This will show the device picker, but user can select the same device
          console.log('[WebUSB] Requesting device access again (Windows may need this)...')
          device = await requestPrinterAccess()
        }
      } else {
        console.log('[WebUSB] Paired device is already open')
      }
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
    
    // Windows-specific: If device is paired but locked, provide helpful message
    if (error.message.includes('access denied') || 
        error.message.includes('permission') ||
        error.message.includes('locked') ||
        error.message.includes('busy') ||
        error.message.includes('already claimed')) {
      console.warn('[WebUSB] Device appears to be locked by Windows driver, error:', error.message)
      // Don't throw - let it fall through to browser print with a warning
      // The error will be caught by printOrderReceipt and fallback will happen
    }
    
    throw error
  }
}

