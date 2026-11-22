/**
 * Kiosk ügyfél-egyezés tiszta szabályai (DB nélkül, tesztelhető).
 * A `normalizeHuPhone` a SQL `public.normalize_hu_phone` párja.
 */

export type KioskCustomerMatch =
  | 'phone'
  | 'phone_multiple'
  | 'created'
  | 'created_renamed'

export function normalizeHuPhone(raw: string | null | undefined): string | null {
  const d = (raw ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('0036')) return d.slice(2)
  if (d.startsWith('06')) return `36${d.slice(2)}`
  if (d.length === 9 && ['20', '30', '31', '50', '70'].includes(d.slice(0, 2))) {
    return `36${d}`
  }
  return d
}

export function phoneLast4(raw: string | null | undefined): string {
  const d = (raw ?? '').replace(/\D/g, '')
  return d.slice(-4)
}

export function normalizeGuestName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** Névütközéskor: 1. „Név (…4567)”, 2. „Név (+36 30 123 4567)”. */
export function renamedCustomerName(
  name: string,
  phone: string,
  attempt: 1 | 2
): string {
  if (attempt === 1) return `${name} (…${phoneLast4(phone)})`
  return `${name} (${phone.trim()})`
}

export function matchKindForCount(count: number): KioskCustomerMatch | null {
  if (count <= 0) return null
  return count === 1 ? 'phone' : 'phone_multiple'
}

export function isCustomerNameConflict(error: {
  code?: string | null
  message?: string | null
} | null): boolean {
  if (!error) return false
  const msg = error.message ?? ''
  return (
    error.code === '23505' &&
    (msg.includes('customers_tenant_name') || msg.includes('lower(name)'))
  )
}

export const KIOSK_CUSTOMER_MATCH_LABEL: Record<KioskCustomerMatch, string> = {
  phone: 'Meglévő ügyfél (telefonszám alapján)',
  phone_multiple:
    'Több ügyfél van ezzel a telefonszámmal. Ellenőrizd, jó ügyfélhez került-e.',
  created: 'Új ügyfél jött létre',
  created_renamed:
    'Új ügyfél jött létre. A név már foglalt volt, ezért a telefonszám vége is bekerült.'
}
