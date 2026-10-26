'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

import { CustomerForm } from '@/components/customers/customer-form'
import {
  CustomerQuotesList,
  type CustomerQuotesPeriod
} from '@/components/customers/customer-quotes-list'
import {
  CustomerSalesList,
  type CustomerSalesPeriod
} from '@/components/customers/customer-sales-list'
import type { CustomerDetail } from '@/lib/customers/queries'
import type { PaymentStatus } from '@/lib/quotes/payment-labels'
import type {
  CustomerQuotesSummary,
  QuoteListItem,
  QuoteStatus
} from '@/lib/quotes/queries'
import type {
  CustomerSalesSummary,
  SaleListItem
} from '@/lib/sales/queries'
import type {
  SaleChannel,
  SalePaymentStatus,
  SaleStatus
} from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

type TabKey = 'adatok' | 'eladasok' | 'lapszabaszat'

type Props = {
  customer: CustomerDetail
  canWrite: boolean
  canOpenSales: boolean
  canOpenLapszab: boolean
  canOpenOpti: boolean
  sales: {
    rows: SaleListItem[]
    total: number
    page: number
    limit: number
    q: string
    pay: SalePaymentStatus | 'all'
    channel: SaleChannel | 'all'
    status: SaleStatus | 'all'
    period: CustomerSalesPeriod
  } | null
  salesSummary: CustomerSalesSummary | null
  quotes: {
    rows: QuoteListItem[]
    total: number
    page: number
    limit: number
    q: string
    pay: PaymentStatus | 'all'
    status: QuoteStatus | 'all'
    period: CustomerQuotesPeriod
  } | null
  quotesSummary: CustomerQuotesSummary | null
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'adatok', label: 'Adatok' },
  { key: 'eladasok', label: 'Értékesítések' },
  { key: 'lapszabaszat', label: 'Lapszabászat' }
]

function clearSalesParams(sp: URLSearchParams) {
  sp.delete('page')
  sp.delete('q')
  sp.delete('pay')
  sp.delete('channel')
  sp.delete('status')
  sp.delete('period')
}

function clearLapszabParams(sp: URLSearchParams) {
  sp.delete('lpage')
  sp.delete('lq')
  sp.delete('lpay')
  sp.delete('lstatus')
  sp.delete('lperiod')
}

export function CustomerDetailClient({
  customer,
  canWrite,
  canOpenSales,
  canOpenLapszab,
  canOpenOpti,
  sales,
  salesSummary,
  quotes,
  quotesSummary
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const raw = searchParams.get('tab')

  let active: TabKey = 'adatok'
  if (raw === 'eladasok' && canOpenSales) active = 'eladasok'
  else if (raw === 'lapszabaszat' && canOpenLapszab) active = 'lapszabaszat'

  const setTab = useCallback(
    (key: TabKey) => {
      const sp = new URLSearchParams(searchParams.toString())
      if (key === 'adatok') {
        sp.delete('tab')
        clearSalesParams(sp)
        clearLapszabParams(sp)
      } else if (key === 'eladasok') {
        sp.set('tab', 'eladasok')
        clearLapszabParams(sp)
        sp.delete('page')
      } else {
        sp.set('tab', 'lapszabaszat')
        clearSalesParams(sp)
        sp.delete('lpage')
      }
      const q = sp.toString()
      router.replace(q ? `?${q}` : '?', { scroll: false })
    },
    [router, searchParams]
  )

  const salesCount = salesSummary?.saleCount ?? 0
  const quotesCount = quotesSummary?.quoteCount ?? 0

  return (
    <div>
      <div
        role="tablist"
        aria-label="Ügyfél nézetek"
        className="mb-4 inline-flex gap-1 rounded-lg border border-border bg-subtle p-1"
      >
        {TABS.map((tab) => {
          if (tab.key === 'eladasok' && !canOpenSales) return null
          if (tab.key === 'lapszabaszat' && !canOpenLapszab) return null
          const count =
            tab.key === 'eladasok'
              ? salesCount
              : tab.key === 'lapszabaszat'
                ? quotesCount
                : 0
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active === tab.key}
              onClick={() => setTab(tab.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                active === tab.key
                  ? 'bg-ink text-white'
                  : 'text-ink-secondary hover:bg-surface hover:text-ink'
              )}
            >
              {tab.label}
              {count > 0 ? (
                <span className="ml-1.5 tabular-nums opacity-80">
                  ({count})
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {active === 'adatok' ? (
        <CustomerForm mode="edit" initial={customer} canWrite={canWrite} />
      ) : active === 'eladasok' ? (
        sales && salesSummary ? (
          <div className="pb-10">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-ink">
                {customer.name} · értékesítések
              </h2>
              <Link
                href="/ugyfelek"
                className="text-body text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
              >
                Vissza a listához
              </Link>
            </div>
            <CustomerSalesList
              rows={sales.rows}
              total={sales.total}
              page={sales.page}
              limit={sales.limit}
              q={sales.q}
              pay={sales.pay}
              channel={sales.channel}
              status={sales.status}
              period={sales.period}
              summary={salesSummary}
              canOpenSales={canOpenSales}
            />
          </div>
        ) : (
          <p className="text-body text-ink-muted">Nem sikerült betölteni.</p>
        )
      ) : quotes && quotesSummary ? (
        <div className="pb-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[16px] font-semibold text-ink">
              {customer.name} · lapszabászat
            </h2>
            <Link
              href="/ugyfelek"
              className="text-body text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
            >
              Vissza a listához
            </Link>
          </div>
          <CustomerQuotesList
            rows={quotes.rows}
            total={quotes.total}
            page={quotes.page}
            limit={quotes.limit}
            q={quotes.q}
            pay={quotes.pay}
            status={quotes.status}
            period={quotes.period}
            summary={quotesSummary}
            canOpenOpti={canOpenOpti}
          />
        </div>
      ) : (
        <p className="text-body text-ink-muted">Nem sikerült betölteni.</p>
      )}
    </div>
  )
}
