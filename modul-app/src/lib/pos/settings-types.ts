export type PosCardProvider = 'none' | 'manual' | 'teya'
export type TeyaEnv = 'production' | 'staging'
export type PosStockPolicy = 'warn' | 'block'
export type PosPayModeSetting = 'cash' | 'card' | 'split'

export type TenantPosSettings = {
  tenant_id: string
  card_provider: PosCardProvider
  teya_env: TeyaEnv
  teya_store_id: string | null
  teya_terminal_id: string | null
  teya_client_id: string | null
  /** Soha ne küldjük a kliensnek nyersen a mentés után — csak maszk. */
  teya_client_secret: string | null
  teya_epos_instance_id: string
  allow_cash: boolean
  allow_card: boolean
  allow_split: boolean
  default_pay_mode: PosPayModeSetting | null
  stock_policy: PosStockPolicy
  max_discount_percent: number
  show_invoice_button: boolean
  require_customer: boolean
}

/** Kliensnek biztonságos nézet (nincs secret). */
export type PosTerminalPublicConfig = {
  cardProvider: PosCardProvider
  teyaReady: boolean
  teyaEnv: TeyaEnv
  teyaStoreId: string | null
  teyaTerminalId: string | null
  teyaEposInstanceId: string
  hasClientId: boolean
  hasClientSecret: boolean
  allowCash: boolean
  allowCard: boolean
  allowSplit: boolean
  defaultPayMode: PosPayModeSetting | null
  stockPolicy: PosStockPolicy
  maxDiscountPercent: number
  showInvoiceButton: boolean
  requireCustomer: boolean
}

export const POS_SETTINGS_SELECT =
  'tenant_id, card_provider, teya_env, teya_store_id, teya_terminal_id, teya_client_id, teya_client_secret, teya_epos_instance_id, allow_cash, allow_card, allow_split, default_pay_mode, stock_policy, max_discount_percent, show_invoice_button, require_customer' as const

export function isTeyaReady(s: TenantPosSettings | null): boolean {
  if (!s || s.card_provider !== 'teya') return false
  return Boolean(
    s.teya_store_id?.trim() &&
      s.teya_terminal_id?.trim() &&
      s.teya_client_id?.trim() &&
      s.teya_client_secret?.trim()
  )
}

export function toPublicPosConfig(
  s: TenantPosSettings | null
): PosTerminalPublicConfig {
  if (!s) {
    return {
      cardProvider: 'manual',
      teyaReady: false,
      teyaEnv: 'production',
      teyaStoreId: null,
      teyaTerminalId: null,
      teyaEposInstanceId: 'modul-pos',
      hasClientId: false,
      hasClientSecret: false,
      allowCash: true,
      allowCard: true,
      allowSplit: true,
      defaultPayMode: null,
      stockPolicy: 'warn',
      maxDiscountPercent: 100,
      showInvoiceButton: true,
      requireCustomer: false
    }
  }
  return {
    cardProvider: s.card_provider,
    teyaReady: isTeyaReady(s),
    teyaEnv: s.teya_env,
    teyaStoreId: s.teya_store_id,
    teyaTerminalId: s.teya_terminal_id,
    teyaEposInstanceId: s.teya_epos_instance_id || 'modul-pos',
    hasClientId: Boolean(s.teya_client_id?.trim()),
    hasClientSecret: Boolean(s.teya_client_secret?.trim()),
    allowCash: s.allow_cash !== false,
    allowCard: s.allow_card !== false,
    allowSplit: s.allow_split !== false,
    defaultPayMode: s.default_pay_mode,
    stockPolicy: s.stock_policy === 'block' ? 'block' : 'warn',
    maxDiscountPercent: Math.min(
      100,
      Math.max(0, Number(s.max_discount_percent) || 100)
    ),
    showInvoiceButton: s.show_invoice_button !== false,
    requireCustomer: Boolean(s.require_customer)
  }
}
