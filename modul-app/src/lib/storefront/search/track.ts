const LOG_URL = '/api/storefront/search/log'

/** Találat-kattintás naplózása oldalelhagyáskor is (sendBeacon). */
export function trackSearchClick(q: string, slug: string) {
  if (typeof navigator === 'undefined') return
  const term = q.trim()
  if (term.length < 2 || !slug) return
  const body = JSON.stringify({ q: term.slice(0, 120), slug })
  try {
    if (navigator.sendBeacon?.(LOG_URL, new Blob([body], { type: 'application/json' }))) return
  } catch {
    // tovább a fetch tartalékra
  }
  void fetch(LOG_URL, {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'Content-Type': 'application/json' }
  }).catch(() => {})
}

export function slugFromProductHref(href: string): string | null {
  try {
    const path = new URL(href, 'http://x').pathname
    return path.startsWith('/p/') ? decodeURIComponent(path.slice(3).split('/')[0]) : null
  } catch {
    return null
  }
}
