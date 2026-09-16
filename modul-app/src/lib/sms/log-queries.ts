import type { SupabaseClient } from '@supabase/supabase-js'

import {
  currentUtcYearMonth,
  formatHufAmount
} from '@/lib/billing/estimate'
import type { SmsSendStatus, SmsSkipReason } from '@/lib/sms/types'

export type SmsLogListItem = {
  id: string
  created_at: string
  status: SmsSendStatus
  to_e164: string | null
  to_display: string
  order_number: string | null
  quote_id: string | null
  skip_reason: SmsSkipReason | null
  error_code: string | null
  billable: boolean
}

export type SmsLogListResult = {
  rows: SmsLogListItem[]
  total: number
  page: number
  limit: number
  year: number
  month: number
  billableCount: number
}

const STATUS_LABEL: Record<SmsSendStatus, string> = {
  sent: 'Elküldve',
  delivered: 'Kézbesítve',
  failed: 'Sikertelen',
  skipped: 'Kihagyva'
}

const SKIP_LABEL: Record<SmsSkipReason, string> = {
  no_entitlement: 'Nincs SMS csomag',
  no_opt_in: 'Ügyfél nem kér SMS-t',
  bad_phone: 'Rossz telefonszám',
  already_sent: 'Már elküldve',
  user_declined: 'Nem kérték a küldést',
  no_customer: 'Nincs ügyfél',
  empty_body: 'Üres szöveg'
}

export function smsStatusLabel(status: SmsSendStatus): string {
  return STATUS_LABEL[status] ?? status
}

export function smsSkipReasonLabel(reason: SmsSkipReason | null): string | null {
  if (!reason) return null
  return SKIP_LABEL[reason] ?? reason
}

/** Audit: középső rész maszkolva. */
export function maskE164(mobile: string | null | undefined): string {
  if (!mobile) return '—'
  const digits = mobile.replace(/\s+/g, '')
  if (!digits.startsWith('+') || digits.length < 8) return '—'
  const last4 = digits.slice(-4)
  const prefix = digits.slice(0, Math.min(6, digits.length - 4))
  return `${prefix} *** ${last4}`
}

function utcMonthBounds(year: number, month: number): {
  start: string
  end: string
} {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    end: new Date(Date.UTC(year, month, 1)).toISOString()
  }
}

export async function listSmsSendEvents(
  supabase: SupabaseClient,
  params: {
    tenantId: string
    year?: number
    month?: number
    page?: number
    limit?: number
  }
): Promise<SmsLogListResult> {
  const ym =
    params.year && params.month
      ? { year: params.year, month: params.month }
      : currentUtcYearMonth()
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const { start, end } = utcMonthBounds(ym.year, ym.month)

  const [{ data, error, count }, { count: billableCount }] = await Promise.all([
    supabase
      .from('sms_send_events')
      .select(
        `
        id,
        created_at,
        status,
        to_e164,
        skip_reason,
        error_code,
        quote_id,
        quotes ( order_number )
      `,
        { count: 'exact' }
      )
      .eq('tenant_id', params.tenantId)
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase
      .from('sms_send_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', params.tenantId)
      .gte('created_at', start)
      .lt('created_at', end)
      .in('status', ['sent', 'delivered'])
  ])

  if (error) {
    console.error('listSmsSendEvents', error.message)
    throw new Error('Nem sikerült betölteni az SMS naplót.')
  }

  const rows: SmsLogListItem[] = (data ?? []).map(
    (row: {
      id: string
      created_at: string
      status: string
      to_e164: string | null
      skip_reason: string | null
      error_code: string | null
      quote_id: string | null
      quotes:
        | { order_number: string | null }
        | { order_number: string | null }[]
        | null
    }) => {
      const quotes = row.quotes
      const quote = Array.isArray(quotes) ? quotes[0] : quotes
      const status = row.status as SmsSendStatus
      return {
        id: row.id,
        created_at: row.created_at,
        status,
        to_e164: row.to_e164 ?? null,
        to_display: maskE164(row.to_e164),
        order_number: quote?.order_number ?? null,
        quote_id: row.quote_id ?? null,
        skip_reason: (row.skip_reason as SmsSkipReason | null) ?? null,
        error_code: row.error_code ?? null,
        billable: status === 'sent' || status === 'delivered'
      }
    }
  )

  return {
    rows,
    total: count ?? 0,
    page,
    limit,
    year: ym.year,
    month: ym.month,
    billableCount: billableCount ?? 0
  }
}

export function smsBillableHint(billableCount: number, unitPriceHuf: number) {
  if (billableCount <= 0) return 'Ebben a hónapban még nincs számlázható SMS.'
  return `${billableCount} db számlázható · ${formatHufAmount(billableCount * unitPriceHuf)} nettó`
}
