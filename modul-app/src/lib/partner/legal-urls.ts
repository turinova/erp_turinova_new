/**
 * Partner jogi dokumentumok — forrásigazság: optinova.hu (env-felülírható).
 * Az app csak linkel; a teljes szöveg nem a modul-appban él.
 */

const DEFAULT_ASZF = 'https://optinova.hu/aszf'
const DEFAULT_PRIVACY = 'https://optinova.hu/adatkezelesi-tajekoztato'
const DEFAULT_IMPRESSUM = 'https://optinova.hu/impresszum'

function trimUrl(raw: string | undefined, fallback: string): string {
  const v = raw?.trim()
  return v && v.length > 0 ? v.replace(/\/$/, '') : fallback
}

export type PartnerLegalUrls = {
  aszf: string
  privacy: string
  impressum: string
}

export function getPartnerLegalUrls(): PartnerLegalUrls {
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
