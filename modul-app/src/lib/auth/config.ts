export const DEV_SESSION_COOKIE = 'modul_dev_session'
export const CURRENT_TENANT_COOKIE = 'modul_current_tenant_id'
/** Egy aktív böngésző-session nonce (single login / user). */
export const APP_SESSION_NONCE_COOKIE = 'modul_session_nonce'
/** Aláírt session snapshot (entitlements cache) — P2. */
export const SESSION_SNAPSHOT_COOKIE = 'modul_session_v1'
/** Aktív support impersonation session id. */
export const IMPERSONATION_SESSION_COOKIE = 'modul_impersonation_id'
/** Operator refresh token mentés impersonation alatt. */
export const OPERATOR_REFRESH_COOKIE = 'modul_operator_refresh'

/** Snapshot TTL másodpercben (15 perc). */
export const SESSION_SNAPSHOT_TTL_SEC = 15 * 60

export function isDevBypassEnabled() {
  return process.env.AUTH_DEV_BYPASS === 'true'
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export function getDemoCompanyName() {
  return process.env.NEXT_PUBLIC_DEMO_COMPANY_NAME || 'Demo Asztalos Kft.'
}

/**
 * HMAC secret a session snapshot aláíráshoz.
 * Fallback: service role / anon key slice — csak hogy local ne törjön;
 * prod-ban állíts SESSION_SNAPSHOT_SECRET-et.
 */
export function getSessionSnapshotSecret(): string {
  const explicit = process.env.SESSION_SNAPSHOT_SECRET?.trim()
  if (explicit && explicit.length >= 16) return explicit
  const fallback =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'modul-dev-session-snapshot-secret'
  return fallback.slice(0, 64)
}
