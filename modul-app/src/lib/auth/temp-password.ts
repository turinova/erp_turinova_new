import { randomBytes } from 'crypto'

/** Olvasható ideiglenes jelszó (platform + tenant admin reset). */
export function generateTempPassword(): string {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(14)
  let out = ''
  for (const b of bytes) {
    out += alphabet[b % alphabet.length]
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12)}`
}
