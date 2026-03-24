/**
 * Fetch invoice PDF from Számlázz.hu Agent (xmlszamlapdf) — no local storage.
 */
import { normalizeSzamlazzApiUrl } from '@/lib/szamlazz-agent'
import type { SzamlazzConnection } from '@/lib/shop-szamlazz-connection'
import { escapeXml } from '@/lib/szamlazz-shop-xml'

function buildQueryPdfXml(agentKey: string, invoiceNumber: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlapdf xmlns="http://www.szamlazz.hu/xmlszamlapdf" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlapdf https://www.szamlazz.hu/szamla/docs/xsds/agentpdf/xmlszamlapdf.xsd">
  <szamlaagentkulcs>${escapeXml(agentKey)}</szamlaagentkulcs>
  <szamlaszam>${escapeXml(invoiceNumber)}</szamlaszam>
  <valaszVerzio>2</valaszVerzio>
  <szamlaKulsoAzon></szamlaKulsoAzon>
</xmlszamlapdf>`
}

function isPdfMagic(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46
}

export type FetchSzamlazzPdfResult =
  | { ok: true; pdf: Buffer }
  | { ok: false; error: string; status: number; details?: string }

export async function fetchSzamlazzInvoicePdf(
  connection: SzamlazzConnection,
  providerInvoiceNumber: string
): Promise<FetchSzamlazzPdfResult> {
  const num = providerInvoiceNumber.trim()
  if (!num) {
    return { ok: false, error: 'Hiányzó számlaszám', status: 400 }
  }

  const agentKey = String(connection.password).trim()
  const xmlRequest = buildQueryPdfXml(agentKey, num)
  const apiUrl = normalizeSzamlazzApiUrl(connection.api_url)
  const formData = new FormData()
  const xmlBlob = new Blob([xmlRequest], { type: 'application/xml; charset=utf-8' })
  formData.append('action-szamla_agent_pdf', xmlBlob, 'query.xml')

  const response = await fetch(apiUrl, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(120000)
  })

  const errorCode = response.headers.get('szlahu_error_code')
  let errorMessage = response.headers.get('szlahu_error')
  if (errorMessage) {
    try {
      errorMessage = decodeURIComponent(errorMessage.replace(/\+/g, ' '))
    } catch {
      /* ignore */
    }
  }

  if (errorCode || errorMessage) {
    return {
      ok: false,
      error: `Szamlazz.hu hiba${errorCode ? ` (${errorCode})` : ''}: ${errorMessage || 'Ismeretlen hiba'}`,
      status: 400
    }
  }

  const contentType = response.headers.get('content-type') || ''
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (contentType.includes('application/pdf') || contentType.includes('pdf') || isPdfMagic(buffer)) {
    return { ok: true, pdf: buffer }
  }

  const responseText = buffer.toString('utf-8')

  if (responseText.includes('<hibakod>') || responseText.includes('<hibauzenet>')) {
    const errorCodeMatch = responseText.match(/<hibakod[^>]*>([^<]+)<\/hibakod>/i)
    const errorMessageMatch = responseText.match(/<hibauzenet[^>]*>([^<]+)<\/hibauzenet>/i)
    return {
      ok: false,
      error: `Szamlazz.hu XML hiba${errorCodeMatch ? ` (${errorCodeMatch[1]})` : ''}: ${errorMessageMatch ? errorMessageMatch[1] : 'Ismeretlen'}`,
      status: 400,
      details: responseText.substring(0, 500)
    }
  }

  const pdfMatch =
    responseText.match(/<pdf[^>]*>([\s\S]*?)<\/pdf>/i) ||
    responseText.match(/<pdfTartalom[^>]*>([\s\S]*?)<\/pdfTartalom>/i)
  const pdfB64 = pdfMatch?.[1]?.replace(/\s+/g, '').trim()
  if (pdfB64) {
    try {
      const pdf = Buffer.from(pdfB64, 'base64')
      return { ok: true, pdf }
    } catch {
      return { ok: false, error: 'PDF base64 dekódolási hiba', status: 502 }
    }
  }

  return {
    ok: false,
    error: 'PDF nem található a válaszban (nem PDF és nincs base64 a XML-ben)',
    status: 502,
    details: responseText.substring(0, 500)
  }
}
