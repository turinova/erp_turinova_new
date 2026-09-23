import {
  escapeXml,
  normalizeSzamlazzApiUrl
} from '@/lib/invoicing/szamlazz-agent'

export type TaxpayerLookupResult = {
  name: string
  postalCode: string
  city: string
  street: string
  houseNumber: string
}

function tagText(xml: string, localName: string): string {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${localName}[^>]*>([^<]*)</(?:[\\w.-]+:)?${localName}>`,
    'i'
  )
  const m = xml.match(re)
  return m?.[1]?.trim() ?? ''
}

/** Számlázz taxpayer XML → számlázási mezők (regex, nincs XML lib). */
export function parseTaxpayerXml(xml: string): TaxpayerLookupResult | null {
  const name =
    tagText(xml, 'taxpayerName') ||
    tagText(xml, 'taxpayerShortName') ||
    tagText(xml, 'nev')
  if (!name) return null

  // Prefer HQ address block if present
  const hqBlock =
    xml.match(
      /<(?:[\w.-]+:)?taxpayerAddressItem[^>]*>[\s\S]*?<(?:[\w.-]+:)?taxpayerAddressType[^>]*>\s*(?:HQ|HEADQUARTERS)\s*<\/(?:[\w.-]+:)?taxpayerAddressType>[\s\S]*?<\/(?:[\w.-]+:)?taxpayerAddressItem>/i
    )?.[0] ?? xml

  const postalCode = tagText(hqBlock, 'postalCode')
  const city = tagText(hqBlock, 'city')
  const streetName = tagText(hqBlock, 'streetName')
  const publicPlace = tagText(hqBlock, 'publicPlaceCategory')
  const street = [streetName, publicPlace].filter(Boolean).join(' ').trim()

  const numberMatches = [
    ...hqBlock.matchAll(
      /<(?:[\w.-]+:)?number[^>]*>([^<]*)<\/(?:[\w.-]+:)?number>/gi
    )
  ].map((m) => m[1]!.trim())
  const pure = numberMatches.filter((n) => /^\d+\.?$/.test(n))
  const houseNumber =
    pure[0] || numberMatches.find((n) => !n.includes('/')) || numberMatches[0] || ''

  return {
    name,
    postalCode,
    city,
    street,
    houseNumber
  }
}

export async function queryTaxpayerByTaxNumber(opts: {
  agentKey: string
  apiUrl?: string | null
  taxNumber: string
}): Promise<
  | { ok: true; taxpayer: TaxpayerLookupResult }
  | { ok: false; error: string }
> {
  const clean = opts.taxNumber.trim().replace(/\s+/g, '')
  const torzsszam = clean.split('-')[0] || ''
  if (!/^\d{8}$/.test(torzsszam)) {
    return {
      ok: false,
      error: 'Az adószám első 8 számjegye szükséges a lekérdezéshez.'
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmltaxpayer xmlns="http://www.szamlazz.hu/xmltaxpayer" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmltaxpayer https://www.szamlazz.hu/szamla/docs/xsds/agenttaxpayer/xmltaxpayer.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(opts.agentKey)}</szamlaagentkulcs>
  </beallitasok>
  <torzsszam>${escapeXml(torzsszam)}</torzsszam>
</xmltaxpayer>`

  try {
    const formData = new FormData()
    formData.append(
      'action-szamla_agent_taxpayer',
      new Blob([xml], { type: 'application/xml; charset=utf-8' }),
      'taxpayer.xml'
    )

    const response = await fetch(normalizeSzamlazzApiUrl(opts.apiUrl), {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(25000)
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
        error: `Számlázz.hu hiba${errorCode ? ` (${errorCode})` : ''}: ${errorMessage || 'Ismeretlen hiba'}`
      }
    }

    const text = await response.text()
    if (!text.trim()) {
      return { ok: false, error: 'Üres válasz az adószám-lekérdezésre.' }
    }

    if (/<hibakod/i.test(text) || /<hibauzenet/i.test(text)) {
      const code = text.match(/<hibakod[^>]*>([^<]+)<\/hibakod>/i)?.[1]
      const msg = text.match(/<hibauzenet[^>]*>([^<]+)<\/hibauzenet>/i)?.[1]
      return {
        ok: false,
        error: `Számlázz.hu hiba${code ? ` (${code})` : ''}: ${msg || 'Ismeretlen'}`
      }
    }

    const taxpayer = parseTaxpayerXml(text)
    if (!taxpayer) {
      return {
        ok: false,
        error: 'Ez az adószám nem található, vagy a válasz nem értelmezhető.'
      }
    }
    return { ok: true, taxpayer }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Nem sikerült lekérdezni az adószámot.'
    }
  }
}

export const HU_TAX_NUMBER_RE = /^\d{8}-\d{1,2}-\d{2}$/
