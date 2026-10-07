import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CustomerDetailClient } from '@/components/customers/customer-detail-client'
import { getSessionUser } from '@/lib/auth/session'
import { getCustomer } from '@/lib/customers/queries'
import { pathIsAllowed } from '@/lib/permissions/pages'
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
}>

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

  const customer = await getCustomer(supabase, user.tenantId, id)
  if (!customer) notFound()

  const page = Math.max(1, Number(sp.page) || 1)
  const limit = 25
  const q = (sp.q ?? '').trim()
  const pay = parsePay(sp.pay)
  const channel = parseChannel(sp.channel)
  const status = parseStatus(sp.status)

  let sales: {
    rows: Awaited<ReturnType<typeof listSales>>['rows']
    total: number
    page: number
    limit: number
    q: string
    pay: SalePaymentStatus | 'all'
    channel: SaleChannel | 'all'
    status: SaleStatus | 'all'
  } | null = null

  let summary: Awaited<ReturnType<typeof getCustomerSalesSummary>> | null =
    null

  if (canOpenSales) {
    const [result, sum] = await Promise.all([
      listSales(supabase, {
        tenantId: user.tenantId,
        customerId: id,
        page,
        limit,
        q: q || undefined,
        paymentStatus: pay,
        channel,
        status,
        excludeTerminalStatuses: status === 'all'
      }),
      getCustomerSalesSummary(supabase, {
        tenantId: user.tenantId,
        customerId: id
      })
    ])
    sales = {
      rows: result.rows,
      total: result.total,
      page: result.page,
      limit: result.limit,
      q,
      pay,
      channel,
      status
    }
    summary = sum
  }

  return (
    <CustomerDetailClient
      customer={customer}
      canWrite={canWrite}
      canOpenSales={canOpenSales}
      sales={sales}
      salesSummary={summary}
    />
  )
}
