const huf = new Intl.NumberFormat('hu-HU', {
  maximumFractionDigits: 0
})

export function formatStatusFt(value: number): string {
  return `${huf.format(Math.round(value))} Ft`
}

export function firstNameFromFull(name: string | null | undefined): string {
  const raw = (name ?? '').trim()
  if (!raw) return 'Ügyfél'
  const parts = raw.split(/\s+/).filter(Boolean)
  // Magyar: gyakran vezetéknév elöl — utolsó tag a keresztnév-szerű.
  if (parts.length >= 2) return parts[parts.length - 1]!
  return parts[0]!
}

export function appOrigin(): string {
  const fromAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (fromAppUrl) return fromAppUrl

  const fromOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, '')
  if (fromOrigin) return fromOrigin

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, '')
  if (vercel) {
    return vercel.startsWith('http') ? vercel : `https://${vercel}`
  }

  return 'http://localhost:3010'
}

export function orderStatusPath(token: string): string {
  return `/r/${encodeURIComponent(token)}`
}

export function orderStatusAbsoluteUrl(token: string): string {
  return `${appOrigin()}${orderStatusPath(token)}`
}

/** Google Maps keresés a címre (API-kulcs nélkül). */
export function googleMapsSearchUrl(address: string): string {
  const q = encodeURIComponent(address.trim())
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

/** Waze navigáció a címre. */
export function wazeNavigateUrl(address: string): string {
  const q = encodeURIComponent(address.trim())
  return `https://waze.com/ul?q=${q}&navigate=yes`
}
