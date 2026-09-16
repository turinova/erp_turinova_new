import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'

import { ListPageSkeleton } from '@/components/patterns/list-page-skeleton'
import { SmsLogListClient } from '@/components/sms/sms-log-list-client'
import { requireTenantOwnerPage } from '@/lib/billing/require-owner'
import { currentUtcYearMonth } from '@/lib/billing/estimate'
import { tenantHasQuoteReadySms } from '@/lib/sms/entitlement'
import { listSmsSendEvents } from '@/lib/sms/log-queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'SMS napló'
}

type SearchParams = Promise<{ page?: string }>

export default function SmsLogPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  return (
    <Suspense fallback={<ListPageSkeleton title="SMS napló betöltése" />}>
      <SmsLogLoader searchParams={searchParams} />
    </Suspense>
  )
}

async function SmsLogLoader({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const user = await requireTenantOwnerPage()

  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const ym = currentUtcYearMonth()

  let loadError: string | null = null
  let missingAddon = false
  let rows: Awaited<ReturnType<typeof listSmsSendEvents>>['rows'] = []
  let total = 0
  let limit = 25
  let billableCount = 0
  let unitPriceHuf = 95

  if (user.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (!supabase) {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    } else {
      const hasAddon = await tenantHasQuoteReadySms(supabase, user.tenantId)
      if (!hasAddon) {
        missingAddon = true
      } else {
        try {
          const [{ data: addon }, list] = await Promise.all([
            supabase
              .from('product_addons')
              .select('price_unit_huf')
              .eq('key', 'quote_ready_sms')
              .maybeSingle(),
            listSmsSendEvents(supabase, {
              tenantId: user.tenantId,
              year: ym.year,
              month: ym.month,
              page,
              limit: 25
            })
          ])
          if (addon?.price_unit_huf != null) {
            unitPriceHuf = Number(addon.price_unit_huf) || 95
          }
          rows = list.rows
          total = list.total
          limit = list.limit
          billableCount = list.billableCount
        } catch (err) {
          loadError =
            err instanceof Error
              ? err.message
              : 'Nem sikerült betölteni az SMS naplót.'
        }
      }
    }
  } else if (user.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  } else {
    loadError = 'Nincs aktív céged.'
  }

  if (missingAddon) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">SMS napló</h1>
        <p className="max-w-xl rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-warning-ink">
          A készre jelentés SMS nincs bekapcsolva ennél a cégnél. Ha szeretnéd,
          hívd vagy írd meg az Optinovának.
        </p>
        <Link
          href="/beallitasok/elofizetes"
          className="text-hint text-ink no-underline hover:underline"
        >
          ← Vissza az előfizetéshez
        </Link>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">SMS napló</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
      </div>
    )
  }

  return (
    <SmsLogListClient
      rows={rows}
      total={total}
      page={page}
      limit={limit}
      year={ym.year}
      month={ym.month}
      billableCount={billableCount}
      unitPriceHuf={unitPriceHuf}
    />
  )
}
