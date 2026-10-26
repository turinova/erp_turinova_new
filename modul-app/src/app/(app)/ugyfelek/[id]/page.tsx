import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CustomerDetailClient } from '@/components/customers/customer-detail-client'
import type { CustomerQuotesPeriod } from '@/components/customers/customer-quotes-list'
import type { CustomerSalesPeriod } from '@/components/customers/customer-sales-list'
import { getSessionUser } from '@/lib/auth/session'
import { getCustomer } from '@/lib/customers/queries'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import { pathIsAllowed } from '@/lib/permissions/pages'
import type { PaymentStatus } from '@/lib/quotes/payment-labels'
import {
  getCustomerQuotesSummary,
  listQuotes,
  type QuoteStatus
} from '@/lib/quotes/queries'
import {
  getCustomerSalesSummary,
  listSales
} from '@/lib/sales/queries'
import {
  type SaleChannel,
  type SalePaymentStatus,
  type SaleStatus
} from '@/lib/sales/parse'
import { customerTabTitle } from '@/lib/seo/tab-titles'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>
type SearchParams = Promise<{
  tab?: string
  page?: string
  q?: string
  pay?: string
  channel?: string
  status?: string
  period?: string
  lq?: string
  lpay?: string
  lstatus?: string
  lperiod?: string
  lpage?: string
}>

const PERIOD_VALUES = new Set<CustomerSalesPeriod>(['all', '90d', 'year'])

function parsePeriod(raw: string | undefined): CustomerSalesPeriod {
  if (raw && PERIOD_VALUES.has(raw as CustomerSalesPeriod)) {
    return raw as CustomerSalesPeriod
  }
  return 'all'
}

function parseQuotesPeriod(raw: string | undefined): CustomerQuotesPeriod {
  return parsePeriod(raw) as CustomerQuotesPeriod
}

function periodToCreatedFrom(
  period: CustomerSalesPeriod | CustomerQuotesPeriod
): string | undefined {
  if (period === 'all') return undefined
  const now = new Date()
  if (period === '90d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 90)
    return d.toISOString()
  }
  const start = new Date(now.getFullYear(), 0, 1)
  return start.toISOString()
}

const PAY_VALUES = new Set<SalePaymentStatus>([
  'unpaid',
  'partial',
  'paid',
  'partially_refunded',
  'refunded'
])

const CHANNEL_VALUES = new Set<SaleChannel>(['manual', 'pos', 'webshop'])

const STATUS_VALUES = new Set<SaleStatus>([
  'draft',
  'confirmed',
  'fulfilled',
  'partially_returned',
  'cancelled',
  'returned'
])

const QUOTE_PAY_VALUES = new Set<PaymentStatus>([
  'not_paid',
  'partial',
  'paid'
])

const QUOTE_STATUS_VALUES = new Set<QuoteStatus>([
  'draft',
  'ordered',
  'in_production',
  'ready',
  'finished',
  'cancelled'
])

function parsePay(raw: string | undefined): SalePaymentStatus | 'all' {
  if (raw && PAY_VALUES.has(raw as SalePaymentStatus)) {
    return raw as SalePaymentStatus
  }
  return 'all'
}

function parseChannel(raw: string | undefined): SaleChannel | 'all' {
  if (raw && CHANNEL_VALUES.has(raw as SaleChannel)) {
    return raw as SaleChannel
  }
  return 'all'
}

function parseStatus(raw: string | undefined): SaleStatus | 'all' {
  if (raw && STATUS_VALUES.has(raw as SaleStatus)) {
    return raw as SaleStatus
  }
  return 'all'
}

function parseQuotePay(raw: string | undefined): PaymentStatus | 'all' {
  if (raw && QUOTE_PAY_VALUES.has(raw as PaymentStatus)) {
    return raw as PaymentStatus
  }
  return 'all'
}

function parseQuoteStatus(raw: string | undefined): QuoteStatus | 'all' {
  if (raw && QUOTE_STATUS_VALUES.has(raw as QuoteStatus)) {
    return raw as QuoteStatus
  }
  return 'all'
}

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { title: 'Ügyfél' }
  }
  const supabase = await createClient()
  if (!supabase) return { title: 'Ügyfél' }
  const label = await customerTabTitle(supabase, user.tenantId, id)
  return { title: label ?? 'Ügyfél' }
}

