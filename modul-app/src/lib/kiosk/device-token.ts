import { createHash, randomBytes } from 'node:crypto'

export function hashKioskToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Opaque device token — UI-ban egyszer látszik. */
export function generateKioskToken(): string {
  return `kiosk_${randomBytes(24).toString('base64url')}`
}
