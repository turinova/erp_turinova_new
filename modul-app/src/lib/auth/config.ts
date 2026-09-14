export const DEV_SESSION_COOKIE = 'modul_dev_session'
export const CURRENT_TENANT_COOKIE = 'modul_current_tenant_id'
/** Egy aktív böngésző-session nonce (single login / user). */
export const APP_SESSION_NONCE_COOKIE = 'modul_session_nonce'

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
