export type InitialConnection = {
  id: string
  host: string
  port: number
  secure: boolean
  smtp_username: string
  has_password: boolean
  imap_host: string | null
  imap_port: number | null
  imap_secure: boolean | null
  provider_type: string
} | null

export type InitialIdentity = {
  id: string
  from_name: string
  from_email: string
  signature_html: string | null
  is_default: boolean
  sort_order: number
}

/** Maps automated e-mail channels to sending identities (PO / status — send wiring comes later). */
export type InitialChannelSettings = {
  purchase_order_identity_id: string | null
  order_status_notification_identity_id: string | null
}
