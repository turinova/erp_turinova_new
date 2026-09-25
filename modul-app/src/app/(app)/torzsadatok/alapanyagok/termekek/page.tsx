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

export default async function TermekekPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const q = (sp.q ?? '').slice(0, 80)
  const pageNo = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)
  const web: AccessoryWebFilter = (ACCESSORY_WEB_FILTERS as readonly string[]).includes(sp.web ?? '')
    ? (sp.web as AccessoryWebFilter)
    : 'all'

  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let data: AccessoryListPage = { rows: [], total: 0, page: 1, pageCount: 1 }
  let units: Awaited<ReturnType<typeof listAccessoryUnitOptions>> = []
  let canPrintLabels = false
  let hasWebshop = false
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const [unitOpts, labelsOn, webOn] = await Promise.all([
          listAccessoryUnitOptions(supabase, user.tenantId),
          tenantHasProductLabels(supabase, user.tenantId),
          tenantHasWebshop(supabase, user.tenantId)
        ])
        units = unitOpts
        canPrintLabels = labelsOn
        hasWebshop = webOn
        data = await listAccessoriesPage(supabase, user.tenantId, {
          q,
          page: pageNo,
          web,
          hasWebshop: webOn
        })
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a termékeket.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd az accessories migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Termékek</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260416_accessories.sql
          </code>{' '}
          fájlt a Supabase SQL Editorben, majd frissítsd az oldalt.
        </p>
      </div>
    )
  }

  return (
    <AccessoriesClient
      data={data}
      q={q}
      web={hasWebshop ? web : 'all'}
      canWrite={canWrite}
      canPrintLabels={canPrintLabels}
      units={units}
      hasWebshop={hasWebshop}
    />
  )
}
