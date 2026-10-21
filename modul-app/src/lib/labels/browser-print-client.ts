/**
 * Zebra Browser Print — local HTTP API (no vendor JS required).
 * HTTP page → http://127.0.0.1:9100
 * HTTPS page → https://127.0.0.1:9101 (accept SSL once: /ssl_support)
 */

export type BrowserPrintDevice = {
  name: string
  deviceType: string
  connection: string
  uid: string
  version?: number
  provider?: string
  manufacturer?: string
}

export type BrowserPrintProbe =
  | { status: 'ok'; device: BrowserPrintDevice }
  | { status: 'no_default'; devices: BrowserPrintDevice[] }
  | { status: 'down'; hint: string }
  | { status: 'ssl'; hint: string }

const TIMEOUT_MS = 4000

function getBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:9100/'
  return window.location.protocol === 'https:'
    ? 'https://127.0.0.1:9101/'
    : 'http://127.0.0.1:9100/'
}

async function fetchJson<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; kind: 'ssl' | 'down' }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      signal: ctrl.signal
    })
    if (!res.ok) {
      return { ok: false, kind: 'down' }
    }
    const text = await res.text()
    if (!text) {
      return { ok: true, data: null as T }
    }
    return { ok: true, data: JSON.parse(text) as T }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const sslLike =
      /SSL|certificate|ERR_CERT|Failed to fetch|NetworkError/i.test(msg) &&
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:'
    return { ok: false, kind: sslLike ? 'ssl' : 'down' }
  } finally {
    clearTimeout(timer)
  }
}

function normalizeDevice(raw: unknown): BrowserPrintDevice | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const name = String(d.name ?? '')
  const uid = String(d.uid ?? '')
  if (!name && !uid) return null
  return {
    name: name || uid,
    deviceType: String(d.deviceType ?? 'printer'),
    connection: String(d.connection ?? ''),
    uid: uid || name,
    version: typeof d.version === 'number' ? d.version : undefined,
    provider: d.provider != null ? String(d.provider) : undefined,
    manufacturer: d.manufacturer != null ? String(d.manufacturer) : undefined
  }
}

export async function probeBrowserPrint(): Promise<BrowserPrintProbe> {
  const def = await fetchJson<unknown>('default?type=printer')
  if (!def.ok) {
    if (def.kind === 'ssl') {
      return {
        status: 'ssl',
        hint: 'Nyisd meg egyszer: https://127.0.0.1:9101/ssl_support — fogadd el a tanúsítványt.'
      }
    }
    return {
      status: 'down',
      hint: 'A Zebra Browser Print nem fut. Indítsd el a tálcán (Zebra ikon).'
    }
  }

  const device = normalizeDevice(def.data)
  if (device) {
    return { status: 'ok', device }
  }

  const list = await fetchJson<Record<string, unknown[]>>('available')
  if (!list.ok) {
    return {
      status: 'no_default',
      devices: []
    }
  }
  const printers = (list.data?.printer ?? [])
    .map(normalizeDevice)
    .filter((d): d is BrowserPrintDevice => Boolean(d))

  return { status: 'no_default', devices: printers }
}

export async function sendZplViaBrowserPrint(
  zpl: string,
  preferred?: BrowserPrintDevice | null
): Promise<void> {
  let device = preferred ?? null
  if (!device) {
    const probe = await probeBrowserPrint()
    if (probe.status === 'ok') device = probe.device
    else if (probe.status === 'no_default' && probe.devices[0]) {
      device = probe.devices[0]
    } else if (probe.status === 'ssl') {
      throw new Error(probe.hint)
    } else if (probe.status === 'down') {
      throw new Error(probe.hint)
    } else {
      throw new Error(
        'Nincs default nyomtató. Browser Print → Default printer: ZD220.'
      )
    }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${getBaseUrl()}write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        Accept: '*/*'
      },
      body: JSON.stringify({ device, data: zpl }),
      signal: ctrl.signal
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(
        body ||
          'A nyomtató nem fogadta a címkét — ellenőrizd a papírt / Pause gombot.'
      )
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('A Zebra Browser Print nem válaszolt időben.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function browserPrintStatusLabel(probe: BrowserPrintProbe): {
  tone: 'ok' | 'warn' | 'error'
  text: string
} {
  switch (probe.status) {
    case 'ok':
      return { tone: 'ok', text: `Zebra kész · ${probe.device.name}` }
    case 'no_default':
      return {
        tone: 'warn',
        text:
          probe.devices.length > 0
            ? 'Nincs default printer — állítsd be a Browser Printben'
            : 'Nincs Zebra nyomtató'
      }
    case 'ssl':
      return { tone: 'error', text: 'HTTPS SSL — fogadd el a tanúsítványt' }
    case 'down':
      return { tone: 'error', text: 'Browser Print nem fut' }
  }
}
