/**
 * WebUSB ESC/POS küldés — Chrome / Edge.
 */

export async function requestUsbPrinter(): Promise<USBDevice | null> {
  if (typeof navigator === 'undefined' || !navigator.usb) {
    return null
  }
  try {
    const paired = await navigator.usb.getDevices()
    if (paired[0]) {
      try {
        if (!paired[0].opened) await paired[0].open()
        return paired[0]
      } catch {
        /* fall through to request */
      }
    }
    const device = await navigator.usb.requestDevice({ filters: [] })
    if (!device.opened) await device.open()
    return device
  } catch {
    return null
  }
}

async function findBulkOut(device: USBDevice): Promise<{
  interfaceNumber: number
  endpointNumber: number
} | null> {
  if (!device.configuration) {
    try {
      await device.selectConfiguration(1)
    } catch {
      return null
    }
  }
  const conf = device.configuration
  if (!conf) return null

  for (const iface of conf.interfaces) {
    for (const alt of iface.alternates) {
      const ep = alt.endpoints.find(
        (e) => e.direction === 'out' && e.type === 'bulk'
      )
      if (!ep) continue
      try {
        if (!iface.claimed) await device.claimInterface(iface.interfaceNumber)
        return {
          interfaceNumber: iface.interfaceNumber,
          endpointNumber: ep.endpointNumber
        }
      } catch {
        /* try next */
      }
    }
  }
  return null
}

export async function printEscPosViaWebUsb(
  bytes: Uint8Array,
  preferred?: USBDevice | null
): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.usb) {
    throw new Error('WebUSB nem támogatott ebben a böngészőben.')
  }

  let device = preferred ?? null
  if (!device) {
    device = await requestUsbPrinter()
  }
  if (!device) throw new Error('Nincs kiválasztott nyomtató.')

  if (!device.opened) await device.open()

  const target = await findBulkOut(device)
  if (!target) {
    throw new Error('Nem található bulk OUT végpont a nyomtatón.')
  }

  const chunkSize = 512
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    await device.transferOut(
      target.endpointNumber,
      chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength
      ) as ArrayBuffer
    )
  }

  try {
    await device.releaseInterface(target.interfaceNumber)
  } catch {
    /* ignore */
  }
}
