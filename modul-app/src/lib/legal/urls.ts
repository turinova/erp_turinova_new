/**
 * Jogi dokumentumok — forrásigazság: optinova.hu (env-felülírható).
 * Staff app és partner portál ugyanazokat a linkeket használja.
 */

const DEFAULT_ASZF = 'https://optinova.hu/aszf'
const DEFAULT_PRIVACY = 'https://optinova.hu/adatkezelesi-tajekoztato'
const DEFAULT_IMPRESSUM = 'https://optinova.hu/impresszum'

function trimUrl(raw: string | undefined, fallback: string): string {
  const v = raw?.trim()
  return v && v.length > 0 ? v.replace(/\/$/, '') : fallback
}

export type LegalUrls = {
  aszf: string
  privacy: string
  impressum: string
}

export function getLegalUrls(): LegalUrls {
  return {
    aszf: trimUrl(process.env.NEXT_PUBLIC_LEGAL_ASZF_URL, DEFAULT_ASZF),
    privacy: trimUrl(
      process.env.NEXT_PUBLIC_LEGAL_PRIVACY_URL,
      DEFAULT_PRIVACY
    ),
    impressum: trimUrl(
      process.env.NEXT_PUBLIC_LEGAL_IMPRESSUM_URL,
      DEFAULT_IMPRESSUM
    )
  }
}

/** @deprecated Használd: getLegalUrls */
export function getPartnerLegalUrls(): LegalUrls {
  return getLegalUrls()
}
