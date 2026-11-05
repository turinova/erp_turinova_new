/** Régi customer-portal adatok archívuma (csak olvasható, ~3 hónap). */
export const ARCHIVE_URL = 'https://archiv.turinova.hu'
export const ARCHIVE_LABEL = 'archiv.turinova.hu'
/** Belső lejárat: utána a kezdőlapi sáv eltűnik. Partnernek nem jelenítjük meg. */
export const ARCHIVE_UNTIL_ISO = '2027-02-08T23:59:59+01:00'

export type ArchiveNotice = { visible: boolean }

export function getArchiveNotice(now: Date = new Date()): ArchiveNotice {
  return { visible: now.getTime() <= new Date(ARCHIVE_UNTIL_ISO).getTime() }
}
