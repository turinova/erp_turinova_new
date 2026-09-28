import type { Metadata } from 'next'

import { AccessoriesClient } from '@/components/accessories/accessories-client'
import { getSessionUser } from '@/lib/auth/session'
import {
  ACCESSORY_WEB_FILTERS,
  listAccessoriesPage,
  listAccessoryUnitOptions,
  type AccessoryListPage,
  type AccessoryWebFilter
} from '@/lib/accessories/queries'
import { tenantHasProductLabels } from '@/lib/labels/entitlement'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'

export const metadata: Metadata = {
  title: 'Termékek'
}

type PageProps = {
  searchParams: Promise<{ q?: string; page?: string; web?: string }>
}

function emptyPage(page: number): AccessoryListPage {
  return { rows: [], total: 0, page, pageCount: 1 }
}

export default async function TermekekPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const q = (sp.q ?? '').slice(0, 80)
  const pageNo = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)
  const webParam: AccessoryWebFilter = (
    ACCESSORY_WEB_FILTERS as readonly string[]
  ).includes(sp.web ?? '')
    ? (sp.web as AccessoryWebFilter)
    : 'all'

  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let data = emptyPage(pageNo)
  let units: Awaited<ReturnType<typeof listAccessoryUnitOptions>> = []
  let canPrintLabels = false
  let hasWebshop = false
  let serverSeeded = false
  let hardError: string | null = null

  if (user?.isDevSession) {
    hardError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  } else if (user?.tenantId) {
    const supabase = await createClient()
    if (!supabase) {
      hardError = 'Az adatbázis kapcsolat nem elérhető.'
    } else {
      const tenantId = user.tenantId

      // web=all (default): lista RPC párhuzamosan a meta adatokkal.
      // web szűrő: előbb entitlement, aztán lista.
      if (webParam === 'all') {
        const [unitRes, labelsRes, webRes, listRes] = await Promise.allSettled([
          listAccessoryUnitOptions(supabase, tenantId),
          tenantHasProductLabels(supabase, tenantId),
          tenantHasWebshop(supabase, tenantId),
          listAccessoriesPage(supabase, tenantId, {
            q,
            page: pageNo,
            web: 'all',
            hasWebshop: false
          })
        ])
        if (unitRes.status === 'fulfilled') units = unitRes.value
        if (labelsRes.status === 'fulfilled') canPrintLabels = labelsRes.value
        if (webRes.status === 'fulfilled') hasWebshop = webRes.value
        if (listRes.status === 'fulfilled') {
          data = listRes.value
          serverSeeded = true
        } else {
          console.error('termekek SSR list', listRes.reason)
        }
      } else {
        const [unitRes, labelsRes, webRes] = await Promise.allSettled([
          listAccessoryUnitOptions(supabase, tenantId),
          tenantHasProductLabels(supabase, tenantId),
          tenantHasWebshop(supabase, tenantId)
        ])
        if (unitRes.status === 'fulfilled') units = unitRes.value
        if (labelsRes.status === 'fulfilled') canPrintLabels = labelsRes.value
        if (webRes.status === 'fulfilled') hasWebshop = webRes.value

        const effectiveWeb = hasWebshop ? webParam : 'all'
        try {
          data = await listAccessoriesPage(supabase, tenantId, {
            q,
            page: pageNo,
            web: effectiveWeb,
            hasWebshop
          })
          serverSeeded = true
        } catch (err) {
          console.error('termekek SSR list', err)
        }
      }
    }
  }

  if (hardError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Termékek</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {hardError}
        </p>
      </div>
    )
  }

  return (
    <AccessoriesClient
      data={data}
      q={q}
      web={hasWebshop ? webParam : 'all'}
      canWrite={canWrite}
      canPrintLabels={canPrintLabels}
      units={units}
      hasWebshop={hasWebshop}
      serverSeeded={serverSeeded}
    />
  )
}
