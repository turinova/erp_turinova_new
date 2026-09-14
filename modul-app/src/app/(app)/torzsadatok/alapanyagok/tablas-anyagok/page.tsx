import type { Metadata } from 'next'
import { Suspense } from 'react'

import { SheetMaterialsListClient } from '@/components/sheet-materials/sheet-materials-list-client'
import { getSessionUser } from '@/lib/auth/session'
import { listSheetMaterials } from '@/lib/sheet-materials/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Táblás anyagok'
}

type SearchParams = Promise<{
  q?: string
  page?: string
  active?: string
}>

export default async function TablasAnyagokListPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const activeParam = params.active
  const active: 'all' | 'active' | 'inactive' =
    activeParam === 'active' || activeParam === 'inactive'
      ? activeParam
      : 'all'

  let loadError: string | null = null
  let rows: Awaited<ReturnType<typeof listSheetMaterials>>['rows'] = []
  let total = 0
  let limit = 25

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const result = await listSheetMaterials(supabase, {
          tenantId: user.tenantId,
          q: q || undefined,
          active,
          page,
          limit: 25
        })
        rows = result.rows
        total = result.total
        limit = result.limit
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a táblás anyagokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a sheet_materials migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Táblás anyagok</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260311_sheet_materials.sql
          </code>{' '}
          fájlt a Supabase SQL Editorben, majd frissítsd az oldalt.
        </p>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <SheetMaterialsListClient
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        canWrite={canWrite}
        initialQ={q}
        initialActive={active}
      />
    </Suspense>
  )
}
