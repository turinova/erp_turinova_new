'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

import { CustomerForm } from '@/components/customers/customer-form'
import { CustomerSalesList } from '@/components/customers/customer-sales-list'
import type { CustomerDetail } from '@/lib/customers/queries'
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

type TabKey = 'adatok' | 'eladasok'

type Props = {
  customer: CustomerDetail
  canWrite: boolean
  canOpenSales: boolean
  sales: {
    rows: SaleListItem[]
    total: number
    page: number
    limit: number
    q: string
    pay: SalePaymentStatus | 'all'
    channel: SaleChannel | 'all'
    status: SaleStatus | 'all'
  } | null
  salesSummary: CustomerSalesSummary | null
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'adatok', label: 'Adatok' },
  { key: 'eladasok', label: 'Értékesítések' }
]

export function CustomerDetailClient({
  customer,
  canWrite,
  canOpenSales,
  sales,
  salesSummary
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const raw = searchParams.get('tab')
  const active: TabKey =
    raw === 'eladasok' && canOpenSales ? 'eladasok' : 'adatok'

  const setTab = useCallback(
    (key: TabKey) => {
      const sp = new URLSearchParams(searchParams.toString())
      if (key === 'adatok') {
        sp.delete('tab')
        sp.delete('page')
        sp.delete('q')
        sp.delete('pay')
        sp.delete('channel')
        sp.delete('status')
      } else {
        sp.set('tab', 'eladasok')
        sp.delete('page')
      }
      const q = sp.toString()
      router.replace(q ? `?${q}` : '?', { scroll: false })
    },
    [router, searchParams]
  )

  const tabCount = salesSummary?.saleCount ?? 0

  return (
    <div>
      <div
        role="tablist"
        aria-label="Ügyfél nézetek"
        className="mb-4 inline-flex gap-1 rounded-lg border border-border bg-subtle p-1"
      >
        {TABS.map((tab) => {
          if (tab.key === 'eladasok' && !canOpenSales) return null
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
              {tab.key === 'eladasok' && tabCount > 0 ? (
                <span className="ml-1.5 tabular-nums opacity-80">
                  ({tabCount})
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {active === 'adatok' ? (
        <CustomerForm mode="edit" initial={customer} canWrite={canWrite} />
      ) : sales && salesSummary ? (
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
            summary={salesSummary}
            canOpenSales={canOpenSales}
          />
        </div>
      ) : (
        <p className="text-body text-ink-muted">Nem sikerült betölteni.</p>
      )}
    </div>
  )
}
