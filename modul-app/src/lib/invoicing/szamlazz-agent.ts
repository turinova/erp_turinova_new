import { SZAMLAZZ_DEFAULT_API_URL } from '@/lib/invoicing/types'

export function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return ''
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function normalizeSzamlazzApiUrl(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim()
  if (!t) return SZAMLAZZ_DEFAULT_API_URL
  return t.endsWith('/') ? t : `${t}/`
}

export type SzamlazzTestResult = {
  ok: boolean
  error?: string
}

/** Agent kulcs ellenőrzés — adószám query (read-only). */
export async function testSzamlazzAgentConnection(
  agentKey: string,
  apiUrl?: string | null
): Promise<SzamlazzTestResult> {
  const key = String(agentKey ?? '').trim()
  if (!key) {
    return { ok: false, error: 'Hiányzik a Számla Agent kulcs.' }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmltaxpayer xmlns="http://www.szamlazz.hu/xmltaxpayer" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmltaxpayer https://www.szamlazz.hu/szamla/docs/xsds/agenttaxpayer/xmltaxpayer.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(key)}</szamlaagentkulcs>
  </beallitasok>
  <torzsszam>12345678</torzsszam>
</xmltaxpayer>`

  try {
    const formData = new FormData()
    formData.append(
      'action-szamla_agent_taxpayer',
      new Blob([xml], { type: 'application/xml; charset=utf-8' }),
      'taxpayer.xml'
    )

    const response = await fetch(normalizeSzamlazzApiUrl(apiUrl), {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(25000)
    })

    const errorCode = response.headers.get('szlahu_error_code')
    const errorMessage = decodeSzamlazzHeader(response.headers.get('szlahu_error'))
    if (errorCode || errorMessage) {
      return {
        ok: false,
        error: mapSzamlazzError(errorCode, errorMessage)
      }
    }
    if (!response.ok) {
      return { ok: false, error: `Számlázz.hu HTTP hiba: ${response.status}` }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Nem sikerült kapcsolódni a Számlázz.hu-hoz.'
    }
  }
}

export type SzamlazzPostResult =
  | {
      ok: true
      invoiceNumber: string
      pdfBuffer: ArrayBuffer | null
      rawHeaders: Record<string, string>
      /** elonezetpdf — számlaszám nélkül is OK */
      previewOnly?: boolean
    }
  | { ok: false; error: string }

export async function postSzamlazzXml(opts: {
  agentKey: string
  apiUrl?: string | null
  xml: string
  actionField?: string
  /** Preview: PDF elég, számlaszám nem kötelező */
  preview?: boolean
}): Promise<SzamlazzPostResult> {
  const formData = new FormData()
  const field = opts.actionField ?? 'action-xmlagentxmlfile'
  formData.append(
    field,
    new Blob([opts.xml], { type: 'application/xml; charset=utf-8' }),
    'invoice.xml'
  )

  try {
    const response = await fetch(normalizeSzamlazzApiUrl(opts.apiUrl), {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(opts.preview ? 120000 : 60000)
    })

    const errorCode = response.headers.get('szlahu_error_code')
    const errorMessage = decodeSzamlazzHeader(response.headers.get('szlahu_error'))
    if (errorCode || errorMessage) {
      return {
        ok: false,
        error: mapSzamlazzError(errorCode, errorMessage)
      }
    }

    const invoiceNumber =
      response.headers.get('szlahu_szamlaszam')?.trim() || ''

    const contentType = response.headers.get('content-type') || ''
    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    if (contentType.includes('pdf') || isPdfMagic(bytes)) {
      if (opts.preview || invoiceNumber) {
        return {
          ok: true,
          invoiceNumber: invoiceNumber || '',
          pdfBuffer: buffer,
          rawHeaders: { szamlaszam: invoiceNumber },
          previewOnly: opts.preview && !invoiceNumber
        }
      }
    }

    const text = new TextDecoder('utf-8').decode(bytes)
    if (text.includes('<hibakod>') || text.includes('hiba')) {
      const code = text.match(/<hibakod>([^<]+)<\/hibakod>/i)?.[1]
      const msg = text.match(/<hibauzenet>([^<]+)<\/hibauzenet>/i)?.[1]
      return { ok: false, error: mapSzamlazzError(code, msg) }
    }

    // valaszVerzio=2: base64 PDF a válaszban (előnézet)
    const pdfB64 =
      text.match(/<pdf[^>]*>([^<]+)<\/pdf>/i)?.[1]?.trim() ||
      text.match(/<pdfTartalom[^>]*>([^<]+)<\/pdfTartalom>/i)?.[1]?.trim()
    if (pdfB64 && opts.preview) {
      try {
        const bin = atob(pdfB64)
        const out = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
        return {
          ok: true,
          invoiceNumber: invoiceNumber || '',
          pdfBuffer: out.buffer,
          rawHeaders: {},
          previewOnly: true
        }
      } catch {
        /* fall through */
      }
    }

    const fromXml = text.match(/<szamlaszam>([^<]+)<\/szamlaszam>/i)?.[1]
    const number = invoiceNumber || fromXml?.trim() || ''

    if (opts.preview && !number) {
      return {
        ok: false,
        error: 'Az előnézet PDF nem érkezett meg a Számlázz.hu-tól.'
      }
    }

    if (!number) {
      return {
        ok: false,
        error:
          'A Számlázz.hu nem adott vissza számlaszámot. Ellenőrizd a Agent kulcsot és az adatokat.'
      }
    }

    return {
      ok: true,
      invoiceNumber: number,
      pdfBuffer: null,
      rawHeaders: {
        szamlaszam: number
      }
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Időtúllépés vagy hálózati hiba a Számlázz.hu felé.'
    }
  }
}

export async function fetchSzamlazzPdf(opts: {
  agentKey: string
  apiUrl?: string | null
  invoiceNumber: string
}): Promise<{ ok: true; pdf: ArrayBuffer } | { ok: false; error: string }> {
  // PDF query XSD: kulcs + számlaszám közvetlenül a gyökér alatt (nincs <beallitasok>).
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlapdf xmlns="http://www.szamlazz.hu/xmlszamlapdf" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlapdf https://www.szamlazz.hu/szamla/docs/xsds/agentpdf/xmlszamlapdf.xsd">
  <szamlaagentkulcs>${escapeXml(opts.agentKey)}</szamlaagentkulcs>
  <szamlaszam>${escapeXml(opts.invoiceNumber)}</szamlaszam>
  <valaszVerzio>2</valaszVerzio>
  <szamlaKulsoAzon></szamlaKulsoAzon>
</xmlszamlapdf>`

  const formData = new FormData()
  formData.append(
    'action-szamla_agent_pdf',
    new Blob([xml], { type: 'application/xml; charset=utf-8' }),
    'pdf.xml'
  )

  try {
    const response = await fetch(normalizeSzamlazzApiUrl(opts.apiUrl), {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120000)
    })

    const errorCode = response.headers.get('szlahu_error_code')
    const errorMessage = decodeSzamlazzHeader(response.headers.get('szlahu_error'))
    if (errorCode || errorMessage) {
      return { ok: false, error: mapSzamlazzError(errorCode, errorMessage) }
    }

    const contentType = response.headers.get('content-type') || ''
    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    if (isPdfMagic(bytes)) {
      return { ok: true, pdf: buffer }
    }

    // valaszVerzio=2: XML + base64 PDF (shop-portal minta)
    const text = new TextDecoder('utf-8').decode(bytes)

    if (text.includes('<hibakod>') || text.includes('<hibauzenet>')) {
      const code = text.match(/<hibakod[^>]*>([^<]+)<\/hibakod>/i)?.[1]
      const msg = text.match(/<hibauzenet[^>]*>([^<]+)<\/hibauzenet>/i)?.[1]
      return { ok: false, error: mapSzamlazzError(code, msg) }
    }

    const pdfMatch =
      text.match(/<pdf[^>]*>([\s\S]*?)<\/pdf>/i) ||
      text.match(/<pdfTartalom[^>]*>([\s\S]*?)<\/pdfTartalom>/i)
    const pdfB64 = pdfMatch?.[1]?.replace(/\s+/g, '').trim()
    if (pdfB64) {
      try {
        const binary = atob(pdfB64)
        const out = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          out[i] = binary.charCodeAt(i)
        }
        if (!isPdfMagic(out)) {
          return { ok: false, error: 'A dekódolt tartalom nem érvényes PDF.' }
        }
        return { ok: true, pdf: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) }
      } catch {
        return { ok: false, error: 'PDF base64 dekódolási hiba.' }
      }
    }

    if (contentType.includes('pdf') || contentType.includes('octet')) {
      // Content-Type PDF, de nincs %PDF magic — ne adjuk át a böngészőnek
      return {
        ok: false,
        error:
          'A Számlázz.hu válasza nem érvényes PDF (hiányzik a fájlfejléc).'
      }
    }

    return {
      ok: false,
      error:
        'PDF nem található a válaszban (nem nyers PDF és nincs base64 az XML-ben).'
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'PDF lekérés sikertelen.'
    }
  }
}

function isPdfMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  )
}

function decodeSzamlazzHeader(raw: string | null): string | null {
  if (!raw) return null
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' ')).trim()
  } catch {
    return raw.trim()
  }
}

function mapSzamlazzError(
  code: string | null | undefined,
  message: string | null | undefined
): string {
  const msg = decodeSzamlazzHeader(message ?? null) || (message || '').trim()
  const c = (code || '').trim()
  if (msg && c) return `Számlázz.hu hiba (${c}): ${msg}`
  if (msg) return `Számlázz.hu hiba: ${msg}`
  if (c) return `Számlázz.hu hiba (kód: ${c}).`
  return 'Ismeretlen Számlázz.hu hiba. Ellenőrizd a kulcsot és az adatokat.'
}
