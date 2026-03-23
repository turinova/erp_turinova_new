/**
 * Számla Agent (Számlázz.hu) helpers — tenant-scoped credentials live in webshop_connections.
 *
 * @see https://docs.szamlazz.hu/agent/category/basics
 */

/** Default Számla Agent endpoint (trailing slash as used by main-app). */
export const SZAMLAZZ_DEFAULT_API_URL = 'https://www.szamlazz.hu/szamla/'

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) {
    return ''
  }
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Normalizes optional base URL from the tenant; defaults to production Agent URL.
 */
export function normalizeSzamlazzApiUrl(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim()
  if (!t) {
    return SZAMLAZZ_DEFAULT_API_URL
  }
  return t.endsWith('/') ? t : `${t}/`
}

/**
 * Builds minimal XML for querying taxpayer (validates Agent key).
 *
 * @see https://docs.szamlazz.hu/agent/querying_taxpayer/request
 */
function buildQueryTaxpayerXml(agentKey: string, torzsszam: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmltaxpayer xmlns="http://www.szamlazz.hu/xmltaxpayer" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmltaxpayer https://www.szamlazz.hu/szamla/docs/xsds/agenttaxpayer/xmltaxpayer.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(agentKey)}</szamlaagentkulcs>
  </beallitasok>
  <torzsszam>${escapeXml(torzsszam)}</torzsszam>
</xmltaxpayer>`
}

export type SzamlazzTestResult = {
  success: boolean
  status: 'success' | 'failed'
  error?: string
}

/**
 * Verifies the Agent key by calling the taxpayer query endpoint (read-only).
 * Uses a dummy 8-digit base number; invalid keys still fail via response headers.
 */
export async function testSzamlazzAgentConnection(
  agentKey: string,
  apiUrl?: string | null
): Promise<SzamlazzTestResult> {
  const key = String(agentKey ?? '').trim()
  if (!key) {
    return { success: false, status: 'failed', error: 'Hiányzik a Számla Agent kulcs.' }
  }

  const base = normalizeSzamlazzApiUrl(apiUrl)
  const xml = buildQueryTaxpayerXml(key, '12345678')

  try {
    const formData = new FormData()
    const xmlBlob = new Blob([xml], { type: 'application/xml; charset=utf-8' })
    formData.append('action-szamla_agent_taxpayer', xmlBlob, 'taxpayer.xml')

    const response = await fetch(base, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(25000)
    })

    const errorCode = response.headers.get('szlahu_error_code')
    const errorMessage = response.headers.get('szlahu_error')

    if (errorCode || errorMessage) {
      const msg = [errorMessage, errorCode ? `(kód: ${errorCode})` : '']
        .filter(Boolean)
        .join(' ')
      return {
        success: false,
        status: 'failed',
        error: msg.trim() || 'Szamlazz.hu hiba (ismeretlen)'
      }
    }

    if (!response.ok) {
      return {
        success: false,
        status: 'failed',
        error: `Szamlazz.hu HTTP hiba: ${response.status}`
      }
    }

    const responseBody = await response.text()
    if (!responseBody?.trim()) {
      return {
        success: false,
        status: 'failed',
        error: 'Üres válasz érkezett a Szamlazz.hu API-tól'
      }
    }

    return { success: true, status: 'success' }
  } catch (e) {
    const err = e as { name?: string; message?: string }
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      return { success: false, status: 'failed', error: 'Szamlazz.hu kapcsolat időtúllépés' }
    }
    const message = e instanceof Error ? e.message : 'Ismeretlen hiba'
    return {
      success: false,
      status: 'failed',
      error: `Hálózati hiba: ${message}`
    }
  }
}
