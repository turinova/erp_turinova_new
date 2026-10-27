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
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3010'
  )
}

export function orderStatusPath(token: string): string {
  return `/r/${encodeURIComponent(token)}`
}

export function orderStatusAbsoluteUrl(token: string): string {
  return `${appOrigin()}${orderStatusPath(token)}`
}
