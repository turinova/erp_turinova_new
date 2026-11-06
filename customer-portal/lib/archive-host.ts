import {
  ARCHIVE_HOST,
  ARCHIVE_HOST_TYPO,
  ARCHIVE_LABEL,
  ARCHIVE_URL,
  NEW_SYSTEM_LABEL,
  NEW_SYSTEM_URL
} from '@/lib/migration-notice'

export { ARCHIVE_HOST, ARCHIVE_HOST_TYPO, ARCHIVE_LABEL, ARCHIVE_URL, NEW_SYSTEM_LABEL, NEW_SYSTEM_URL }

/** Normalize Host / X-Forwarded-Host header. */
export function normalizeHost(hostHeader: string | null | undefined): string {
  if (!hostHeader) return ''
  return hostHeader.split(',')[0]?.trim().split(':')[0]?.toLowerCase() ?? ''
}

export function isArchiveHost(hostHeader: string | null | undefined): boolean {
  const host = normalizeHost(hostHeader)
  return host === ARCHIVE_HOST || host === `www.${ARCHIVE_HOST}`
}

export function isArchiveTypoHost(hostHeader: string | null | undefined): boolean {
  const host = normalizeHost(hostHeader)
  return host === ARCHIVE_HOST_TYPO || host === `www.${ARCHIVE_HOST_TYPO}`
}

export const ARCHIVE_HOST_BANNER_TITLE = 'Archívum felület'
export const ARCHIVE_HOST_BANNER_BODY =
  'Ez a régi megrendelői portál archív címe. Új megrendelést az új rendszerben adjon le; itt a korábbi adatok megtekintéséhez jelentkezzen be a régi jelszavával.'
