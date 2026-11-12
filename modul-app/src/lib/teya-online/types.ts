export type TeyaOnlineEnv = 'staging' | 'production'

/** Szerver oldali teljes credential (secrettel). */
export type TeyaOnlineCredentials = {
  env: TeyaOnlineEnv
  storeId: string
  clientId: string
  clientSecret: string
}

/** Kliensnek biztonságos nézet — nincs secret. */
export type TeyaOnlineSettingsPublic = {
  enabled: boolean
  env: TeyaOnlineEnv
  storeId: string
  clientId: string
  hasClientSecret: boolean
  hasWebhookPublicKey: boolean
  /** enabled + store + client + secret mind megvan. */
  ready: boolean
}

export function emptyTeyaOnlineSettingsPublic(): TeyaOnlineSettingsPublic {
  return {
    enabled: false,
    env: 'staging',
    storeId: '',
    clientId: '',
    hasClientSecret: false,
    hasWebhookPublicKey: false,
    ready: false
  }
}
