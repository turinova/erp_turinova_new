export const KIOSK_PAIRING_PARAM = 'parositas'
export const KIOSK_DEVICE_TOKEN_KEY = 'kiosk_device_token'

export function kioskPairingUrl(origin: string, kioskPath: string, token: string) {
  return `${origin}${kioskPath}?${KIOSK_PAIRING_PARAM}=${encodeURIComponent(token)}`
}

export function readKioskDeviceToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(KIOSK_DEVICE_TOKEN_KEY)
}

/** Elmenti az URL-ben kapott párosító kódot, és eltávolítja a címsorból. */
export function consumeKioskPairingParam(): boolean {
  if (typeof window === 'undefined') return false
  const url = new URL(window.location.href)
  const token = url.searchParams.get(KIOSK_PAIRING_PARAM)?.trim()
  if (!token) return false
  window.localStorage.setItem(KIOSK_DEVICE_TOKEN_KEY, token)
  url.searchParams.delete(KIOSK_PAIRING_PARAM)
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  return true
}