export default async function EditUgyfelPage({
  params,
  searchParams
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const sp = await searchParams
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const canOpenSales = pathIsAllowed('/ertekesitesek', user.allowedPages)
  const supabase = await createClient()
  if (!supabase) notFound()

  const hasLapszabaszat = await tenantHasLapszabaszat(supabase, user.tenantId)
  const canOpenLapszab =
    hasLapszabaszat &&
    (pathIsAllowed('/ajanlatok', user.allowedPages) ||
      pathIsAllowed('/megrendelesek', user.allowedPages))
  const canOpenOpti =
    hasLapszabaszat && pathIsAllowed('/opti', user.allowedPages)

  const customer = await getCustomer(supabase, user.tenantId, id)
  if (!customer) notFound()

  const page = Math.max(1, Number(sp.page) || 1)
  const limit = 25
  const q = (sp.q ?? '').trim()
  const pay = parsePay(sp.pay)
  const channel = parseChannel(sp.channel)
  const status = parseStatus(sp.status)
  const period = parsePeriod(sp.period)
  const createdFrom = periodToCreatedFrom(period)

  const lpage = Math.max(1, Number(sp.lpage) || 1)
  const lq = (sp.lq ?? '').trim()
  const lpay = parseQuotePay(sp.lpay)
  const lstatus = parseQuoteStatus(sp.lstatus)
  const lperiod = parseQuotesPeriod(sp.lperiod)
  const lCreatedFrom = periodToCreatedFrom(lperiod)

  let sales: {
    rows: Awaited<ReturnType<typeof listSales>>['rows']
    total: number
    page: number
    limit: number
    q: string
    pay: SalePaymentStatus | 'all'
    channel: SaleChannel | 'all'
    status: SaleStatus | 'all'
    period: CustomerSalesPeriod
  } | null = null

  let summary: Awaited<ReturnType<typeof getCustomerSalesSummary>> | null =
    null

  let quotes: {
    rows: Awaited<ReturnType<typeof listQuotes>>['rows']
    total: number
    page: number
    limit: number
    q: string
    pay: PaymentStatus | 'all'
    status: QuoteStatus | 'all'
    period: CustomerQuotesPeriod
  } | null = null

  let quotesSummary: Awaited<
    ReturnType<typeof getCustomerQuotesSummary>
  > | null = null

  const fetchSales = canOpenSales
    ? Promise.all([
        listSales(supabase, {
          tenantId: user.tenantId,
          customerId: id,
          page,
          limit,
          q: q || undefined,
          paymentStatus: pay,
          channel,
          status,
          createdFrom,
          excludeTerminalStatuses: status === 'all'
        }),
        getCustomerSalesSummary(supabase, {
          tenantId: user.tenantId,
          customerId: id
        })
      ])
    : null

  const fetchQuotes = canOpenLapszab
    ? Promise.all([
        listQuotes(supabase, {
          tenantId: user.tenantId,
          customerId: id,
          page: lpage,
          limit,
          q: lq || undefined,
          paymentStatus: lpay,
          status: lstatus === 'all' ? 'all' : lstatus,
          createdFrom: lCreatedFrom,
          excludeCancelled: lstatus === 'all'
        }),
        getCustomerQuotesSummary(supabase, {
          tenantId: user.tenantId,
          customerId: id
        })
      ])
    : null

  const [salesBundle, quotesBundle] = await Promise.all([
    fetchSales,
    fetchQuotes
  ])

  if (salesBundle) {
    const [result, sum] = salesBundle
    sales = {
      rows: result.rows,
      total: result.total,
      page: result.page,
      limit: result.limit,
      q,
      pay,
      channel,
      status,
      period
    }
    summary = sum
  }

  if (quotesBundle) {
    const [result, sum] = quotesBundle
    quotes = {
      rows: result.rows,
      total: result.total,
      page: result.page,
      limit: result.limit,
      q: lq,
      pay: lpay,
      status: lstatus,
      period: lperiod
    }
    quotesSummary = sum
  }

  return (
    <CustomerDetailClient
      customer={customer}
      canWrite={canWrite}
      canOpenSales={canOpenSales}
      canOpenLapszab={canOpenLapszab}
      canOpenOpti={canOpenOpti}
      sales={sales}
      salesSummary={summary}
      quotes={quotes}
      quotesSummary={quotesSummary}
    />
  )
}
